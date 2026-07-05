import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Target, Receipt, FileSpreadsheet, Upload, Wallet, UserCheck, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, Users, UserSquare2, GraduationCap, Activity, TrendingDown, ArrowRightLeft, Store,
} from "lucide-react";
import { useGlobalFilters } from "@/lib/global-filters";
import { KpiSkeletonGrid } from "@/components/data-states";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

// ────────────────────────────────────────────────────────────────────────────
// Paleta executiva — cores resolvidas via CSS custom properties (oklch).
// Usar var(--token) direto (NÃO embrulhar em hsl(); os tokens já são oklch).
// ────────────────────────────────────────────────────────────────────────────
const CHART = {
  vendido: "var(--status-healthy)",     // verde — fechado/positivo
  orcado: "var(--primary)",             // azul — orçado/neutro forte
  aberto: "var(--status-attention)",    // âmbar — em aberto
  perdido: "var(--status-critical)",    // vermelho suave — perdido
  parcial: "var(--chart-4)",            // azul claro — parcial
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  cardBg: "var(--card)",
} as const;

const STATUS_COLOR: Record<string, string> = {
  Vendido: CHART.vendido,
  Orçado: CHART.orcado,
  Aberto: CHART.aberto,
  Parcial: CHART.parcial,
  Perdido: CHART.perdido,
};

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtDelta(n: number) {
  if (!isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${(n * 100).toFixed(1)}%`;
}

type Tone = "primary" | "success" | "attention" | "risk" | "critical";

function Dashboard() {
  const { periodo, inicioISO, fimISO, lojaId } = useGlobalFilters();

  // Período anterior (mesma janela imediatamente anterior).
  const previo = useMemo(() => {
    const fim = new Date(`${inicioISO}T00:00:00`);
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - periodo);
    return { iniISO: ini.toISOString().slice(0, 10), fimISO: fim.toISOString().slice(0, 10) };
  }, [inicioISO, periodo]);

  const orcamentos = useQuery({
    queryKey: ["dash-orcamentos", inicioISO, fimISO, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("id,valor_orcado,valor_vendido,status,data_orcamento,loja_id,lojas(nome),especificadores(id,nome)")
        .gte("data_orcamento", inicioISO)
        .lte("data_orcamento", fimISO);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const orcamentosPrev = useQuery({
    queryKey: ["dash-orcamentos-prev", previo.iniISO, previo.fimISO, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("valor_orcado,valor_vendido,status,data_orcamento")
        .gte("data_orcamento", previo.iniISO)
        .lt("data_orcamento", previo.fimISO);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const especificadoresAll = useQuery({
    queryKey: ["dash-esp-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("especificadores").select("id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ["dash-counts"],
    queryFn: async () => {
      const tables = ["lojas", "vendedores", "clientes"] as const;
      const entries = await Promise.all(
        tables.map(async (t) => {
          const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
          return [t, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<typeof tables[number], number>;
    },
  });

  const k = useMemo(() => {
    const rows = orcamentos.data ?? [];
    const orcado = rows.reduce((s, r) => s + Number(r.valor_orcado), 0);
    const vendido = rows.reduce((s, r) => s + Number(r.valor_vendido), 0);
    const vendidos = rows.filter((r) => Number(r.valor_vendido) > 0);
    const conversao = rows.length ? vendidos.length / rows.length : 0;
    const ticket = vendidos.length ? vendido / vendidos.length : 0;
    const abertos = rows.filter((r) => Number(r.valor_vendido) === 0);
    const carteiraAberta = abertos.reduce((s, r) => s + Number(r.valor_orcado), 0);

    const hoje = Date.now();
    const criticos = abertos.filter((r) => {
      const dias = (hoje - new Date(r.data_orcamento).getTime()) / 86400000;
      return dias > 90;
    });

    const espAtivosSet = new Set<string>();
    rows.forEach((r) => {
      const e = r.especificadores as { id: string } | null;
      if (e?.id) espAtivosSet.add(e.id);
    });
    const espAtivos = espAtivosSet.size;
    const espTotal = especificadoresAll.data?.length ?? 0;
    const espEmRisco = Math.max(0, espTotal - espAtivos);

    return {
      orcado, vendido, conversao, ticket, carteiraAberta,
      total: rows.length, vendidos: vendidos.length,
      criticos: criticos.length, criticosValor: criticos.reduce((s, r) => s + Number(r.valor_orcado), 0),
      espAtivos, espEmRisco, espTotal,
    };
  }, [orcamentos.data, especificadoresAll.data]);

  const kPrev = useMemo(() => {
    const rows = orcamentosPrev.data ?? [];
    const orcado = rows.reduce((s, r) => s + Number(r.valor_orcado), 0);
    const vendido = rows.reduce((s, r) => s + Number(r.valor_vendido), 0);
    const vendidos = rows.filter((r) => Number(r.valor_vendido) > 0);
    const conversao = rows.length ? vendidos.length / rows.length : 0;
    const abertos = rows.filter((r) => Number(r.valor_vendido) === 0);
    const carteiraAberta = abertos.reduce((s, r) => s + Number(r.valor_orcado), 0);
    return { orcado, vendido, conversao, carteiraAberta };
  }, [orcamentosPrev.data]);

  const delta = (atual: number, anterior: number) =>
    anterior > 0 ? (atual - anterior) / anterior : (atual > 0 ? 1 : 0);

  const serieMensal = useMemo(() => {
    const rows = orcamentos.data ?? [];
    const map = new Map<string, { mes: string; orcado: number; vendido: number }>();
    rows.forEach((r) => {
      const d = new Date(r.data_orcamento);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const cur = map.get(key) ?? { mes: label, orcado: 0, vendido: 0 };
      cur.orcado += Number(r.valor_orcado);
      cur.vendido += Number(r.valor_vendido);
      map.set(key, cur);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [orcamentos.data]);

  const porStatus = useMemo(() => {
    const rows = orcamentos.data ?? [];
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.status, (m.get(r.status) ?? 0) + 1));
    const labels: Record<string, string> = { orcado: "Orçado", vendido: "Vendido", perdido: "Perdido", parcial: "Parcial" };
    const arr = [...m.entries()].map(([key, v]) => ({ name: labels[key] ?? key, value: v }));
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    return arr.map((x) => ({ ...x, pct: x.value / total }));
  }, [orcamentos.data]);

  const porLojaTop = useMemo(() => {
    const rows = orcamentos.data ?? [];
    const m = new Map<string, { nome: string; vendido: number; aberto: number; perdido: number }>();
    rows.forEach((r) => {
      const nome = (r.lojas as { nome: string } | null)?.nome ?? "Sem loja";
      const cur = m.get(nome) ?? { nome, vendido: 0, aberto: 0, perdido: 0 };
      const orc = Number(r.valor_orcado);
      const ven = Number(r.valor_vendido);
      if (r.status === "perdido") cur.perdido += orc;
      else if (ven > 0) { cur.vendido += ven; cur.aberto += Math.max(0, orc - ven); }
      else cur.aberto += orc;
      m.set(nome, cur);
    });
    return [...m.values()].sort((a, b) => (b.vendido + b.aberto + b.perdido) - (a.vendido + a.aberto + a.perdido)).slice(0, 6);
  }, [orcamentos.data]);

  const loading = orcamentos.isLoading;
  const empty = !loading && (orcamentos.data?.length ?? 0) === 0;

  const tooltipStyle = {
    background: `var(--card)`,
    border: `1px solid var(--border)`,
    borderRadius: 8,
    fontSize: 12,
    boxShadow: "0 4px 12px -4px rgb(0 0 0 / 0.08)",
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        description={`Performance comercial dos últimos ${periodo} dias${lojaId ? " · loja selecionada" : ""}.`}
      />

      {loading ? (
        <KpiSkeletonGrid />
      ) : empty ? (
        <WelcomeHome />
      ) : (
        <>
          {/* ─── KPIs HERO — 3 métricas principais ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HeroKpi
              to="/orcamentos/carteira"
              label="Valor Orçado"
              value={fmtMoney(k.orcado)}
              sub={`${fmtInt(k.total)} orçamentos no período`}
              icon={FileSpreadsheet}
              tone="primary"
              delta={delta(k.orcado, kPrev.orcado)}
            />
            <HeroKpi
              to="/orcamentos/conversao"
              label="Valor Vendido"
              value={fmtMoney(k.vendido)}
              sub={`${fmtInt(k.vendidos)} negócios fechados`}
              icon={DollarSign}
              tone="success"
              delta={delta(k.vendido, kPrev.vendido)}
            />
            <HeroKpi
              to="/orcamentos/conversao"
              label="Conversão"
              value={fmtPct(k.conversao)}
              sub={`Ticket médio ${fmtMoney(k.ticket)}`}
              icon={Target}
              tone="primary"
              delta={delta(k.conversao, kPrev.conversao)}
            />
          </div>

          {/* ─── KPIs secundários compactos ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <MiniStat label="Carteira Aberta" value={fmtMoney(k.carteiraAberta)} to="/orcamentos/carteira" />
            <MiniStat label="Em Aberto" value={fmtInt(k.total - k.vendidos)} />
            <MiniStat label="Espec. Ativos" value={fmtInt(k.espAtivos)} to="/especificadores/ativos" />
            <MiniStat label="Espec. em Risco" value={fmtInt(k.espEmRisco)} to="/especificadores/em-risco" tone={k.espEmRisco > k.espAtivos ? "risk" : "primary"} />
            <MiniStat label="Clientes" value={fmtInt(counts.data?.clientes ?? 0)} to="/cadastros/clientes" />
            <MiniStat label="Lojas" value={fmtInt(counts.data?.lojas ?? 0)} to="/cadastros/lojas" />
            <MiniStat label="Críticos > 90d" value={fmtInt(k.criticos)} to="/orcamentos/follow-up" tone={k.criticos > 5 ? "critical" : "primary"} />
          </div>

          {/* ─── Evolução mensal ─── */}
          {serieMensal.length > 1 && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-sm font-semibold tracking-tight">Evolução mensal</h2>
                  <span className="text-xs text-muted-foreground">Orçado × Vendido</span>
                </div>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={serieMensal} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: `var(--muted-foreground)` }} stroke={CHART.grid} />
                      <YAxis tick={{ fontSize: 11, fill: `var(--muted-foreground)` }} stroke={CHART.grid} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                      <Line type="monotone" dataKey="orcado" stroke={CHART.orcado} strokeWidth={2.5} name="Orçado" dot={{ r: 3, fill: CHART.orcado }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="vendido" stroke={CHART.vendido} strokeWidth={2.5} name="Vendido" dot={{ r: 3, fill: CHART.vendido }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Status + Top Lojas ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {porStatus.length > 0 && (
              <Card className="lg:col-span-2 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold mb-4 tracking-tight">Distribuição por status</h2>
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
                    <div style={{ width: 180, height: 180 }} className="shrink-0">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={porStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={52} paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
                            {porStatus.map((s, i) => <Cell key={i} fill={STATUS_COLOR[s.name] ?? CHART.orcado} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legenda customizada — sem sobreposição, com percentuais */}
                    <ul className="flex-1 w-full space-y-2 min-w-0">
                      {porStatus.map((s) => (
                        <li key={s.name} className="flex items-center gap-2.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[s.name] ?? CHART.orcado }} />
                          <span className="flex-1 truncate text-foreground">{s.name}</span>
                          <span className="tabular-nums text-muted-foreground">{fmtInt(s.value)}</span>
                          <span className="tabular-nums font-medium text-foreground w-12 text-right">{(s.pct * 100).toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
            {porLojaTop.length > 0 && (
              <Card className="lg:col-span-3 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-sm font-semibold tracking-tight">Top lojas</h2>
                    <span className="text-xs text-muted-foreground">Vendido · Aberto · Perdido</span>
                  </div>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={porLojaTop} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis dataKey="nome" tick={{ fontSize: 10, fill: `var(--muted-foreground)` }} stroke={CHART.grid} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 11, fill: `var(--muted-foreground)` }} stroke={CHART.grid} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                        <Bar dataKey="vendido" stackId="a" fill={CHART.vendido} name="Vendido" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="aberto" stackId="a" fill={CHART.aberto} name="Aberto" />
                        <Bar dataKey="perdido" stackId="a" fill={CHART.perdido} name="Perdido" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ─── Alertas — somente itens realmente críticos no topo ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-tight">Alertas & oportunidades</h2>
              <span className="text-xs text-muted-foreground">Priorizados por impacto</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <AlertCard
                tone={k.criticos > 5 ? "critical" : k.criticos > 0 ? "attention" : "healthy"}
                title="Orçamentos acima de 90 dias"
                metric={`${fmtInt(k.criticos)} críticos`}
                description={k.criticos > 0 ? `${fmtMoney(k.criticosValor)} parados na carteira.` : "Nenhum orçamento crítico."}
                icon={AlertTriangle}
                cta="Ver follow-up"
                to="/orcamentos/follow-up"
              />
              <AlertCard
                tone={k.espEmRisco > k.espAtivos ? "critical" : k.espEmRisco > 0 ? "attention" : "healthy"}
                title="Especificadores sem movimentação"
                metric={`${fmtInt(k.espEmRisco)} inativos`}
                description={`${fmtInt(k.espAtivos)} ativos no período de ${periodo} dias.`}
                icon={Users}
                cta="Reativar"
                to="/especificadores/em-risco"
              />
              <AlertCard
                tone={k.conversao < 0.15 ? "critical" : k.conversao < 0.25 ? "attention" : "healthy"}
                title="Conversão da operação"
                metric={fmtPct(k.conversao)}
                description={k.conversao < 0.25 ? "Abaixo do esperado (25%). Reveja follow-up." : "Conversão saudável."}
                icon={Target}
                cta="Analisar"
                to="/orcamentos/conversao"
              />
              <AlertCard
                tone="neutral"
                title="Especificadores em queda"
                metric="Análise IA"
                description="Profissionais com queda vs. período anterior."
                icon={TrendingDown}
                cta="Ver detalhes"
                to="/especificadores/em-risco"
              />
              <AlertCard
                tone="neutral"
                title="Transferências sem resultado"
                metric="Acompanhamento"
                description="Avalie transferências de carteira nos últimos 30/60/90 dias."
                icon={ArrowRightLeft}
                cta="Abrir"
                to="/especificadores/transferencias"
              />
              <AlertCard
                tone="neutral"
                title="Performance por loja"
                metric={`${fmtInt(counts.data?.lojas ?? 0)} lojas`}
                description="Compare conversão, ticket médio e crescimento."
                icon={Store}
                cta="Ranking"
                to="/performance/lojas"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hero KPI — métrica principal, com delta vs período anterior
// ────────────────────────────────────────────────────────────────────────────
function HeroKpi({
  to, label, value, sub, icon: Icon, tone = "primary", delta,
}: { to: string; label: string; value: string; sub: string; icon: ComponentType<{ className?: string }>; tone?: Tone; delta: number }) {
  const positive = delta > 0.001;
  const negative = delta < -0.001;
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const deltaColor = positive
    ? "text-[var(--status-healthy)] bg-[var(--status-healthy-soft)]"
    : negative
      ? "text-[var(--status-critical)] bg-[var(--status-critical-soft)]"
      : "text-muted-foreground bg-muted";

  return (
    <Link to={to} className="group block">
      <Card className="h-full border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", toneBgClass(tone))}>
              <Icon className="h-5 w-5" />
            </div>
            <div className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums", deltaColor)}>
              <DeltaIcon className="h-3 w-3" />
              {fmtDelta(delta)}
            </div>
          </div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{label}</div>
          <div className="text-2xl lg:text-3xl font-semibold tabular-nums text-foreground leading-tight tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground mt-2 truncate">{sub}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MiniStat({ label, value, to, tone = "primary" }: { label: string; value: string; to?: string; tone?: Tone | "risk" }) {
  const valueColor =
    tone === "critical" ? "text-[var(--status-critical)]" :
    tone === "risk" ? "text-[var(--status-risk)]" :
    "text-foreground";
  const inner = (
    <Card className={cn("border-border/60 shadow-none transition", to && "hover:border-primary/30 hover:shadow-sm cursor-pointer")}>
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</div>
        <div className={cn("text-base font-semibold tabular-nums mt-1", valueColor)}>{value}</div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

type AlertTone = "healthy" | "attention" | "critical" | "neutral";

function AlertCard({
  tone, title, metric, description, icon: Icon, cta, to,
}: { tone: AlertTone; title: string; metric: string; description: string; icon: ComponentType<{ className?: string }>; cta: string; to: string }) {
  // Apenas críticos recebem destaque vermelho na barra lateral.
  // Atenção usa âmbar discreto; healthy e neutral ficam sóbrios.
  const accent = {
    healthy: "border-l-transparent",
    attention: "border-l-[var(--status-attention)]",
    critical: "border-l-[var(--status-critical)]",
    neutral: "border-l-transparent",
  }[tone];
  const iconColor = {
    healthy: "text-[var(--status-healthy)] bg-[var(--status-healthy-soft)]",
    attention: "text-[var(--status-attention)] bg-[var(--status-attention-soft)]",
    critical: "text-[var(--status-critical)] bg-[var(--status-critical-soft)]",
    neutral: "text-muted-foreground bg-muted",
  }[tone];
  return (
    <Card className={cn("border-l-4 border-border/60 shadow-sm hover:shadow-md transition-shadow", accent)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold tabular-nums text-foreground">{metric}</div>
        </div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-3">
          {cta} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function toneBgClass(tone: Tone) {
  switch (tone) {
    case "success": return "bg-[var(--status-healthy-soft)] text-[var(--status-healthy)]";
    case "attention": return "bg-[var(--status-attention-soft)] text-[var(--status-attention)]";
    case "risk": return "bg-[var(--status-risk-soft)] text-[var(--status-risk)]";
    case "critical": return "bg-[var(--status-critical-soft)] text-[var(--status-critical)]";
    default: return "bg-primary/10 text-primary";
  }
}

// Re-export to silence unused icon warnings (used in future phases)
export const _icons = { GraduationCap, UserSquare2, Activity, Receipt, Wallet, UserCheck };

function WelcomeHome() {
  const steps = [
    { n: 1, title: "Importar base de orçamentos", desc: "Carregue sua planilha de orçamentos para alimentar os indicadores.", to: "/importacao/orcamentos", cta: "Importar orçamentos", icon: Upload },
    { n: 2, title: "Importar base de vendas", desc: "Suba o histórico de vendas para calcular conversão e ticket.", to: "/importacao/vendas", cta: "Importar vendas", icon: Receipt },
    { n: 3, title: "Configurar lojas", desc: "Cadastre suas unidades e regiões para segmentar a operação.", to: "/cadastros/lojas", cta: "Cadastrar lojas", icon: Store },
    { n: 4, title: "Configurar usuários", desc: "Convide vendedores, gerentes e admins com os perfis corretos.", to: "/admin/usuarios", cta: "Gerenciar usuários", icon: Users },
  ] as const;
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/40 p-8 lg:p-12">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-4">
          <Activity className="h-3.5 w-3.5" /> Primeiros passos
        </div>
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">Bem-vindo ao Varejo 360</h2>
        <p className="text-muted-foreground mt-2">
          Siga estas 4 etapas para configurar sua operação e desbloquear o dashboard executivo, performance e forecast.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
        {steps.map((s) => (
          <div key={s.n} className="group flex items-start gap-4 rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {s.n}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                {s.title}
              </div>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{s.desc}</p>
              <Link to={s.to}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  {s.cta}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
