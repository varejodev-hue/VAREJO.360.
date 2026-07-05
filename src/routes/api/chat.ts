import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";

type ChatRequestBody = { messages?: unknown };
type AppRole = Database["public"]["Enums"]["app_role"];

const GLOBAL_ROLES: AppRole[] = [
  "admin",
  "head_nacional_loja_propria",
  "head_nacional_franquia",
  "analista_performance",
  "gerente_performance",
];
const REGIONAL_ROLES: AppRole[] = ["gerente_regional_franquia"];
const LOJA_ROLES: AppRole[] = ["gerente_loja", "coordenador_loja"];
const SELLER_ROLES: AppRole[] = ["vendedor", "assistente_venda"];

// --- Prompt-injection / data-exfiltration guard ---
// Match attempts to list PII or export raw data.
const BLOCK_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(cpf|cnpj|documento|rg)\b/i, reason: "Pergunta envolve documentos pessoais." },
  { pattern: /\b(telefone|celular|whats(app)?|fone)\b/i, reason: "Pergunta envolve telefones." },
  { pattern: /\b(e-?mail|endere[çc]o|cep|rua|bairro)\b/i, reason: "Pergunta envolve dados de contato/endereço." },
  { pattern: /\b(senha|password|token|api[_\s-]?key|chave|secret)\b/i, reason: "Pergunta envolve credenciais." },
  { pattern: /\b(exportar|baixar|download|dump|listar todos|toda a base|raw|cru)\b/i, reason: "Pergunta tenta exportar base." },
  { pattern: /\b(observa[çc][õo]es|observacao|anota[çc][õo]es)\b.*\b(cliente|pessoa)/i, reason: "Pergunta tenta acessar observações pessoais." },
];

const SENSITIVE_FIELD_KEYS = new Set([
  "cpf", "cnpj", "documento", "rg",
  "telefone", "celular", "whatsapp", "fone",
  "email", "e_mail",
  "endereco", "endereço", "cep", "rua", "bairro", "complemento",
  "observacoes", "observações", "observacao", "observação",
  "senha", "password", "token", "api_key", "chave", "secret",
]);

function scrub<T>(rows: T[] | null | undefined): T[] {
  if (!rows) return [];
  return rows.map((r) => {
    if (!r || typeof r !== "object") return r;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_KEYS.has(k.toLowerCase())) continue;
      out[k] = v;
    }
    return out as T;
  });
}

function extractLastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return (last.parts ?? [])
    .map((p: any) => (p?.type === "text" ? p.text : ""))
    .join(" ")
    .slice(0, 2000);
}

function checkBlocked(text: string): string | null {
  for (const { pattern, reason } of BLOCK_PATTERNS) {
    if (pattern.test(text)) return reason;
  }
  return null;
}

async function resolveScope(supabase: SupabaseClient<Database>, userId: string) {
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("loja_id,regiao_id").eq("id", userId).maybeSingle(),
  ]);
  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  const isGlobal = roleList.some((r) => GLOBAL_ROLES.includes(r));
  const isRegional = roleList.some((r) => REGIONAL_ROLES.includes(r));
  const isLoja = roleList.some((r) => LOJA_ROLES.includes(r));
  const isSeller = roleList.some((r) => SELLER_ROLES.includes(r));
  const tier: "global" | "regional" | "loja" | "vendedor" | "none" =
    isGlobal ? "global" : isRegional ? "regional" : isLoja ? "loja" : isSeller ? "vendedor" : "none";
  return {
    roles: roleList,
    tier,
    loja_id: profile?.loja_id ?? null,
    regiao_id: profile?.regiao_id ?? null,
  };
}

async function audit(
  userId: string,
  intent: string,
  preview: string,
  tables: string[],
  blocked: boolean,
  reason: string | null,
  role: string,
  scope: Record<string, unknown>,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("chat_audit_log").insert({
      user_id: userId,
      intent,
      prompt_preview: preview.slice(0, 500),
      tables_consulted: tables,
      blocked,
      block_reason: reason,
      role_snapshot: role,
      scope_snapshot: scope as never,
    });
  } catch {
    /* audit best-effort */
  }
}

