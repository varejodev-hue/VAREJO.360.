import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/data-states";
import { AlertTriangle, Search, TrendingDown, ArrowRightLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/especificadores/em-risco")({
  component: EmRiscoPage,
});

type Row = {
  especificador_id: string;
  nome: string;
  loja_nome: string | null;
  vendedor_atual_nome: string | null;
  vendedor_anterior_nome: string | null;
  trocou_vendedor: boolean;
  qtd_orcamentos: number;
  qtd_vendas: number;
  valor_orcado: number;
  valor_vendido: number;
  conversao_valor_pct: number;
  ticket_medio: number;
  ultima_mov_data: string | null;
  dias_sem_mov: number | null;
  delta_valor_pct: number | null;
  classificacao: string;
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);
const fmtDate = (s: string | null) => { if (!s) return "—"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

function EmRiscoPage() {
  const { inicioISO, fimISO, lojaId } = useGlobalFilters();
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["esp-em-risco", inicioISO, fimISO, lojaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("especificadores_conversao_analise", {
        p_inicio: inicioISO,
        p_fim: fimISO,
        p_loja: lojaId ?? undefined,
        p_tipo_mov: "todos",
      });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    const risco = all.filter(
      (r) =>
        r.classificacao === "em_risco" ||
        (r.dias_sem_mov != null && r.dias_sem_mov >= 60 && r.dias_sem_mov < 180) ||
        (r.delta_valor_pct != null && r.delta_valor_pct <= -30),
    );
    if (!busca.trim()) return risco;
    const q = busca.toLowerCase();
    return risco.filter((r) => r.nome.toLowerCase().includes(q));
  }, [data, busca]);

  const totals = useMemo(() => ({
    qtd: rows.length,
    vendido: rows.reduce((s, r) => s + (r.valor_vendido || 0), 0),
    troca: rows.filter((r) => r.trocou_vendedor).length,
    queda: rows.filter((r) => (r.delta_valor_pct ?? 0) <= -30).length,
  }), [rows]);

  return (
    <div>
      <PageHeader
        title="Especificadores em Risco"
        description={`${totals.qtd} profissionais · ${fmtBRL(totals.vendido)} vendidos · ${totals.queda} com queda ≥30% · ${totals.troca} com troca de vendedor`}
      />

      <Card className="p-4 mb-4 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar especificador..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => {
            const data = rows.map((r) => ({
              especificador: r.nome,
              loja: r.loja_nome ?? "",
              ultima_mov: r.ultima_mov_data ?? "",
              dias_sem_mov: r.dias_sem_mov ?? "",
              conversao_pct: r.conversao_valor_pct,
              delta_pct: r.delta_valor_pct ?? "",
              valor_orcado: r.valor_orcado,
              valor_vendido: r.valor_vendido,
              vendedor_atual: r.vendedor_atual_nome ?? "",
              vendedor_anterior: r.vendedor_anterior_nome ?? "",
              trocou_vendedor: r.trocou_vendedor ? "sim" : "nao",
              classificacao: r.classificacao,
            }));
            downloadCSV(`especificadores-em-risco-${new Date().toISOString().slice(0, 10)}`, data);
          }}
        >
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Especificador", "Loja", "Última mov.", "Dias", "Conversão", "Δ vs ant.", "Vendido", "Vendedor", "Sinais"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={9}>
                  <EmptyState icon={AlertTriangle} title="Nenhum especificador em risco" description="Sem resultados para os filtros atuais." />
                </td></tr>
              )}
              {rows.map((r) => {
                const delta = r.delta_valor_pct;
                const conv = r.conversao_valor_pct ?? 0;
                return (
                  <tr key={r.especificador_id} className="border-t hover:bg-muted/40">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        {r.nome}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.loja_nome ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(r.ultima_mov_data)}</td>
                    <td className="p-3 tabular-nums">
                      <Badge variant="outline" className="font-normal">{r.dias_sem_mov == null ? "—" : `${r.dias_sem_mov}d`}</Badge>
                    </td>
                    <td className="p-3 tabular-nums">
                      <span className={cn(conv < 20 && "text-red-600 dark:text-red-400 font-medium")}>{conv.toFixed(1)}%</span>
                    </td>
                    <td className="p-3 tabular-nums">
                      <span className={cn((delta ?? 0) <= -30 && "text-red-600 dark:text-red-400 font-medium",
                                          (delta ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400")}>
                        {fmtPct(delta)}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums font-medium">{fmtBRL(r.valor_vendido)}</td>
                    <td className="p-3 text-xs">
                      <div>{r.vendedor_atual_nome ?? "—"}</div>
                      {r.trocou_vendedor && r.vendedor_anterior_nome && (
                        <div className="text-muted-foreground">antes: {r.vendedor_anterior_nome}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(delta ?? 0) <= -30 && (
                          <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-500/40">
                            <TrendingDown className="h-3 w-3 mr-1" />Queda
                          </Badge>
                        )}
                        {r.trocou_vendedor && (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">
                            <ArrowRightLeft className="h-3 w-3 mr-1" />Troca
                          </Badge>
                        )}
                        {conv < 20 && r.qtd_orcamentos >= 5 && (
                          <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-500/40">
                            Baixa conv.
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
