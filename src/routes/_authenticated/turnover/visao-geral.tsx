import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, TrendingDown, TrendingUp, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  TurnoverFiltersBar,
  useTurnoverFilters,
} from "@/lib/turnover-filters";

export const Route = createFileRoute("/_authenticated/turnover/visao-geral")({
  component: VisaoGeral,
});

type EventoCarteiraRow = {
  vendedor_id: string;
  vendedor_nome: string;
  evento_data: string;
  status_vendedor: "afastamento_temporario" | "saida_confirmada";
  especificador_id: string;
  especificador_nome: string | null;
  valor_antes: number;
  valor_depois: number;
  orcado_antes: number;
  orcado_depois: number;
  vendedor_depois_id: string | null;
  vendedor_depois_nome: string | null;
  loja_depois_id: string | null;
  loja_depois_nome: string | null;
  mesma_loja: boolean;
  mesmo_vendedor: boolean;
  classificacao:
    | "recuperacao_total"
    | "recuperacao_parcial"
    | "sem_recuperacao"
    | "sem_base";
};

type Controle = {
  vendedores_ativos: number;
  especificadores: number;
  valor_antes: number;
  valor_depois: number;
  delta_pct: number;
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const CLASS_META = {
  recuperacao_total: {
    label: "Recuperação total",
    color: "hsl(142 71% 45%)",
  },
  recuperacao_parcial: {
    label: "Recuperação parcial",
    color: "hsl(38 92% 50%)",
  },
  sem_recuperacao: {
    label: "Sem recuperação",
    color: "hsl(0 84% 60%)",
  },
  sem_base: {
    label: "Sem base",
    color: "hsl(220 9% 65%)",
  },
} as const;

function VisaoGeral() {
  const { dataInicio, dataFim, lojaId } = useTurnoverFilters();

  const eventos = useQuery({
    queryKey: ["turnover", "eventos-carteira", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "turnover_eventos_carteira",
        { p_inicio: dataInicio, p_fim: dataFim, p_loja: lojaId },
      );
      if (error) throw error;
      return (data ?? []) as EventoCarteiraRow[];
    },
  });

  const controle = useQuery({
    queryKey: ["turnover", "grupo-controle", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "turnover_grupo_controle",
        { p_inicio: dataInicio, p_fim: dataFim, p_loja: lojaId },
      );
      if (error) throw error;
      const row = (data?.[0] ?? null) as Controle | null;
      return row;
    },
  });

  const resumo = useMemo(() => {
    const rows = eventos.data ?? [];
    const r = {
      vendedoresComEvento: new Set<string>(),
      especificadoresImpactados: new Set<string>(),
      valor_antes: 0,
      valor_depois: 0,
      porClass: {
        recuperacao_total: 0,
        recuperacao_parcial: 0,
        sem_recuperacao: 0,
        sem_base: 0,
      } as Record<EventoCarteiraRow["classificacao"], number>,
      saidaConfirmada: 0,
      afastamento: 0,
    };
    for (const row of rows) {
      r.vendedoresComEvento.add(row.vendedor_id);
      r.especificadoresImpactados.add(row.especificador_id);
      r.valor_antes += Number(row.valor_antes) || 0;
      r.valor_depois += Number(row.valor_depois) || 0;
      r.porClass[row.classificacao] += 1;
      if (row.status_vendedor === "saida_confirmada") r.saidaConfirmada += 1;
      else r.afastamento += 1;
    }
    const delta_pct =
      r.valor_antes > 0
        ? ((r.valor_depois - r.valor_antes) / r.valor_antes) * 100
        : 0;
    return {
      vendedoresComEvento: r.vendedoresComEvento.size,
      especificadoresImpactados: r.especificadoresImpactados.size,
      valor_antes: r.valor_antes,
      valor_depois: r.valor_depois,
      delta_pct,
      porClass: r.porClass,
      saidaConfirmada: r.saidaConfirmada,
      afastamento: r.afastamento,
    };
  }, [eventos.data]);

  const totalClass =
    resumo.porClass.recuperacao_total +
      resumo.porClass.recuperacao_parcial +
      resumo.porClass.sem_recuperacao || 1;
  const pct = (n: number) => ((n / totalClass) * 100).toFixed(1);

  const chartData = (
    [
      "recuperacao_total",
      "recuperacao_parcial",
      "sem_recuperacao",
    ] as const
  ).map((k) => ({
    name: CLASS_META[k].label,
    value: resumo.porClass[k],
    color: CLASS_META[k].color,
  }));

  const compareData = [
    { name: "Antes", value: resumo.valor_antes },
    { name: "Depois", value: resumo.valor_depois },
  ];

  if (eventos.isLoading || controle.isLoading) {
    return (
      <div className="space-y-4">
        <TurnoverFiltersBar />
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
        </div>
      </div>
    );
  }

  if (eventos.error) {
    return (
      <div className="space-y-4">
        <TurnoverFiltersBar />
        <div className="text-sm text-destructive py-6">
          Erro ao carregar: {(eventos.error as Error).message}
        </div>
      </div>
    );
  }

  const deltaImpacto = resumo.delta_pct;
  const deltaControle = controle.data?.delta_pct ?? 0;
  const diferencaVsControle = deltaImpacto - Number(deltaControle);

  return (
    <div className="space-y-4">
      <TurnoverFiltersBar />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Vendedores com evento"
          value={resumo.vendedoresComEvento}
          hint={`${resumo.saidaConfirmada} saída · ${resumo.afastamento} afastamento`}
        />
        <Kpi
          label="Especificadores impactados"
          value={resumo.especificadoresImpactados}
          hint="Carteira dos vendedores com evento"
        />
        <Kpi
          icon={deltaImpacto < 0 ? <TrendingDown className="h-4 w-4 text-rose-600" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
          label="Δ Venda antes × depois"
          value={`${deltaImpacto >= 0 ? "+" : ""}${deltaImpacto.toFixed(1)}%`}
          hint={`${fmtBRL(resumo.valor_antes)} → ${fmtBRL(resumo.valor_depois)}`}
          tone={deltaImpacto < 0 ? "text-rose-600" : "text-emerald-600"}
        />
        <Kpi
          label="Vs. grupo de controle"
          value={`${diferencaVsControle >= 0 ? "+" : ""}${diferencaVsControle.toFixed(1)} p.p.`}
          hint={`Controle: ${Number(deltaControle).toFixed(1)}% (${controle.data?.vendedores_ativos ?? 0} vend.)`}
          tone={diferencaVsControle < 0 ? "text-rose-600" : "text-emerald-600"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classificação da carteira</CardTitle>
            <CardDescription>
              Especificadores por nível de recuperação após o evento do vendedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalClass <= 1 && resumo.vendedoresComEvento === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum evento de vendedor no período selecionado.
              </p>
            ) : (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} allowDecimals={false} />
                      <Tooltip
                        formatter={(v: number) => [
                          `${v} especificadores (${pct(v)}%)`,
                          "Total",
                        ]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {chartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">
                        {d.value} ({pct(d.value)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Venda antes × depois</CardTitle>
            <CardDescription>
              Soma do valor vendido pela carteira impactada nos períodos
              comparáveis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(217 91% 60%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Antes do evento</div>
                <div className="font-semibold">
                  {fmtBRL(resumo.valor_antes)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Depois do evento</div>
                <div className="font-semibold">
                  {fmtBRL(resumo.valor_depois)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ResumoExecutivo
        resumo={resumo}
        deltaImpacto={deltaImpacto}
        deltaControle={Number(deltaControle)}
        diferencaVsControle={diferencaVsControle}
        totalClass={totalClass}
      />
    </div>
  );
}

function ResumoExecutivo({
  resumo,
  deltaImpacto,
  deltaControle,
  diferencaVsControle,
  totalClass,
}: {
  resumo: ReturnType<typeof Object> & {
    vendedoresComEvento: number;
    especificadoresImpactados: number;
    valor_antes: number;
    valor_depois: number;
    saidaConfirmada: number;
    afastamento: number;
    porClass: Record<string, number>;
  };
  deltaImpacto: number;
  deltaControle: number;
  diferencaVsControle: number;
  totalClass: number;
}) {
  if (resumo.vendedoresComEvento === 0) return null;

  const pctRT = (resumo.porClass.recuperacao_total / totalClass) * 100;
  const pctSR = (resumo.porClass.sem_recuperacao / totalClass) * 100;
  const insights: { tone: "ok" | "warn" | "bad"; text: string }[] = [];

  insights.push({
    tone: deltaImpacto < 0 ? "bad" : "ok",
    text: `Carteira impactada ${deltaImpacto >= 0 ? "cresceu" : "caiu"} ${Math.abs(deltaImpacto).toFixed(1)}% após o evento (${fmtBRL(resumo.valor_antes)} → ${fmtBRL(resumo.valor_depois)}).`,
  });
  insights.push({
    tone: diferencaVsControle < 0 ? "bad" : "ok",
    text: `Versus grupo de controle (${deltaControle.toFixed(1)}%), diferença de ${diferencaVsControle >= 0 ? "+" : ""}${diferencaVsControle.toFixed(1)} p.p. — ${diferencaVsControle < 0 ? "impacto atribuível ao turnover" : "sem perda relativa"}.`,
  });
  insights.push({
    tone: pctSR > 40 ? "bad" : pctSR > 20 ? "warn" : "ok",
    text: `${pctSR.toFixed(0)}% dos especificadores ficaram sem recuperação e ${pctRT.toFixed(0)}% tiveram recuperação total.`,
  });
  if (resumo.saidaConfirmada > 0) {
    insights.push({
      tone: "warn",
      text: `${resumo.saidaConfirmada} saída(s) confirmada(s) e ${resumo.afastamento} afastamento(s) atingiram ${resumo.especificadoresImpactados} especificadores.`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leitura executiva</CardTitle>
        <CardDescription>
          Diagnóstico automático do impacto do turnover no período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {insights.map((i, idx) => (
            <li key={idx} className="flex gap-2">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  i.tone === "bad"
                    ? "bg-rose-500"
                    : i.tone === "warn"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
