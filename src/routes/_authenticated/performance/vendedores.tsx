import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/vendedores")({
  component: PerformanceVendedores,
});

type Row = {
  vendedor_id: string | null;
  loja_id: string | null;
  valor_orcado: number;
  valor_vendido: number;
  vendedores: { nome: string } | null;
};

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }

function PerformanceVendedores() {
  const { periodo, inicioISO, lojaId, vendedorId } = useGlobalFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["perf-vendedores", inicioISO, lojaId, vendedorId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("vendedor_id,loja_id,valor_orcado,valor_vendido,vendedores(nome)")
        .gte("data_orcamento", inicioISO);
      if (lojaId) q = q.eq("loja_id", lojaId);
      if (vendedorId) q = q.eq("vendedor_id", vendedorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; qtd: number; vendidos: number; orcado: number; vendido: number }>();
    (data ?? []).forEach((r) => {
      const id = r.vendedor_id ?? "—";
      const nome = r.vendedores?.nome ?? "Sem vendedor";
      const cur = m.get(id) ?? { id, nome, qtd: 0, vendidos: 0, orcado: 0, vendido: 0 };
      cur.qtd++;
      cur.orcado += Number(r.valor_orcado);
      cur.vendido += Number(r.valor_vendido);
      if (Number(r.valor_vendido) > 0) cur.vendidos++;
      m.set(id, cur);
    });
    return [...m.values()]
      .map((v) => ({ ...v, conv: v.qtd ? v.vendidos / v.qtd : 0, ticket: v.vendidos ? v.vendido / v.vendidos : 0 }))
      .sort((a, b) => b.vendido - a.vendido);
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
        title="Performance — Vendedores"
        description={`${rows.length} vendedores com movimentação nos últimos ${periodo} dias`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Mini label="Total Orçado" value={fmtMoney(totais.orcado)} />
        <Mini label="Total Vendido" value={fmtMoney(totais.vendido)} tone="healthy" />
        <Mini label="Conversão (qtd)" value={fmtPct(totais.qtd ? totais.vendidos / totais.qtd : 0)} />
        <Mini label="Orçamentos" value={fmtInt(totais.qtd)} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Ranking por valor vendido</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["#", "Vendedor", "Orçamentos", "Vendas", "Conversão", "Orçado", "Vendido", "Ticket médio", "Participação"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sem movimentação no período.</td></tr>}
              {rows.map((v, i) => {
                const part = v.vendido / maxVendido;
                return (
                  <tr key={v.id} className="border-t hover:bg-muted/40">
                    <td className="p-3 font-semibold text-muted-foreground tabular-nums">{i + 1}º</td>
                    <td className="p-3 font-medium">{v.nome}</td>
                    <td className="p-3 tabular-nums">{fmtInt(v.qtd)}</td>
                    <td className="p-3 tabular-nums">{fmtInt(v.vendidos)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={cn(
                        v.conv >= 0.25 && "text-[var(--status-healthy)] border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)]",
                        v.conv >= 0.15 && v.conv < 0.25 && "text-[var(--status-attention)] border-[var(--status-attention)]/40 bg-[var(--status-attention-soft)]",
                        v.conv < 0.15 && "text-[var(--status-critical)] border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)]",
                      )}>{fmtPct(v.conv)}</Badge>
                    </td>
                    <td className="p-3 tabular-nums">{fmtMoney(v.orcado)}</td>
                    <td className="p-3 tabular-nums font-medium">{fmtMoney(v.vendido)}</td>
                    <td className="p-3 tabular-nums">{fmtMoney(v.ticket)}</td>
                    <td className="p-3 w-40">
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.max(2, part * 100)}%` }} />
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

function Mini({ label, value, tone }: { label: string; value: string; tone?: "healthy" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone === "healthy" && "text-[var(--status-healthy)]")}>{value}</div>
    </CardContent></Card>
  );
}
