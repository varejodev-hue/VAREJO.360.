import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { Store, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/lojas")({
  component: PerformanceLojas,
});

type Row = { loja_id: string | null; valor_orcado: number; valor_vendido: number; lojas: { nome: string } | null };

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }

function PerformanceLojas() {
  const { periodo, inicioISO } = useGlobalFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["perf-lojas", inicioISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("loja_id,valor_orcado,valor_vendido,lojas(nome)")
        .gte("data_orcamento", inicioISO);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; qtd: number; vendidos: number; orcado: number; vendido: number }>();
    (data ?? []).forEach((r) => {
      const id = r.loja_id ?? "—";
      const nome = r.lojas?.nome ?? "Sem loja";
      const cur = m.get(id) ?? { id, nome, qtd: 0, vendidos: 0, orcado: 0, vendido: 0 };
      cur.qtd++;
      cur.orcado += Number(r.valor_orcado);
      cur.vendido += Number(r.valor_vendido);
      if (Number(r.valor_vendido) > 0) cur.vendidos++;
      m.set(id, cur);
    });
    return [...m.values()].map((l) => ({
      ...l,
      conv: l.qtd ? l.vendidos / l.qtd : 0,
      ticket: l.vendidos ? l.vendido / l.vendidos : 0,
    })).sort((a, b) => b.vendido - a.vendido);
  }, [data]);

  const maxVendido = rows[0]?.vendido ?? 1;
  const totais = useMemo(() => ({
    orcado: rows.reduce((s, r) => s + r.orcado, 0),
    vendido: rows.reduce((s, r) => s + r.vendido, 0),
    qtd: rows.reduce((s, r) => s + r.qtd, 0),
    vendidos: rows.reduce((s, r) => s + r.vendidos, 0),
  }), [rows]);

  return (
    <div>
      <PageHeader
        title="Performance — Lojas"
        description={`${rows.length} lojas com movimentação nos últimos ${periodo} dias`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Mini label="Total Orçado" value={fmtMoney(totais.orcado)} />
        <Mini label="Total Vendido" value={fmtMoney(totais.vendido)} tone="healthy" />
        <Mini label="Conversão (qtd)" value={fmtPct(totais.qtd ? totais.vendidos / totais.qtd : 0)} />
        <Mini label="Orçamentos" value={fmtInt(totais.qtd)} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Ranking por valor vendido</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["#", "Loja", "Orçamentos", "Vendas", "Conversão", "Orçado", "Vendido", "Ticket médio", "Participação", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Sem movimentação no período.</td></tr>}
              {rows.map((l, i) => {
                const part = l.vendido / maxVendido;
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/40">
                    <td className="p-3 font-semibold text-muted-foreground tabular-nums">{i + 1}º</td>
                    <td className="p-3 font-medium">{l.nome}</td>
                    <td className="p-3 tabular-nums">{fmtInt(l.qtd)}</td>
                    <td className="p-3 tabular-nums">{fmtInt(l.vendidos)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={cn(
                        l.conv >= 0.25 && "text-[var(--status-healthy)] border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)]",
                        l.conv >= 0.15 && l.conv < 0.25 && "text-[var(--status-attention)] border-[var(--status-attention)]/40 bg-[var(--status-attention-soft)]",
                        l.conv < 0.15 && "text-[var(--status-critical)] border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)]",
                      )}>{fmtPct(l.conv)}</Badge>
                    </td>
                    <td className="p-3 tabular-nums">{fmtMoney(l.orcado)}</td>
                    <td className="p-3 tabular-nums font-medium">{fmtMoney(l.vendido)}</td>
                    <td className="p-3 tabular-nums">{fmtMoney(l.ticket)}</td>
                    <td className="p-3 w-40">
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.max(2, part * 100)}%` }} />
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Link to="/orcamentos/carteira" className="text-primary inline-flex items-center gap-1 text-xs hover:underline">
                        ver <ArrowUpRight className="h-3 w-3" />
                      </Link>
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

function Mini({ label, value, tone }: { label: string; value: string; tone?: "healthy" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone === "healthy" && "text-[var(--status-healthy)]")}>{value}</div>
    </CardContent></Card>
  );
}