async function loadContexto(
  supabase: SupabaseClient<Database>,
  scope: Awaited<ReturnType<typeof resolveScope>>,
): Promise<{ contexto: string; tables: string[] }> {
  // RLS is the primary scope gate; we additionally filter explicitly per tier.
  let orcQ = supabase.from("orcamentos").select(
    "data_orcamento,valor_orcado,valor_vendido,vendedor_id,loja_id,especificador_id,status",
  );
  // Vendedor/assistente_venda: sem vínculo direto profiles.vendedor_id ainda,
  // então escopo é a loja do profile.
  if ((scope.tier === "loja" || scope.tier === "vendedor") && scope.loja_id) {
    orcQ = orcQ.eq("loja_id", scope.loja_id);
  } else if (scope.tier === "vendedor" && !scope.loja_id) {
    // sem loja vinculada → não retorna nada
    orcQ = orcQ.eq("loja_id", "00000000-0000-0000-0000-000000000000");
  } else if (scope.tier === "regional" && scope.regiao_id) {
    const { data: lojasRegiao } = await supabase
      .from("lojas").select("id").eq("regiao_id", scope.regiao_id);
    const ids = (lojasRegiao ?? []).map((l) => l.id);
    orcQ = orcQ.in("loja_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const [{ data: orc }, { data: vend }, { data: lojas }, { data: esp }] = await Promise.all([
    orcQ,
    supabase.from("vendedores").select("id,nome,loja_id"),
    supabase.from("lojas").select("id,nome"),
    supabase.from("especificadores").select("id,nome,ativo"),
  ]);

  // Scrub any sensitive fields defensively (these selects already exclude PII).
  const orcS = scrub(orc), vendS = scrub(vend), lojasS = scrub(lojas), espS = scrub(esp);

  const lojaMap = new Map(lojasS.map((l: any) => [l.id, l.nome]));
  const vendMap = new Map(vendS.map((v: any) => [v.id, v.nome]));
  const espMap = new Map(espS.map((e: any) => [e.id, e.nome]));

  type Agg = { orcado: number; vendido: number; qtd: number; vendas: number };
  const newAgg = (): Agg => ({ orcado: 0, vendido: 0, qtd: 0, vendas: 0 });
  const totalAno = new Map<string, Agg>();
  const porLoja = new Map<string, Agg>();
  const porVend = new Map<string, Agg>();
  const porEsp = new Map<string, Agg>();

  orcS.forEach((o: any) => {
    const ano = (o.data_orcamento ?? "").slice(0, 4) || "?";
    const vo = Number(o.valor_orcado ?? 0), vv = Number(o.valor_vendido ?? 0);
    const add = (m: Map<string, Agg>, k: string) => {
      const a = m.get(k) ?? newAgg();
      a.orcado += vo; a.vendido += vv; a.qtd += 1; if (vv > 0) a.vendas += 1;
      m.set(k, a);
    };
    add(totalAno, ano);
    if (o.loja_id) add(porLoja, `${lojaMap.get(o.loja_id) ?? o.loja_id}|${ano}`);
    if (o.vendedor_id) add(porVend, `${vendMap.get(o.vendedor_id) ?? o.vendedor_id}|${ano}`);
    if (o.especificador_id) add(porEsp, `${espMap.get(o.especificador_id) ?? o.especificador_id}|${ano}`);
  });

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const linhaAgg = (k: string, a: Agg) =>
    `- ${k}: orçado ${fmt(a.orcado)} | vendido ${fmt(a.vendido)} | ${a.qtd} orç. | conv. ${a.qtd ? ((a.vendas / a.qtd) * 100).toFixed(1) : 0}%`;
  const top = (m: Map<string, Agg>, n = 15) =>
    [...m.entries()].sort((a, b) => b[1].vendido - a[1].vendido).slice(0, n);

  const contexto = [
    `# Snapshot Comercial (escopo: ${scope.tier}) — somente dados agregados`,
    `## Totais por ano`,
    ...[...totalAno.entries()].sort().map(([k, a]) => linhaAgg(k, a)),
    `## Top lojas por venda (loja|ano)`,
    ...top(porLoja, 20).map(([k, a]) => linhaAgg(k, a)),
    `## Top vendedores por venda (vendedor|ano)`,
    ...top(porVend, 20).map(([k, a]) => linhaAgg(k, a)),
    `## Top especificadores por venda (especificador|ano)`,
    ...top(porEsp, 20).map(([k, a]) => linhaAgg(k, a)),
    `## Resumo cadastros`,
    `- Lojas: ${lojasS.length} | Vendedores: ${vendS.length} | Especificadores: ${espS.length} (ativos: ${espS.filter((e: any) => e.ativo).length})`,
  ].join("\n");

  return { contexto, tables: ["orcamentos", "vendedores", "lojas", "especificadores"] };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Autenticação obrigatória
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: claimsRes, error: authErr } = await supabase.auth.getClaims(token);
        const userId = claimsRes?.claims?.sub;
        if (authErr || !userId) return new Response("Unauthorized", { status: 401 });

        // 2) Resolve papel e escopo
        const scope = await resolveScope(supabase, userId);
        if (scope.tier === "none") {
          await audit(userId, "no_role", "", [], true, "Usuário sem papel atribuído.", "none", scope);
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) return new Response("Messages are required", { status: 400 });
        const messages = body.messages as UIMessage[];
        const lastUser = extractLastUserText(messages);

        // 5) Bloqueia perguntas de PII / exportação
        const blockedReason = checkBlocked(lastUser);
        if (blockedReason) {
          await audit(userId, "blocked_pii", lastUser, [], true, blockedReason, scope.tier, scope);
          return new Response(
            JSON.stringify({ error: "Pergunta bloqueada pela política de privacidade.", reason: blockedReason }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        // 7) Chave da IA somente no servidor
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // 3+4) Dados agregados filtrados pelo escopo, com PII removida
        let tables: string[] = [];
        let contexto = "";
        try {
          const r = await loadContexto(supabase, scope);
          contexto = r.contexto;
          tables = r.tables;
        } catch (e) {
          contexto = `(erro ao carregar dados: ${e instanceof Error ? e.message : "?"})`;
        }

        // 6) Auditoria da consulta autorizada
        await audit(userId, "query", lastUser, tables, false, null, scope.tier, scope);

        const system = `Você é um analista de performance comercial. Responda em português, objetivo, com números agregados.
REGRAS:
- Use somente os dados agregados abaixo (já filtrados pelo escopo do usuário: ${scope.tier}).
- NUNCA revele CPF, CNPJ, telefones, e-mails, endereços, observações pessoais, senhas, tokens ou chaves.
- Recuse pedidos para listar pessoas, exportar bases ou exibir dados de contato.
- Se faltar dado, diga claramente.

${contexto}`;

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-2.5-flash");
        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
