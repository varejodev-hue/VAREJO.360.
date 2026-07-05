import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, AlertTriangle, UserX, RotateCcw } from "lucide-react";
import { useGlobalFilters } from "@/lib/global-filters";
import { EmptyState } from "@/components/data-states";
import { fetchEspecificadoresSegmentados, type Segmento } from "@/lib/especificadores-segmentation";
import { cn } from "@/lib/utils";

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${(n * 100).toFixed(0)}%`; }
function fmtDate(s: string | null) { if (!s) return "—"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; }

const META: Record<Segmento, { title: string; description: string; icon: typeof UserCheck; tone: string; cls: string }> = {
  "ativos":      { title: "Especificadores Ativos",     description: "Com movimentação nos últimos 60 dias.",   icon: UserCheck,    tone: "healthy",   cls: "text-[var(--status-healthy)] bg-[var(--status-healthy-soft)]" },
  "em-risco":    { title: "Especificadores em Risco",   description: "Última movimentação entre 60 e 180 dias.", icon: AlertTriangle, tone: "risk",      cls: "text-[var(--status-risk)] bg-[var(--status-risk-soft)]" },
  "inativos":    { title: "Especificadores Inativos",   description: "Sem movimentação há mais de 180 dias.",    icon: UserX,         tone: "critical",  cls: "text-[var(--status-critical)] bg-[var(--status-critical-soft)]" },
  "recuperados": { title: "Especificadores Recuperados", description: "Voltaram a movimentar após um período de inatividade.", icon: RotateCcw, tone: "primary", cls: "text-primary bg-primary/10" },
};

export function EspecificadoresSegmentList({ segmento }: { segmento: Segmento }) {
  const { lojaId } = useGlobalFilters();
  const [busca, setBusca] = useState("");
  const meta = META[segmento];
  const Icon = meta.icon;

  const { data, isLoading } = useQuery({
    queryKey: ["especificadores-seg", segmento, lojaId],
    queryFn: () => fetchEspecificadoresSegmentados(segmento, lojaId),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!busca) return data;
    const t = busca.toLowerCase();
    return data.filter((e) => e.nome.toLowerCase().includes(t));
  }, [data, busca]);

  const totals = useMemo(() => {
    const orcado = filtered.reduce((s, e) => s + e.valor_orcado, 0);
    const vendido = filtered.reduce((s, e) => s + e.valor_vendido, 0);
    return { orcado, vendido };
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title={meta.title}
        description={`${meta.description} ${filtered.length} profissionais · ${fmtMoney(totals.vendido)} vendidos`}
      />

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar especificador..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Especificador", "Última mov.", "Dias sem mov.", "Orçamentos", "Vendas", "Conversão", "Ticket médio", "Vendido"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState icon={Icon} title={`Nenhum especificador ${segmento}`} description="Sem resultados para os filtros atuais." />
                </td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-medium">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", meta.cls)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {e.nome}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(e.ultimo_orcamento)}</td>
                  <td className="p-3 tabular-nums">
                    <Badge variant="outline" className={cn("font-normal", meta.cls, "border-transparent")}>
                      {e.dias_sem_mov >= 99999 ? "—" : `${e.dias_sem_mov}d`}
                    </Badge>
                  </td>
                  <td className="p-3 tabular-nums">{e.qtd_orcamentos}</td>
                  <td className="p-3 tabular-nums">{e.qtd_vendas}</td>
                  <td className="p-3 tabular-nums">{fmtPct(e.conversao)}</td>
                  <td className="p-3 tabular-nums">{fmtMoney(e.ticket_medio)}</td>
                  <td className="p-3 tabular-nums font-medium">{fmtMoney(e.valor_vendido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
