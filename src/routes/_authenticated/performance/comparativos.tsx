import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { useGlobalFilters } from "@/lib/global-filters";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/performance/comparativos")({
  component: Comparativos,
});

type Row = { data_orcamento: string; valor_orcado: number; valor_vendido: number; status: string; lojas: { nome: string } | null };

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }

function delta(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 1 : 0;
  return (atual - anterior) / anterior;
}

function Comparativos() {
  const { periodo, inicioISO, lojaId } = useGlobalFilters();

  // Período anterior: do (2*periodo) até (periodo) dias atrás
  const anteriorISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - periodo * 2);
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const { data, isLoading } = useQuery({
    queryKey: ["comparativos", anteriorISO, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("data_orcamento,valor_orcado,valor_vendido,status,lojas(nome)")
        .gte("data_orcamento", anteriorISO);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const k = useMemo(() => {
    const rows = data ?? [];
    const atual = rows.filter((r) => r.data_orcamento >= inicioISO);
    const anterior = rows.filter((r) => r.data_orcamento < inicioISO);
    function agg(rs: Row[]) {
      const orcado = rs.reduce((s, r) => s + Number(r.valor_orcado), 0);
      const vendido = rs.reduce((s, r) => s + Number(r.valor_vendido), 0);
      const vendidos = rs.filter((r) => Number(r.valor_vendido) > 0).length;
      const conv = rs.length ? vendidos / rs.length : 0;
      const ticket = vendidos ? vendido / vendidos : 0;
      return { qtd: rs.length, vendidos, orcado, vendido, conv, ticket };
    }
    return { atual: agg(atual), anterior: agg(anterior), atualRows: atual, anteriorRows: anterior };
  }, [data, inicioISO]);

  const porLoja = useMemo(() => {
    const m = new Map<string, { nome: string; atual: number; anterior: number }>();
    (k.atualRows).forEach((r) => {
      const nome = r.lojas?.nome ?? "Sem loja";
      const cur = m.get(nome) ?? { nome, atual: 0, anterior: 0 };
      cur.atual += Number(r.valor_vendido); m.set(nome, cur);
    });
    (k.anteriorRows).forEach((r) => {
      const nome = r.lojas?.nome ?? "Sem loja";
      const cur = m.get(nome) ?? { nome, atual: 0, anterior: 0 };
      cur.anterior += Number(r.valor_vendido); m.set(nome, cur);
    });
    return [...m.values()].map((x) => ({ ...x, delta: delta(x.atual, x.anterior) }))
      .sort((a, b) => b.atual - a.atual).slice(0, 15);
  }, [k]);

  return (
    <div>
      <PageHeader
        title="Comparativos de Período"
        description={`Últimos ${periodo} dias vs. ${periodo} dias anteriores${lojaId ? " · loja selecionada" : ""}`}
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando comparativo...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            <CompCard label="Valor Vendido" atual={fmtMoney(k.atual.vendido)} anterior={fmtMoney(k.anterior.vendido)} d={delta(k.atual.vendido, k.anterior.vendido)} positiveIsGood />
            <CompCard label="Valor Orçado" atual={fmtMoney(k.atual.orcado)} anterior={fmtMoney(k.anterior.orcado)} d={delta(k.atual.orcado, k.anterior.orcado)} positiveIsGood />
            <CompCard label="Conversão" atual={fmtPct(k.atual.conv)} anterior={fmtPct(k.anterior.conv)} d={delta(k.atual.conv, k.anterior.conv)} positiveIsGood />
            <CompCard label="Qtd Orçamentos" atual={fmtInt(k.atual.qtd)} anterior={fmtInt(k.anterior.qtd)} d={delta(k.atual.qtd, k.anterior.qtd)} positiveIsGood />
            <CompCard label="Qtd Vendas" atual={fmtInt(k.atual.vendidos)} anterior={fmtInt(k.anterior.vendidos)} d={delta(k.atual.vendidos, k.anterior.vendidos)} positiveIsGood />
            <CompCard label="Ticket Médio" atual={fmtMoney(k.atual.ticket)} anterior={fmtMoney(k.anterior.ticket)} d={delta(k.atual.ticket, k.anterior.ticket)} positiveIsGood />
          </div>

          <Card className="mb-6">
            <div className="p-4 border-b">
              <div className="text-sm font-semibold">Vendido por loja — atual vs. anterior</div>
            </div>
            <CardContent className="p-4">
              {porLoja.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, porLoja.length * 32)}>
                  <BarChart data={porLoja} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <YAxis type="category" dataKey="nome" width={140} className="text-xs" />
                    <Tooltip
                      formatter={(v: number) => fmtMoney(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="anterior" name="Anterior" fill="hsl(var(--muted-foreground))" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="atual" name="Atual" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <div className="text-sm font-semibold">Variação por loja (valor vendido)</div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Loja", "Período anterior", "Período atual", "Δ"].map((h) => (
                      <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porLoja.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>}
                  {porLoja.map((l) => (
                    <tr key={l.nome} className="border-t">
                      <td className="p-3 font-medium">{l.nome}</td>
                      <td className="p-3 tabular-nums">{fmtMoney(l.anterior)}</td>
                      <td className="p-3 tabular-nums font-medium">{fmtMoney(l.atual)}</td>
                      <td className={cn("p-3 tabular-nums font-medium",
                        l.delta > 0.05 && "text-[var(--status-healthy)]",
                        l.delta < -0.05 && "text-[var(--status-critical)]")}>
                        {l.delta > 0 ? "+" : ""}{fmtPct(l.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function CompCard({ label, atual, anterior, d, positiveIsGood }: { label: string; atual: string; anterior: string; d: number; positiveIsGood: boolean }) {
  const good = positiveIsGood ? d > 0.02 : d < -0.02;
  const bad = positiveIsGood ? d < -0.02 : d > 0.02;
  const Icon = Math.abs(d) < 0.02 ? Minus : d > 0 ? TrendingUp : TrendingDown;
  const tone = good ? "text-[var(--status-healthy)] bg-[var(--status-healthy-soft)]" : bad ? "text-[var(--status-critical)] bg-[var(--status-critical-soft)]" : "text-muted-foreground bg-muted";
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 tabular-nums", tone)}>
          <Icon className="h-3 w-3" />
          {d > 0 ? "+" : ""}{fmtPct(d)}
        </div>
      </div>
      <div className="text-xl font-semibold tabular-nums">{atual}</div>
      <div className="text-xs text-muted-foreground mt-1">Anterior: <span className="tabular-nums">{anterior}</span></div>
    </CardContent></Card>
  );
}
