import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImportRow = {
  numero?: string | number;
  numero_pedido?: string | number;
  data?: string | number;
  loja?: string;
  canal?: string;
  vendedor?: string;
  especificador?: string;
  cliente?: string;
  valor_orcado?: string | number;
  valor_vendido?: string | number;
  data_venda?: string | number;
  status?: string;
  observacao?: string;
};

function normalizeCanal(v: string): "loja_propria" | "franquia" | "nao_classificado" {
  const s = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (/(propria|own)/.test(s)) return "loja_propria";
  if (/(franqu|franch)/.test(s)) return "franquia";
  return "nao_classificado";
}

const STATUS_VALIDOS = ["orcado","aberto","em_negociacao","aprovado","parcial","vendido","cancelado","perdido","reaberto","reaproveitado"] as const;
type StatusOrc = typeof STATUS_VALIDOS[number];
function normalizeStatus(raw: string, valor_orcado: number, valor_vendido: number): StatusOrc {
  const s = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!s) return valor_vendido > 0 ? (valor_vendido >= valor_orcado ? "vendido" : "parcial") : "orcado";
  if (/(em.?neg)/.test(s)) return "em_negociacao";
  if (/aprov/.test(s)) return "aprovado";
  if (/reaber/.test(s)) return "reaberto";
  if (/reaprov/.test(s)) return "reaproveitado";
  if (/cancel/.test(s)) return "cancelado";
  if (/perd/.test(s)) return "perdido";
  if (/vend|sell/.test(s)) return "vendido";
  if (/parc/.test(s)) return "parcial";
  if (/abert/.test(s)) return "aberto";
  if (/orca/.test(s)) return "orcado";
  return (STATUS_VALIDOS as readonly string[]).includes(s) ? (s as StatusOrc) : "orcado";
}

const STATUS_FECHADO = new Set(["vendido","cancelado","perdido"]);
const STATUS_ABERTO = new Set(["aberto","em_negociacao","aprovado","reaberto","reaproveitado","orcado","parcial"]);

type ImportInput = { arquivo: string; rows: ImportRow[] };

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

function slugCodigo(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 30) || "LOJA";
}

