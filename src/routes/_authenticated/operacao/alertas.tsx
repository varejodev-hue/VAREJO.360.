import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, Package, ShoppingCart, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacao/alertas")({
  component: AlertasOperacionais,
});

type Alerta = {
  id: string;
  titulo: string;
  detalhe: string;
  tipo: "manutencao" | "rotina" | "compra" | "estoque" | "amostra" | "followup" | "ar" | "planejamento";
  severidade: "critica" | "alta" | "media";
  data?: string | null;
  to: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function AlertasOperacionais() {
  const { lojaId, vendedorId } = useGlobalFilters();

  const alertas = useQuery({
    queryKey: ["operacao-alertas", lojaId, vendedorId],
    queryFn: async () => {
      const hoje = todayISO();
      const em15 = addDays(15);
      const db = supabase as any;

      const [
        manutencoes,
        rotinas,
        compras,
        planejamentos,
        materiais,
        amostras,
        tasks,
        ars,
      ] = await Promise.all([
        (() => {
          let q = db.from("operacao_manutencoes_preventivas").select("*").lte("proxima_execucao", em15).order("proxima_execucao");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_rotinas").select("*").neq("status", "concluido").lte("prazo", em15).order("prazo");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_compras").select("*").neq("status", "encerrado").order("created_at", { ascending: false }).limit(50);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_planejamentos").select("*").in("status", ["planejado", "em_execucao"]).lte("periodo_fim", em15).order("periodo_fim");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_materiais").select("*").order("produto");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_amostra_movimentacoes").select("*,operacao_amostras(codigo,produto)").is("data_devolucao", null).lt("previsao_devolucao", hoje).limit(80);
          if (lojaId) q = q.eq("loja_id", lojaId);
          if (vendedorId) q = q.eq("vendedor_id", vendedorId);
          return q;
        })(),
        (() => {
          let q = supabase.from("tasks").select("*").eq("status", "pendente").lte("due_at", `${hoje}T23:59:59`).order("due_at").limit(80);
          if (lojaId) q = q.eq("loja_id", lojaId);
          if (vendedorId) q = q.eq("vendedor_id", vendedorId);
          return q;
        })(),
        (() => {
          let q = db.from("orcamentos").select("id,numero,ar_status,valor_orcado,loja_id,vendedor_id,clientes(nome)").in("status", ["orcado", "parcial"]).in("ar_status", ["pendente", "divergente"]).limit(80);
          if (lojaId) q = q.eq("loja_id", lojaId);
          if (vendedorId) q = q.eq("vendedor_id", vendedorId);
          return q;
        })(),
      ]);

      const errors = [manutencoes, rotinas, compras, planejamentos, materiais, amostras, tasks, ars].map((r: any) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];

      const rows: Alerta[] = [];

      for (const m of manutencoes.data ?? []) {
        const vencida = m.proxima_execucao && m.proxima_execucao < hoje;
        rows.push({
          id: `man-${m.id}`,
          titulo: vencida ? `Manutenção vencida: ${m.item}` : `Manutenção próxima: ${m.item}`,
          detalhe: `${m.fornecedor ?? "Fornecedor a definir"} · ${m.telefone ?? "sem telefone"} · ${fmtDate(m.proxima_execucao)}`,
          tipo: "manutencao",
          severidade: vencida ? "critica" : "alta",
          data: m.proxima_execucao,
          to: "/operacao/manutencao",
        });
      }

      for (const r of rotinas.data ?? []) {
        rows.push({
          id: `rot-${r.id}`,
          titulo: `Rotina pendente: ${r.titulo}`,
          detalhe: `${r.responsavel_perfil ?? "perfil não definido"} · prazo ${fmtDate(r.prazo)}`,
          tipo: "rotina",
          severidade: r.prazo && r.prazo < hoje ? "critica" : r.prioridade === "alta" ? "alta" : "media",
          data: r.prazo,
          to: "/operacao/rotina",
        });
      }

      for (const c of compras.data ?? []) {
        const checklist = c.checklist ?? {};
        const pendenteFornecedor = !c.fornecedor_cadastrado;
        const abertaHaDias = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
        if (pendenteFornecedor || abertaHaDias >= 3 || c.status === "pendente") {
          rows.push({
            id: `comp-${c.id}`,
            titulo: `Compra em aberto: ${c.material}`,
            detalhe: `${c.etapa_atual} · fornecedor ${pendenteFornecedor ? "sem cadastro" : c.fornecedor ?? "a definir"} · ${Object.values(checklist).filter(Boolean).length} etapas feitas`,
            tipo: "compra",
            severidade: pendenteFornecedor || abertaHaDias >= 7 ? "alta" : "media",
            data: c.created_at,
            to: "/operacao/materiais",
          });
        }
      }

      for (const p of planejamentos.data ?? []) {
        const vencido = p.periodo_fim && p.periodo_fim < hoje;
        rows.push({
          id: `plan-${p.id}`,
          titulo: vencido ? `Planejamento vencido: ${p.titulo}` : `Planejamento em aberto: ${p.titulo}`,
          detalhe: `${p.tipo} - ${p.status} - fecha em ${fmtDate(p.periodo_fim)}`,
          tipo: "planejamento",
          severidade: vencido ? "critica" : "media",
          data: p.periodo_fim,
          to: "/operacao/planejamento",
        });
      }

      for (const m of materiais.data ?? []) {
        if (Number(m.estoque_atual) < Number(m.estoque_minimo)) {
          rows.push({
            id: `mat-${m.id}`,
            titulo: `Estoque crítico: ${m.produto}`,
            detalhe: `Atual ${m.estoque_atual} · mínimo ${m.estoque_minimo} · sugestão ${Math.max(0, Number(m.estoque_maximo) - Number(m.estoque_atual))} ${m.unidade ?? "un"}`,
            tipo: "estoque",
            severidade: "alta",
            to: "/operacao/materiais",
          });
        }
      }

      for (const a of amostras.data ?? []) {
        rows.push({
          id: `amo-${a.id}`,
          titulo: `Amostra atrasada: ${a.operacao_amostras?.codigo ?? ""}`,
          detalhe: `${a.operacao_amostras?.produto ?? "Amostra"} · ${a.responsavel_nome ?? "sem responsável"} · prevista ${fmtDate(a.previsao_devolucao)}`,
          tipo: "amostra",
          severidade: "alta",
          data: a.previsao_devolucao,
          to: "/operacao/amostras",
        });
      }

      for (const t of tasks.data ?? []) {
        rows.push({
          id: `task-${t.id}`,
          titulo: `Follow-up pendente: ${t.titulo}`,
          detalhe: `${t.tipo} · prazo ${new Date(t.due_at).toLocaleString("pt-BR")}`,
          tipo: "followup",
          severidade: new Date(t.due_at) < new Date() ? "alta" : "media",
          data: t.due_at,
          to: "/meu-dia",
        });
      }

      for (const o of ars.data ?? []) {
        rows.push({
          id: `ar-${o.id}`,
          titulo: `AR ${o.ar_status}: orçamento ${o.numero}`,
          detalhe: `${o.clientes?.nome ?? "Cliente"} · valor orçado ${(Number(o.valor_orcado) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`,
          tipo: "ar",
          severidade: o.ar_status === "divergente" ? "critica" : "alta",
          to: "/orcamentos/controle",
        });
      }

      const peso = { critica: 0, alta: 1, media: 2 };
      return rows.sort((a, b) => peso[a.severidade] - peso[b.severidade]);
    },
  });

  const rows = alertas.data ?? [];
  const criticos = rows.filter((a) => a.severidade === "critica").length;
  const altas = rows.filter((a) => a.severidade === "alta").length;
  const medias = rows.filter((a) => a.severidade === "media").length;

  return (
    <div>
      <PageHeader
        title="Alertas Operacionais"
        description="Pendências que podem travar a rotina da loja: manutenção, compras, estoque, amostras, follow-ups e AR."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Mini label="Total" value={rows.length.toLocaleString("pt-BR")} />
        <Mini label="Críticos" value={criticos.toLocaleString("pt-BR")} tone={criticos ? "critical" : "healthy"} />
        <Mini label="Altos" value={altas.toLocaleString("pt-BR")} tone={altas ? "attention" : "healthy"} />
        <Mini label="Médios" value={medias.toLocaleString("pt-BR")} />
      </div>

      <Card>
        <CardContent className="p-0">
          {alertas.isLoading && <div className="p-8 text-center text-muted-foreground">Carregando alertas...</div>}
          {!alertas.isLoading && rows.length === 0 && (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-9 w-9 mx-auto text-emerald-600 mb-2" />
              <div className="text-sm font-medium">Sem alertas operacionais</div>
              <div className="text-xs text-muted-foreground mt-1">Rotina, manutenção, carteira e compras estão sem pendências críticas nos filtros atuais.</div>
            </div>
          )}
          <div className="divide-y">
            {rows.map((a) => (
              <div key={a.id} className="p-4 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", iconBg(a.severidade))}>
                  <TipoIcon tipo={a.tipo} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.titulo}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.detalhe}</div>
                </div>
                <Badge variant="outline" className={cn("capitalize", badgeCls(a.severidade))}>{a.severidade}</Badge>
                <Link to={a.to as any}><Button size="sm" variant="ghost">Abrir</Button></Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TipoIcon({ tipo }: { tipo: Alerta["tipo"] }) {
  const cls = "h-4 w-4";
  if (tipo === "manutencao") return <Wrench className={cls} />;
  if (tipo === "compra") return <ShoppingCart className={cls} />;
  if (tipo === "estoque" || tipo === "amostra") return <Package className={cls} />;
  if (tipo === "followup") return <CalendarClock className={cls} />;
  if (tipo === "planejamento") return <CalendarRange className={cls} />;
  return <AlertTriangle className={cls} />;
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "healthy" | "attention" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone && `text-[var(--status-${tone})]`)}>{value}</div>
    </CardContent></Card>
  );
}

function iconBg(severidade: Alerta["severidade"]) {
  if (severidade === "critica") return "bg-[var(--status-critical-soft)] text-[var(--status-critical)]";
  if (severidade === "alta") return "bg-[var(--status-attention-soft)] text-[var(--status-attention)]";
  return "bg-primary/10 text-primary";
}

function badgeCls(severidade: Alerta["severidade"]) {
  if (severidade === "critica") return "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]";
  if (severidade === "alta") return "border-[var(--status-attention)]/30 bg-[var(--status-attention-soft)] text-[var(--status-attention)]";
  return "border-primary/30 bg-primary/10 text-primary";
}
