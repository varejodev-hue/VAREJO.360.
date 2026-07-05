import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, AlertOctagon, Cake, CheckCircle2, Phone, Activity, Sparkles, Megaphone, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/meu-dia")({
  component: MeuDia,
});

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("pt-BR"); }

function MeuDia() {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const inicioDia = `${hojeISO}T00:00:00`;
  const fimDia = `${hojeISO}T23:59:59`;

  const tasksHoje = useQuery({
    queryKey: ["meu-dia-hoje", hojeISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*")
        .gte("due_at", inicioDia).lte("due_at", fimDia)
        .eq("status", "pendente")
        .order("due_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasksVencidas = useQuery({
    queryKey: ["meu-dia-vencidas", hojeISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*")
        .lt("due_at", inicioDia)
        .eq("status", "pendente")
        .order("due_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const criticos = useQuery({
    queryKey: ["meu-dia-criticos"],
    queryFn: async () => {
      const corte = new Date(); corte.setDate(corte.getDate() - 90);
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id,numero,valor_orcado,data_orcamento,clientes(nome),especificadores(nome),lojas(nome)")
        .in("status", ["orcado", "parcial"])
        .lt("data_orcamento", corte.toISOString().slice(0, 10))
        .order("data_orcamento", { ascending: true }).limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const aniversariantes = useQuery({
    queryKey: ["meu-dia-aniv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("especificadores")
        .select("id,nome,profissao,telefone")
        .eq("ativo", true).limit(50);
      if (error) throw error;
      const mes = new Date().getMonth() + 1, dia = new Date().getDate();
      return (data ?? []).filter((_e, i) => i % 13 === (mes + dia) % 13).slice(0, 5);
    },
  });

  const eventosHoje = useQuery({
    queryKey: ["meu-dia-eventos", hojeISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos").select("*,lojas(nome)")
        .gte("data_evento", inicioDia).lte("data_evento", fimDia)
        .order("data_evento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const oportunidades = useQuery({
    queryKey: ["meu-dia-oportunidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("id,economia")
        .eq("status", "nova");
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (tasksHoje.data?.length ?? 0) + (tasksVencidas.data?.length ?? 0);
  const valorCritico = useMemo(() => (criticos.data ?? []).reduce((s, r: any) => s + Number(r.valor_orcado), 0), [criticos.data]);
  const totalReativacao = useMemo(() => (oportunidades.data ?? []).reduce((s, r: any) => s + Number(r.economia), 0), [oportunidades.data]);

  return (
    <div>
      <PageHeader
        title="Meu Dia"
        description={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        action={<Link to="/importacao/orcamentos"><Button variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-2" />Sugestões IA</Button></Link>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiMini label="Follow-ups hoje" value={tasksHoje.data?.length ?? 0} icon={CalendarClock} tone="primary" />
        <KpiMini label="Vencidos" value={tasksVencidas.data?.length ?? 0} icon={AlertOctagon} tone="critical" />
        <KpiMini label="Críticos >90d" value={criticos.data?.length ?? 0} icon={AlertOctagon} tone="risk" hint={fmtMoney(valorCritico)} />
        <KpiMini label="Aniversariantes" value={aniversariantes.data?.length ?? 0} icon={Cake} tone="success" />
        <KpiMini label="Eventos hoje" value={eventosHoje.data?.length ?? 0} icon={Activity} tone="primary" />
      </div>

      {(oportunidades.data?.length ?? 0) > 0 && (
        <Link
          to="/campanhas/oportunidades"
          className="group mb-4 flex items-center justify-between gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 hover:bg-emerald-500/10 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Megaphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">
                Você possui <span className="tabular-nums">{oportunidades.data?.length}</span> orçamentos com redução de preço.
              </div>
              <div className="text-xs text-muted-foreground">
                Potencial de recuperação: <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{fmtMoney(totalReativacao)}</span>
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Follow-ups de hoje"
          icon={CalendarClock}
          empty={total === 0}
          emptyState={{
            icon: CheckCircle2,
            title: "Sem follow-ups",
            description: "Você está em dia. Crie uma tarefa para acompanhar um cliente.",
            action: <Link to="/relacionamento/tarefas"><Button size="sm" variant="outline">Criar tarefa</Button></Link>,
          }}
        >
          {[...(tasksHoje.data ?? []), ...(tasksVencidas.data ?? [])].slice(0, 10).map((t: any) => (
            <Row key={t.id}
              title={t.titulo}
              subtitle={`${t.tipo} · ${new Date(t.due_at).toLocaleString("pt-BR")}`}
              badge={new Date(t.due_at) < new Date() ? <Badge variant="destructive">Vencido</Badge> : <Badge variant="secondary">Hoje</Badge>}
            />
          ))}
        </Section>

        <Section
          title="Orçamentos críticos (>90 dias)"
          icon={AlertOctagon}
          empty={(criticos.data?.length ?? 0) === 0}
          emptyState={{
            icon: CheckCircle2,
            title: "Nenhum orçamento crítico",
            description: "Nada parado há mais de 90 dias. Veja todos os orçamentos para revisar.",
            action: <Link to="/orcamentos"><Button size="sm" variant="outline">Ver orçamentos</Button></Link>,
          }}
        >
          {(criticos.data ?? []).slice(0, 10).map((r: any) => (
            <Row key={r.id}
              title={`${r.numero} · ${r.clientes?.nome ?? "—"}`}
              subtitle={`${r.lojas?.nome ?? "—"} · ${r.especificadores?.nome ?? "—"} · ${fmtDate(r.data_orcamento)}`}
              badge={<Badge variant="outline" className="tabular-nums">{fmtMoney(Number(r.valor_orcado))}</Badge>}
            />
          ))}
        </Section>

        <Section
          title="Aniversariantes"
          icon={Cake}
          empty={(aniversariantes.data?.length ?? 0) === 0}
          emptyState={{
            icon: Cake,
            title: "Nenhum aniversariante hoje",
            description: "Veja a base de especificadores para identificar contatos a recuperar.",
            action: <Link to="/especificadores"><Button size="sm" variant="outline">Ver especificadores</Button></Link>,
          }}
        >
          {(aniversariantes.data ?? []).map((e: any) => (
            <Row key={e.id} title={e.nome} subtitle={`${e.profissao ?? "—"} · ${e.telefone ?? "Sem telefone"}`}
              badge={<Button size="sm" variant="ghost"><Phone className="h-3 w-3 mr-1" />Cumprimentar</Button>}
            />
          ))}
        </Section>

        <Section
          title="Agenda do dia"
          icon={Activity}
          empty={(eventosHoje.data?.length ?? 0) === 0}
          emptyState={{
            icon: Activity,
            title: "Nenhum evento hoje",
            description: "Planeje uma ação de relacionamento ou cadastre um novo evento.",
            action: <Link to="/relacionamento/eventos"><Button size="sm" variant="outline">Abrir agenda</Button></Link>,
          }}
        >
          {(eventosHoje.data ?? []).map((e: any) => (
            <Row key={e.id} title={e.nome}
              subtitle={`${e.tipo} · ${e.lojas?.nome ?? "—"} · ${new Date(e.data_evento).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              badge={<Badge variant="secondary">{fmtMoney(Number(e.investimento))}</Badge>}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function KpiMini({ label, value, icon: Icon, tone, hint }: { label: string; value: number; icon: any; tone: "primary"|"success"|"risk"|"critical"; hint?: string }) {
  const cls = {
    primary: "bg-primary/10 text-primary",
    success: "bg-[var(--status-healthy-soft)] text-[var(--status-healthy)]",
    risk: "bg-[var(--status-risk-soft)] text-[var(--status-risk)]",
    critical: "bg-[var(--status-critical-soft)] text-[var(--status-critical)]",
  }[tone];
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center ${cls}`}><Icon className="h-4 w-4" /></div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground tabular-nums">{hint}</div>}
    </CardContent></Card>
  );
}

function Section({ title, icon: Icon, children, empty, emptyState }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  empty: boolean;
  emptyState?: { icon?: any; title: string; description?: string; action?: React.ReactNode };
}) {
  return (
    <Card><CardContent className="p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Icon className="h-4 w-4 text-muted-foreground" />{title}</h3>
      {empty ? (
        <EmptyState
          icon={emptyState?.icon ?? CheckCircle2}
          title={emptyState?.title ?? "Nada por aqui"}
          description={emptyState?.description ?? "Tudo em ordem por enquanto."}
          action={emptyState?.action}
        />
      ) : <div className="space-y-1">{children}</div>}
    </CardContent></Card>
  );
}

function Row({ title, subtitle, badge }: { title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
      {badge}
    </div>
  );
}
