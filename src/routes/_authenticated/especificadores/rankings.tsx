import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/data-states";
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, Clock, RotateCcw, FileText, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/especificadores/rankings")({
  component: RankingsPage,
});

type Row = {
  especificador_id: string;
  nome: string;
  loja_nome: string | null;
  qtd_orcamentos: number;
  qtd_vendas: number;
  valor_orcado: number;
  valor_vendido: number;
  conversao_valor_pct: number;
  delta_valor_pct: number | null;
  dias_sem_mov: number | null;
  classificacao: string;
  posicao: number;
};

const TIPOS = [
  { value: "mais_orcam",  label: "Mais orçam",         icon: FileText },
  { value: "mais_vendem", label: "Mais vendem",        icon: Trophy },
  { value: "maior_conv",  label: "Maior conversão",    icon: TrendingUp },
  { value: "menor_conv",  label: "Menor conversão",    icon: AlertTriangle },
  { value: "maior_queda", label: "Maior queda",        icon: TrendingDown },
  { value: "recuperados", label: "Recuperados",        icon: RotateCcw },
  { value: "inativos",    label: "Inativos",           icon: Clock },
] as const;

const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n: number | null | undefined) => n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

function RankingsPage() {
  const { inicioISO, fimISO, lojaId } = useGlobalFilters();
  const [tipo, setTipo] = useState<string>("mais_vendem");
  const [limite, setLimite] = useState<number>(20);

  const { data, isLoading } = useQuery({
    queryKey: ["esp-rankings", inicioISO, fimISO, lojaId, tipo, limite],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("especificadores_rankings", {
        p_inicio: inicioISO,
        p_fim: fimISO,
        p_loja: lojaId ?? undefined,
        p_tipo: tipo,
        p_limite: limite,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const TipoIcon = TIPOS.find((t) => t.value === tipo)?.icon ?? Trophy;

  return (
    <div>
      <PageHeader title="Rankings de Especificadores" description="Top especificadores por critério no período selecionado." />

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(limite)} onValueChange={(v) => setLimite(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="ml-auto"
          disabled={!data?.length}
          onClick={() => {
            const rows = (data ?? []).map((r) => ({
              posicao: r.posicao,
              especificador: r.nome,
              loja: r.loja_nome ?? "",
              qtd_orcamentos: r.qtd_orcamentos,
              qtd_vendas: r.qtd_vendas,
              valor_orcado: r.valor_orcado,
              valor_vendido: r.valor_vendido,
              conversao_pct: r.conversao_valor_pct,
              delta_pct: r.delta_valor_pct ?? "",
              dias_sem_mov: r.dias_sem_mov ?? "",
              classificacao: r.classificacao,
            }));
            downloadCSV(`ranking-${tipo}-${new Date().toISOString().slice(0, 10)}`, rows);
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
                {["#", "Especificador", "Loja", "Orçam.", "Vendas", "Vendido", "Conversão", "Δ vs ant.", "Dias s/mov."].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <tr><td colSpan={9}>
                  <EmptyState icon={TipoIcon} title="Sem dados para este ranking" description="Ajuste o período ou troque o critério." />
                </td></tr>
              )}
              {(data ?? []).map((r) => (
                <tr key={r.especificador_id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-mono text-muted-foreground">{r.posicao}</td>
                  <td className="p-3 font-medium">{r.nome}</td>
                  <td className="p-3 text-muted-foreground">{r.loja_nome ?? "—"}</td>
                  <td className="p-3 tabular-nums">{r.qtd_orcamentos}</td>
                  <td className="p-3 tabular-nums">{r.qtd_vendas}</td>
                  <td className="p-3 tabular-nums font-medium">{fmtBRL(r.valor_vendido)}</td>
                  <td className="p-3 tabular-nums">{(r.conversao_valor_pct ?? 0).toFixed(1)}%</td>
                  <td className="p-3 tabular-nums">
                    <Badge variant="outline" className="font-normal">{fmtPct(r.delta_valor_pct)}</Badge>
                  </td>
                  <td className="p-3 tabular-nums">{r.dias_sem_mov == null ? "—" : `${r.dias_sem_mov}d`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