export const importOrcamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ImportInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica admin
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem importar planilhas.");

    const created = { lojas: 0, vendedores: 0, especificadores: 0, clientes: 0 };
    const erros: { linha: number; erro: string }[] = [];
    const duplicidades: { linha: number; motivo: string }[] = [];
    let lojasSemCanal = 0;
    let vinculosSugeridos = 0;
    let atualizados = 0;
    let semAlteracao = 0;
    let reaberturas = 0;

    // Pré-carrega caches
    const lojasCache = new Map<string, string>();
    const vendCache = new Map<string, string>();
    const espCache = new Map<string, string>();
    const cliCache = new Map<string, string>();

    const [lojas, vendedores, especificadores, clientes] = await Promise.all([
      supabaseAdmin.from("lojas").select("id,nome,canal"),
      supabaseAdmin.from("vendedores").select("id,nome"),
      supabaseAdmin.from("especificadores").select("id,nome"),
      supabaseAdmin.from("clientes").select("id,nome"),
    ]);
    lojas.data?.forEach((r) => lojasCache.set(r.nome.toLowerCase(), r.id));
    vendedores.data?.forEach((r) => vendCache.set(r.nome.toLowerCase(), r.id));
    especificadores.data?.forEach((r) => espCache.set(r.nome.toLowerCase(), r.id));
    clientes.data?.forEach((r) => cliCache.set(r.nome.toLowerCase(), r.id));

    async function getOrCreateLoja(nome: string, canalRaw: string): Promise<string | null> {
      if (!nome) return null;
      const key = nome.toLowerCase();
      if (lojasCache.has(key)) return lojasCache.get(key)!;
      const codigo = slugCodigo(nome);
      const canal = canalRaw ? normalizeCanal(canalRaw) : "nao_classificado";
      if (canal === "nao_classificado") lojasSemCanal++;
      const { data: inserted, error } = await supabaseAdmin
        .from("lojas")
        .insert({ codigo, nome, canal: canal as never })
        .select("id").single();
      if (error) throw error;
      lojasCache.set(key, inserted.id);
      created.lojas++;
      return inserted.id;
    }
    async function getOrCreateSimple(table: "vendedores" | "especificadores" | "clientes", cache: Map<string, string>, nome: string, extra: Record<string, unknown> = {}) {
      if (!nome) return null;
      const key = nome.toLowerCase();
      if (cache.has(key)) return cache.get(key)!;
      const { data: inserted, error } = await supabaseAdmin
        .from(table).insert({ nome, ...extra }).select("id").single();
      if (error) throw error;
      cache.set(key, inserted.id);
      if (table === "vendedores") created.vendedores++;
      if (table === "especificadores") created.especificadores++;
      if (table === "clientes") created.clientes++;
      return inserted.id;
    }

    // cria log
    const { data: log, error: logErr } = await supabaseAdmin
      .from("import_logs")
      .insert({ arquivo: data.arquivo, tipo: "orcamentos", total_linhas: data.rows.length, user_id: userId })
      .select("id").single();
    if (logErr) throw logErr;

    let sucesso = 0;
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const linha = i + 2; // header + 1-indexed
      try {
        const numero = norm(row.numero) || norm(row.numero_pedido);
        const dataOrc = toDate(row.data);
        if (!numero || !dataOrc) throw new Error("Número e Data são obrigatórios");

        const loja_id = await getOrCreateLoja(norm(row.loja), norm(row.canal));
        const vendedor_id = await getOrCreateSimple("vendedores", vendCache, norm(row.vendedor), { loja_id });
        const especificador_id = await getOrCreateSimple("especificadores", espCache, norm(row.especificador));
        const cliente_id = await getOrCreateSimple("clientes", cliCache, norm(row.cliente));

        const valor_orcado = toNumber(row.valor_orcado);
        const valor_vendido = toNumber(row.valor_vendido);
        const data_venda = toDate(row.data_venda);
        const numero_pedido = norm(row.numero_pedido) || null;
        let status: StatusOrc = normalizeStatus(norm(row.status), valor_orcado, valor_vendido);

        // Phase D — cruzamento venda↔orçamento por número de pedido
        let targetNumero = numero;
        let targetLoja = loja_id;
        if (valor_vendido > 0 && numero_pedido && loja_id) {
          const { data: orig } = await supabaseAdmin
            .from("orcamentos")
            .select("numero,loja_id")
            .eq("numero_pedido", numero_pedido)
            .eq("loja_id", loja_id)
            .maybeSingle();
          if (orig) { targetNumero = orig.numero; targetLoja = orig.loja_id; }
          else if (cliente_id && dataOrc) {
            const dMin = new Date(dataOrc); dMin.setDate(dMin.getDate() - 7);
            const dMax = new Date(dataOrc); dMax.setDate(dMax.getDate() + 7);
            const vMin = valor_vendido * 0.95;
            const vMax = valor_vendido * 1.05;
            const { data: cand } = await supabaseAdmin
              .from("orcamentos")
              .select("numero,loja_id")
              .eq("loja_id", loja_id)
              .eq("cliente_id", cliente_id)
              .gte("data_orcamento", dMin.toISOString().slice(0, 10))
              .lte("data_orcamento", dMax.toISOString().slice(0, 10))
              .gte("valor_orcado", vMin)
              .lte("valor_orcado", vMax)
              .limit(1);
            if (cand && cand.length > 0) {
              targetNumero = cand[0].numero;
              targetLoja = cand[0].loja_id;
              vinculosSugeridos++;
            }
          }
        }

        // Busca registro existente para comparar (controle de versão)
        const { data: existing } = await supabaseAdmin
          .from("orcamentos")
          .select("id,status,valor_orcado,valor_vendido,loja_id,vendedor_id,especificador_id,cliente_id,observacao")
          .eq("numero", targetNumero)
          .eq("loja_id", targetLoja!)
          .maybeSingle();

        if (existing) {
          // Detecta reabertura
          const prev = String(existing.status);
          const novo = String(status);
          const reabriu = STATUS_FECHADO.has(prev) && STATUS_ABERTO.has(novo);
          if (reabriu) { status = prev === "vendido" ? "reaproveitado" : "reaberto"; reaberturas++; }

          const obsNova = norm(row.observacao) || null;
          const campos: { campo: string; antes: unknown; depois: unknown }[] = [];
          const cmp = (campo: string, antes: unknown, depois: unknown) => {
            if (String(antes ?? "") !== String(depois ?? "")) campos.push({ campo, antes, depois });
          };
          cmp("status", existing.status, status);
          cmp("valor_orcado", Number(existing.valor_orcado), valor_orcado);
          cmp("valor_vendido", Number(existing.valor_vendido), valor_vendido);
          cmp("loja_id", existing.loja_id, targetLoja);
          cmp("vendedor_id", existing.vendedor_id, vendedor_id);
          cmp("especificador_id", existing.especificador_id, especificador_id);
          cmp("cliente_id", existing.cliente_id, cliente_id);
          cmp("observacao", existing.observacao, obsNova);

          if (campos.length === 0) {
            semAlteracao++;
            continue;
          }

          // Atualiza orçamento e grava versão
          const { error: updErr } = await supabaseAdmin.from("orcamentos").update({
            numero_pedido,
            data_orcamento: dataOrc,
            loja_id: targetLoja,
            vendedor_id, especificador_id, cliente_id,
            valor_orcado, valor_vendido, data_venda,
            status: status as never,
            observacao: obsNova,
            import_log_id: log.id,
          }).eq("id", existing.id);
          if (updErr) throw updErr;

          await supabaseAdmin.from("orcamento_versoes").insert({
            orcamento_id: existing.id,
            import_log_id: log.id,
            user_id: userId,
            arquivo: data.arquivo,
            status_anterior: existing.status,
            status_novo: status,
            valor_anterior: existing.valor_orcado,
            valor_novo: valor_orcado,
            campos_alterados: campos as never,
            observacao: reabriu ? `Orçamento ${status === "reaproveitado" ? "reaproveitado" : "reaberto"}.` : null,
          });

          // Follow-ups
          if (STATUS_FECHADO.has(novo)) {
            await supabaseAdmin.from("tasks")
              .update({ status: "cancelada" as never })
              .eq("orcamento_id", existing.id)
              .in("status", ["pendente","em_andamento"]);
          } else if (reabriu || STATUS_ABERTO.has(novo)) {
            await supabaseAdmin.from("tasks").insert({
              titulo: `Follow-up — Orçamento ${targetNumero} (${reabriu ? "reaberto" : novo})`,
              tipo: "followup" as never,
              status: "pendente" as never,
              due_at: new Date(Date.now() + 24*3600*1000).toISOString(),
              orcamento_id: existing.id,
              vendedor_id, especificador_id, cliente_id, loja_id: targetLoja,
              descricao: reabriu ? "Orçamento reaberto via importação. Realizar novo follow-up." : "Atualização via importação.",
            });
          }

          atualizados++;
          sucesso++;
        } else {
          // Insere novo
          const { data: inserted, error } = await supabaseAdmin.from("orcamentos").insert({
            numero: targetNumero,
            numero_pedido,
            data_orcamento: dataOrc,
            loja_id: targetLoja,
            vendedor_id, especificador_id, cliente_id,
            valor_orcado, valor_vendido, data_venda,
            status: status as never,
            observacao: norm(row.observacao) || null,
            import_log_id: log.id,
          }).select("id").single();
          if (error) throw error;

          await supabaseAdmin.from("orcamento_versoes").insert({
            orcamento_id: inserted.id,
            import_log_id: log.id,
            user_id: userId,
            arquivo: data.arquivo,
            status_anterior: null,
            status_novo: status,
            valor_anterior: null,
            valor_novo: valor_orcado,
            campos_alterados: [{ campo: "criado", antes: null, depois: status }],
            observacao: "Orçamento criado.",
          });
          sucesso++;
        }
      } catch (e) {
        erros.push({ linha, erro: e instanceof Error ? e.message : String(e) });
      }
    }

    await supabaseAdmin.from("import_logs").update({
      total_sucesso: sucesso,
      total_erro: erros.length,
      cadastros_criados: { ...created, lojas_sem_canal: lojasSemCanal, duplicidades: duplicidades.length, vinculos_sugeridos: vinculosSugeridos, atualizados, sem_alteracao: semAlteracao, reaberturas, duplicidades_detalhe: duplicidades },
      erros,
    }).eq("id", log.id);

    return { sucesso, erros, criados: created, duplicidades, lojasSemCanal, vinculosSugeridos, atualizados, semAlteracao, reaberturas, logId: log.id };
  });

export const getOrcamentoDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { numero: string; loja_id?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("orcamentos")
      .select("*, lojas(nome,canal), vendedores(nome), especificadores(nome), clientes(nome)")
      .eq("numero", data.numero);
    if (data.loja_id) q = q.eq("loja_id", data.loja_id);
    const { data: orc, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    if (!orc) return { orcamento: null, versoes: [], tasks: [] };
    const [{ data: versoes }, { data: tasks }] = await Promise.all([
      supabase.from("orcamento_versoes").select("*").eq("orcamento_id", orc.id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("id,titulo,status,due_at,tipo,descricao").eq("orcamento_id", orc.id).order("due_at", { ascending: false }),
    ]);
    return { orcamento: orc, versoes: versoes ?? [], tasks: tasks ?? [] };
  });
