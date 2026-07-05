import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gerarForecast } from "@/lib/forecast.functions";
import { Sparkles, TrendingUp } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/performance/forecast")({
  component: Page,
});

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtMes(s: string) { const [y, m] = s.split("-"); return `${m}/${y.slice(2)}`; }

function Page() {
  const run = useServerFn(gerarForecast);
  const [escopo, setEscopo] = useState<"global" | "loja" | "vendedor">("global");
  const [escopoId, setEscopoId] = useState<string | null>(null);
  const [horizonte, setHorizonte] = useState(3);
  const [result, setResult] = useState<Awaited<ReturnType<typeof gerarForecast>> | null>(null);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id,nome").order("nome")).data ?? [],
  });
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-min"],
    queryFn: async () => (await supabase.from("vendedores").select("id,nome").order("nome")).data ?? [],
  });

  const m = useMutation({
    mutationFn: () => run({ data: { escopo, escopo_id: escopoId, horizonte_meses: horizonte } }),
    onSuccess: (r) => setResult(r),
  });

  const chartData = result
    ? [
        ...result.historico.map((h) => ({ mes: fmtMes(h.mes), real: h.valor, previsto: null, banda: null })),
        ...result.projecao.map((p) => ({
          mes: fmtMes(p.mes),
          real: null,
          previsto: p.previsto,
          banda: [p.pessimista, p.otimista],
        })),
      ]
    : [];

  const totalProjetado = result?.projecao.reduce((s, p) => s + p.previsto, 0) ?? 0;
  const mediaHist = result && result.historico.length > 0
    ? result.historico.slice(-3).reduce((s, h) => s + h.valor, 0) / Math.min(3, result.historico.length)
    : 0;
  const tendencia = mediaHist > 0 ? ((totalProjetado / horizonte) / mediaHist - 1) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Forecast de Vendas" description="Projeção dos próximos meses usando regressão linear com ajuste sazonal." />

      <Card>
        <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={escopo} onValueChange={(v) => { setEscopo(v as typeof escopo); setEscopoId(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Toda a rede</SelectItem>
              <SelectItem value="loja">Por loja</SelectItem>
              <SelectItem value="vendedor">Por vendedor</SelectItem>
            </SelectContent>
          </Select>
          {escopo === "loja" && (
            <Select value={escopoId ?? ""} onValueChange={setEscopoId}>
              <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
              <SelectContent>{lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {escopo === "vendedor" && (
            <Select value={escopoId ?? ""} onValueChange={setEscopoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
              <SelectContent>{vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={String(horizonte)} onValueChange={(v) => setHorizonte(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 6, 12].map((n) => <SelectItem key={n} value={String(n)}>Horizonte: {n} {n === 1 ? "mês" : "meses"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />{m.isPending ? "Calculando..." : "Gerar forecast"}
          </Button>
        </CardContent>
      </Card>

      {result?.msg && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{result.msg}</CardContent></Card>
      )}

      {result && result.projecao.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi label="Projeção total" value={fmtMoney(totalProjetado)} />
            <Kpi label="Média mensal projetada" value={fmtMoney(totalProjetado / horizonte)} />
            <Kpi
              label="Tendência vs. últimos 3m"
              value={`${tendencia >= 0 ? "+" : ""}${tendencia.toFixed(1)}%`}
              cls={tendencia >= 0 ? "text-green-700" : "text-red-700"}
            />
            <Kpi
              label="Acurácia anterior (MAPE)"
              value={result.mape != null ? `${result.mape.toFixed(1)}%` : "—"}
              cls="text-muted-foreground"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />Histórico × Projeção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number | number[]) => Array.isArray(v) ? `${fmtMoney(v[0])} – ${fmtMoney(v[1])}` : fmtMoney(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="banda" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.15} name="Faixa otimista/pessimista" />
                  <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2} name="Histórico real" connectNulls={false} dot />
                  <Line type="monotone" dataKey="previsto" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 4" name="Previsto" connectNulls={false} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Detalhamento mensal</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Mês</th><th className="py-2 text-right">Pessimista</th><th className="py-2 text-right">Previsto</th><th className="py-2 text-right">Otimista</th></tr>
                </thead>
                <tbody>
                  {result.projecao.map((p) => (
                    <tr key={p.mes} className="border-b">
                      <td className="py-2">{fmtMes(p.mes)}</td>
                      <td className="py-2 text-right text-muted-foreground">{fmtMoney(p.pessimista)}</td>
                      <td className="py-2 text-right font-semibold">{fmtMoney(p.previsto)}</td>
                      <td className="py-2 text-right text-muted-foreground">{fmtMoney(p.otimista)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${cls ?? ""}`}>{value}</div>
    </Card>
  );
}
