import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = [
  "admin", "assistente_venda", "vendedor", "coordenador_loja", "gerente_loja",
  "gerente_regional_franquia", "head_nacional_loja_propria", "head_nacional_franquia",
  "analista_performance", "gerente_performance", "projetista",
] as const;

async function ensureAdmin(supabase: any, userId: string) {
  const [admin, gerente, headPropria, headFranquia, gerentePerformance] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "gerente_loja" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "head_nacional_loja_propria" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "head_nacional_franquia" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "gerente_performance" }),
  ]);
  if (admin.error) throw new Error(admin.error.message);
  if (gerente.error) throw new Error(gerente.error.message);
  if (headPropria.error) throw new Error(headPropria.error.message);
  if (headFranquia.error) throw new Error(headFranquia.error.message);
  if (gerentePerformance.error) throw new Error(gerentePerformance.error.message);
  if (!admin.data && !gerente.data && !headPropria.data && !headFranquia.data && !gerentePerformance.data) {
    throw new Error("Acesso negado: requer perfil admin, gerente, head nacional ou performance");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles").select("id, nome, email, ativo, created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: scopes } = await (supabaseAdmin as any).from("profiles").select("id, loja_id, regiao_id, vendedor_id");
    const byUser: Record<string, string[]> = {};
    for (const r of roles ?? []) (byUser[r.user_id] ??= []).push(r.role);
    const scopeMap = Object.fromEntries((scopes ?? []).map((s) => [s.id, s]));
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: byUser[p.id] ?? [],
      loja_id: scopeMap[p.id]?.loja_id ?? null,
      regiao_id: scopeMap[p.id]?.regiao_id ?? null,
      vendedor_id: scopeMap[p.id]?.vendedor_id ?? null,
    }));
  });

export const updateUserScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    lojaId: z.string().uuid().nullable(),
    regiaoId: z.string().uuid().nullable(),
    vendedorId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, string | null> = { loja_id: data.lojaId, regiao_id: data.regiaoId };
    if (data.vendedorId !== undefined) payload.vendedor_id = data.vendedorId;
    const { error } = await (supabaseAdmin as any).from("profiles").update(payload).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    email: z.string().email(),
    password: z.string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Za-z]/, "Precisa de letra")
      .regex(/[0-9]/, "Precisa de número")
      .regex(/[^A-Za-z0-9]/, "Precisa de símbolo"),
    nome: z.string().min(1),
    role: z.enum(ROLES),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({ id: uid, nome: data.nome, email: data.email });
    const { error: rerr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rerr) throw new Error(rerr.message);
    return { id: uid };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.userId);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode remover a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantSelfAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Bootstrap-only: must be explicitly enabled via env. Disable in production
    // once the first admin exists.
    if (process.env.ALLOW_BOOTSTRAP_ADMIN !== "true") {
      throw new Error("Bootstrap de administrador desabilitado. Solicite acesso a um admin existente.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Já existe um administrador no sistema.");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ROLE_OPTIONS = ROLES.map((r) => ({
  value: r,
  label: ({
    admin: "Administrador",
    assistente_venda: "Assistente de Venda",
    vendedor: "Vendedor",
    coordenador_loja: "Coordenador de Loja",
    gerente_loja: "Gerente de Loja",
    gerente_regional_franquia: "Gerente Regional Franquia",
    head_nacional_loja_propria: "Head Nacional Loja Própria",
    head_nacional_franquia: "Head Nacional Franquia",
    analista_performance: "Analista de Performance",
    gerente_performance: "Gerente de Performance",
    projetista: "Projetista",
  } as const)[r],
}));
