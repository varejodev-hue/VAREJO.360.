import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Trigger = "orcamento_criado" | "task_vencida" | "especificador_inativo";
type ActionTipo = "criar_task" | "criar_interacao" | "notificar_usuario";

type ExecInput = {
  workflow_id: string;
  payload?: Record<string, unknown>;
  force_dry_run?: boolean;
};

function evalCondicoes(cond: Record<string, unknown>, payload: Record<string, unknown>): { ok: boolean; motivo?: string } {
  // Suporta condições simples: { campo: { op: 'gt'|'gte'|'lt'|'lte'|'eq'|'neq', valor: X } }
  for (const [campo, regraRaw] of Object.entries(cond ?? {})) {
    const regra = regraRaw as { op: string; valor: unknown };
    const v = payload?.[campo];
    const alvo = regra?.valor;
    const op = regra?.op ?? "eq";
    const num = typeof v === "number" ? v : Number(v);
    const numAlvo = typeof alvo === "number" ? alvo : Number(alvo);
    let ok = true;
    switch (op) {
      case "eq": ok = v === alvo; break;
      case "neq": ok = v !== alvo; break;
      case "gt": ok = num > numAlvo; break;
      case "gte": ok = num >= numAlvo; break;
      case "lt": ok = num < numAlvo; break;
      case "lte": ok = num <= numAlvo; break;
      default: ok = true;
    }
    if (!ok) return { ok: false, motivo: `Condição não satisfeita: ${campo} ${op} ${String(alvo)} (valor=${String(v)})` };
  }
  return { ok: true };
}

export const executarWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ExecInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wf, error: errWf } = await supabase
      .from("workflows").select("*").eq("id", data.workflow_id).maybeSingle();
    if (errWf || !wf) throw new Error("Workflow não encontrado");
    if (!wf.ativo) throw new Error("Workflow inativo");

    const payload = data.payload ?? {};
    const isDry = data.force_dry_run ?? wf.dry_run;

    const cond = evalCondicoes((wf.condicoes as Record<string, unknown>) ?? {}, payload);
    if (!cond.ok) {
      await supabase.from("workflow_runs").insert({
        workflow_id: wf.id, gatilho: wf.gatilho as Trigger, status: "simulado",
        payload: payload as never, observacao: cond.motivo, executado_por: userId,
      });
      return { status: "skipped", motivo: cond.motivo };
    }

    const { data: acoes } = await supabase
      .from("workflow_actions").select("*").eq("workflow_id", wf.id).order("ordem");

    const resultados: Array<{ tipo: ActionTipo; ok: boolean; info?: string; erro?: string }> = [];

    for (const a of acoes ?? []) {
      const params = (a.params as Record<string, unknown>) ?? {};
      try {
        if (isDry) {
          resultados.push({ tipo: a.tipo as ActionTipo, ok: true, info: "simulado" });
          continue;
        }
        if (a.tipo === "criar_task") {
          const { error } = await supabase.from("tasks").insert({
            titulo: String(params.titulo ?? "Task automática"),
            tipo: ((params.tipo as string) ?? "outro") as "followup" | "ligacao" | "visita" | "outro",
            due_at: (params.due_at as string) ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            status: "pendente",
            descricao: (params.descricao as string) ?? null,
            orcamento_id: (payload.orcamento_id as string) ?? null,
            especificador_id: (payload.especificador_id as string) ?? null,
            cliente_id: (payload.cliente_id as string) ?? null,
            vendedor_id: (payload.vendedor_id as string) ?? null,
            loja_id: (payload.loja_id as string) ?? null,
          });
          if (error) throw error;
          resultados.push({ tipo: "criar_task", ok: true });
        } else if (a.tipo === "criar_interacao") {
          const espId = (payload.especificador_id as string | undefined) ?? (params.especificador_id as string | undefined);
          if (!espId) throw new Error("especificador_id ausente para criar_interacao");
          const { error } = await supabase.from("interacoes").insert({
            tipo: ((params.tipo as string) ?? "ligacao") as "ligacao" | "whatsapp" | "email" | "visita" | "reuniao" | "evento" | "almoco" | "treinamento" | "outro",
            data_interacao: new Date().toISOString(),
            observacao: String(params.observacao ?? "Interação automática via workflow"),
            especificador_id: espId,
            owner_id: userId,
          });
          if (error) throw error;
          resultados.push({ tipo: "criar_interacao", ok: true });
        } else if (a.tipo === "notificar_usuario") {
          const alvo = (params.user_id as string) ?? (payload.vendedor_user_id as string) ?? userId;
          const { error } = await supabase.from("notificacoes").insert({
            user_id: alvo,
            titulo: String(params.titulo ?? "Notificação do sistema"),
            mensagem: (params.mensagem as string) ?? null,
            link: (params.link as string) ?? null,
            origem: `workflow:${wf.nome}`,
          });
          if (error) throw error;
          resultados.push({ tipo: "notificar_usuario", ok: true });
        }
      } catch (e) {
        resultados.push({ tipo: a.tipo as ActionTipo, ok: false, erro: (e as Error).message });
      }
    }

    const houveErro = resultados.some((r) => !r.ok);
    await supabase.from("workflow_runs").insert({
      workflow_id: wf.id,
      gatilho: wf.gatilho as Trigger,
      status: isDry ? "simulado" : houveErro ? "erro" : "sucesso",
      payload: payload as never,
      acoes_resultado: resultados as never,
      executado_por: userId,
    });

    return { status: isDry ? "simulado" : houveErro ? "erro" : "sucesso", resultados };
  });
