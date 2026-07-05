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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, Download, Loader2, TrendingDown, UserX } from "lucide-react";
import {
  TurnoverFiltersBar,
  useTurnoverFilters,
} from "@/lib/turnover-filters";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/_authenticated/turnover/alertas")({
  component: AlertasPage,
});

type EventoRow = {
  vendedor_id: string;
  vendedor_nome: string;
  especificador_id: string;
  especificador_nome: string | null;
  valor_antes: number;
  valor_depois: number;
  orcado_antes: number;
  orcado_depois: number;
  classificacao:
    | "recuperacao_total"
    | "recuperacao_parcial"
    | "sem_recuperacao"
    | "sem_base";
};

type EspecRow = {
  especificador_id: string;
  especificador_nome: string;
  loja_origem_nome: string | null;
  loja_atual_nome: string | null;
  vendedor_origem_id: string | null;
  vendedor_origem_nome: string | null;
  valor_antes: number;
  valor_depois: number;
  orcado_antes?: number;
  orcado_depois?: number;
  delta_pct: number;
  migrou: boolean;
  trocou_vendedor: boolean;
};

type Parametros = {
  alerta_queda_sem_turnover_pct: number;
  alerta_queda_conversao_pp: number;
  alerta_carteira_nao_recuperada_pct: number;
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

function AlertasPage() {
  const { dataInicio, dataFim, lojaId } = useTurnoverFilters();

  const params = useQuery({
    queryKey: ["turnover", "parametros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnover_parametros")
        .select(
          "alerta_queda_sem_turnover_pct, alerta_queda_conversao_pp, alerta_carteira_nao_recuperada_pct",
        )
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Parametros | null;
    },
  });

  const eventos = useQuery({
    queryKey: ["turnover", "eventos-carteira", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "turnover_eventos_carteira",
        { p_inicio: dataInicio, p_fim: dataFim, p_loja: lojaId },
      );
      if (error) throw error;
      return (data ?? []) as EventoRow[];
    },
  });

  const especs = useQuery({
    queryKey: ["turnover", "especificadores", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "turnover_especificadores_migracao",
        { p_inicio: dataInicio, p_fim: dataFim, p_loja: lojaId },
      );
      if (error) throw error;
      return (data ?? []) as EspecRow[];
    },
  });

  const alertas = useMemo(() => {
    const p = params.data;
    const limCarteira = p?.alerta_carteira_nao_recuperada_pct ?? 50;
    const limQueda = p?.alerta_queda_sem_turnover_pct ?? 40;

    // Agrupa eventos por vendedor
    const porVend = new Map<
      string,
      { nome: string; total: number; sem: number; perdaValor: number }
    >();
    for (const e of eventos.data ?? []) {
      const cur =
        porVend.get(e.vendedor_id) ?? {
          nome: e.vendedor_nome,
          total: 0,
          sem: 0,
          perdaValor: 0,
        };
      cur.total += 1;
      if (e.classificacao === "sem_recuperacao") {
        cur.sem += 1;
        cur.perdaValor +=
          Number(e.valor_antes || 0) - Number(e.valor_depois || 0);
      }
      porVend.set(e.vendedor_id, cur);
    }

    const vendedoresCriticos = [...porVend.entries()]
      .map(([id, v]) => ({
        id,
        nome: v.nome,
        pct: v.total > 0 ? (v.sem / v.total) * 100 : 0,
        sem: v.sem,
        total: v.total,
        perda: v.perdaValor,
      }))
      .filter((v) => v.pct >= limCarteira && v.total >= 3)
      .sort((a, b) => b.pct - a.pct);

    // IDs de especificadores que aparecem em eventos (já têm turnover associado)
    const especComTurnover = new Set(
      (eventos.data ?? []).map((e) => e.especificador_id),
    );

    const quedaSemTurnover = (especs.data ?? [])
      .filter(
        (e) =>
          !especComTurnover.has(e.especificador_id) &&
          Number(e.valor_antes) > 0 &&
          Number(e.delta_pct) <= -limQueda,
      )
      .sort((a, b) => Number(a.delta_pct) - Number(b.delta_pct))
      .slice(0, 50);

    return { vendedoresCriticos, quedaSemTurnover };
  }, [eventos.data, especs.data, params.data]);

  const loading = params.isLoading || eventos.isLoading || especs.isLoading;

  if (loading) {
    return (
      <div className="space-y-4">
        <TurnoverFiltersBar />
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Avaliando alertas…
        </div>
      </div>
    );
  }

  const totalAlertas =
    alertas.vendedoresCriticos.length + alertas.quedaSemTurnover.length;

  return (
    <div className="space-y-4">
      <TurnoverFiltersBar />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alertas ativos
              </CardTitle>
              <CardDescription>
                Calculados pelos limiares definidos em Parâmetros.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-base px-3 py-1">
              {totalAlertas}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={totalAlertas === 0}
              onClick={() => {
                const rows = [
                  ...alertas.vendedoresCriticos.map((v) => ({
                    Tipo: "Vendedor crítico",
                    Nome: v.nome,
                    Detalhe: `${v.sem}/${v.total} sem recuperação`,
                    Métrica: `${v.pct.toFixed(0)}%`,
                    "Perda estimada": v.perda.toFixed(2),
                  })),
                  ...alertas.quedaSemTurnover.map((e) => ({
                    Tipo: "Especificador em queda",
                    Nome: e.especificador_nome,
                    Detalhe: `${e.loja_origem_nome ?? ""} · vend: ${e.vendedor_origem_nome ?? ""}`,
                    Métrica: `${Number(e.delta_pct).toFixed(0)}%`,
                    "Perda estimada": (Number(e.valor_antes) - Number(e.valor_depois)).toFixed(2),
                  })),
                ];
                downloadCSV(`turnover-alertas-${dataInicio}_a_${dataFim}`, rows);
              }}
            >
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={totalAlertas === 0}
              onClick={() => {
                const rows = [
                  ...alertas.vendedoresCriticos.map((v) => ({
                    Tipo: "Vendedor crítico",
                    Nome: v.nome,
                    Detalhe: `${v.sem}/${v.total} sem recuperação`,
                    Métrica: `${v.pct.toFixed(0)}%`,
                    "Perda estimada": v.perda.toFixed(2),
                  })),
                  ...alertas.quedaSemTurnover.map((e) => ({
                    Tipo: "Especificador em queda",
                    Nome: e.especificador_nome,
                    Detalhe: `${e.loja_origem_nome ?? ""} · vend: ${e.vendedor_origem_nome ?? ""}`,
                    Métrica: `${Number(e.delta_pct).toFixed(0)}%`,
                    "Perda estimada": (Number(e.valor_antes) - Number(e.valor_depois)).toFixed(2),
                  })),
                ];
                downloadPDF(`turnover-alertas-${dataInicio}_a_${dataFim}`, rows, {
                  title: "Turnover · Alertas ativos",
                  subtitle: `Período: ${dataInicio} a ${dataFim}`,
                });
              }}
            >
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={["vend", "esp"]} className="space-y-3">
        <AccordionItem value="vend" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-rose-600" />
              <span className="font-medium">
                Vendedores com carteira não recuperada
              </span>
              <Badge variant="outline" className="ml-2">
                {alertas.vendedoresCriticos.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {alertas.vendedoresCriticos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum vendedor crítico no período.
              </p>
            ) : (
              <ul className="divide-y">
                {alertas.vendedoresCriticos.map((v) => (
                  <li key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{v.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.sem} de {v.total} especificadores sem recuperação ·
                        perda estimada {fmtBRL(v.perda)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="bg-rose-500/15 text-rose-600 border-rose-500/30"
                      >
                        {v.pct.toFixed(0)}% sem recuperação
                      </Badge>
                      <div className="text-xs text-muted-foreground max-w-[260px]">
                        <strong>Ação sugerida:</strong> reatribuir carteira e
                        agendar reativação dos especificadores em queda.
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="esp" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              <span className="font-medium">
                Especificadores em queda sem turnover associado
              </span>
              <Badge variant="outline" className="ml-2">
                {alertas.quedaSemTurnover.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {alertas.quedaSemTurnover.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum especificador em queda significativa sem turnover.
              </p>
            ) : (
              <ul className="divide-y">
                {alertas.quedaSemTurnover.map((e) => (
                  <li
                    key={e.especificador_id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-medium">
                        {e.especificador_nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.loja_origem_nome ?? "—"}
                        {e.migrou && e.loja_atual_nome
                          ? ` → ${e.loja_atual_nome}`
                          : ""}{" "}
                        · vendedor: {e.vendedor_origem_nome ?? "—"} ·{" "}
                        {fmtBRL(Number(e.valor_antes))} →{" "}
                        {fmtBRL(Number(e.valor_depois))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="bg-amber-500/15 text-amber-600 border-amber-500/30"
                      >
                        {Number(e.delta_pct).toFixed(0)}%
                      </Badge>
                      <div className="text-xs text-muted-foreground max-w-[260px]">
                        <strong>Ação sugerida:</strong> investigar causa
                        externa (concorrente, preço) e abrir contato direto.
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
