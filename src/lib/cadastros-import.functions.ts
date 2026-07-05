import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CadastroRow = Record<string, string | number | null | undefined>;
type ImportInput = { arquivo: string; rows: CadastroRow[] };

const ESP_MAP: Record<string, string> = {
  "nome": "nome", "nome completo": "nome", "especificador": "nome",
  "email": "email", "e-mail": "email",
  "telefone": "telefone", "celular": "telefone", "fone": "telefone",
  "cidade": "cidade",
  "uf": "uf", "estado": "uf",
  "profissao": "profissao", "cargo": "profissao",
  "documento": "documento", "cpf": "documento", "cnpj": "documento",
  "observacoes": "observacoes", "obs": "observacoes",
};

const CLI_MAP: Record<string, string> = {
  "nome": "nome", "cliente": "nome", "razao social": "nome",
  "email": "email", "e-mail": "email",
  "telefone": "telefone", "celular": "telefone", "fone": "telefone",
  "documento": "documento", "cpf": "documento", "cnpj": "documento",
  "cidade": "cidade",
  "uf": "uf", "estado": "uf",
};

function normalizeHeader(h: string) {
  return h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function mapRow(row: CadastroRow, map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = map[normalizeHeader(k)];
    if (key) {
      const value = String(v ?? "").trim();
      if (value) out[key] = value;
    }
  }
  return out;
}

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => Promise<{ data: boolean | null }> }; userId: string };

async function processImport(context: Ctx, data: ImportInput, table: "especificadores" | "clientes", map: Record<string, string>) {
  const { supabase, userId } = context;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas administradores podem importar planilhas.");

  const erros: { linha: number; erro: string }[] = [];
  const cache = new Map<string, string>();
  const { data: existentes } = await supabaseAdmin.from(table).select("id,nome");
  existentes?.forEach((r) => cache.set(r.nome.toLowerCase(), r.id));

  const { data: log, error: logErr } = await supabaseAdmin
    .from("import_logs")
    .insert({ arquivo: data.arquivo, tipo: table, total_linhas: data.rows.length, user_id: userId })
    .select("id").single();
  if (logErr) throw logErr;

  let sucesso = 0, criados = 0, atualizados = 0;

  for (let i = 0; i < data.rows.length; i++) {
    const linha = i + 2;
    try {
      const mapped = mapRow(data.rows[i], map);
      const nome = mapped.nome;
      if (!nome) throw new Error("Nome é obrigatório");

      const key = nome.toLowerCase();
      if (cache.has(key)) {
        const { nome: _, ...rest } = mapped;
        void _;
        if (Object.keys(rest).length > 0) {
          const { error } = await supabaseAdmin.from(table).update(rest as never).eq("id", cache.get(key)!);
          if (error) throw error;
          atualizados++;
        }
      } else {
        const { data: ins, error } = await supabaseAdmin.from(table).insert({ nome, ...mapped } as never).select("id").single();
        if (error) throw error;
        cache.set(key, (ins as { id: string }).id);
        criados++;
      }
      sucesso++;
    } catch (e) {
      erros.push({ linha, erro: e instanceof Error ? e.message : String(e) });
    }
  }

  await supabaseAdmin.from("import_logs").update({
    total_sucesso: sucesso,
    total_erro: erros.length,
    cadastros_criados: { criados, atualizados },
    erros,
  }).eq("id", log.id);

  return { sucesso, erros, criados, atualizados, logId: log.id };
}

export const importEspecificadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ImportInput) => data)
  .handler(async ({ data, context }) => processImport(context as unknown as Ctx, data, "especificadores", ESP_MAP));

export const importClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ImportInput) => data)
  .handler(async ({ data, context }) => processImport(context as unknown as Ctx, data, "clientes", CLI_MAP));
