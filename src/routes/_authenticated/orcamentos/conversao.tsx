import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { useGlobalFilters } from "@/lib/global-filters";
import { Target, TrendingUp, FileSpreadsheet, DollarSign, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamentos/conversao")({
  component: Conversao,
});

type Row = {
  data_orcamento: string;
  valor_orcado: number; valor_vendido: number;
  status: string;
  lojas: { nome: string } | null;
};

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }

function Conversao() {
  const { periodo, inicioISO, lojaId } = useGlobalFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["conversao", inicioISO, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("data_orcamento,valor_orcado,valor_vendido,status,lojas(nome)")
        .gte("data_orcamento", inicioISO);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const k = useMemo(() => {
    const rows = data ?? [];
    const orcado = rows.reduce((s, r) => s + Number(r.valor_orcado), 0);
    const vendido = rows.reduce((s, r) => s + Number(r.valor_vendido), 0);
    const perdidos = rows.filter((r) => r.status === "perdido");
    const vendidosRows = rows.filter((r) => Number(r.valor_vendido) > 0);
    const abertosRows = rows.filter((r) => r.status === "orcado" || r.status === "parcial");
    return {
      total: rows.length,
      vendidos: vendidosRows.length,
      perdidos: perdidos.length,
      abertos: abertosRows.length,
      orcado, vendido,
      perdidoValor: perdidos.reduce((s, r) => s + Number(r.valor_orcado), 0),
      abertoValor: abertosRows.reduce((s, r) => s + (Number(r.valor_orcado) - Number(r.valor_vendido)), 0),
      conv: rows.length ? vendidosRows.length / rows.length : 0,
      convValor: orcado ? vendido / orcado : 0,
      ticket: vendidosRows.length ? vendido / vendidosRows.length : 0,
    };
  }, [data]);

  const porLoja = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number; vendidos: number; orcado: number; vendido: number }>();
    (data ?? []).forEach((r) => {
      const nome = r.lojas?.nome ?? "Sem loja";
      const cur = m.get(nome) ?? { nome, qtd: 0, vendidos: 0, orcado: 0, vendido: 0 };
      cur.qtd++;
      cur.orcado += Number(r.valor_orcado);
      cur.vendido += Number(r.valor_vendido);
      if (Number(r.valor_vendido) > 0) cur.vendidos++;
      m.set(nome, cur);
    });
    return [...m.values()].sort((a, b) => b.vendido - a.vendido).slice(0, 10);
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Conversão"
        description={`Funil orçado → vendido nos últimos ${periodo} dias${lojaId ? " · loja selecionada" : ""}.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={FileSpreadsheet} label="Orçamentos" value={fmtInt(k.total)} sub={fmtMoney(k.orcado)} tone="primary" />
        <Stat icon={DollarSign} label="Vendas" value={fmtInt(k.vendidos)} sub={fmtMoney(k.vendido)} tone="healthy" />
        <Stat icon={Target} label="Taxa (qtd)" value={fmtPct(k.conv)} sub={`${k.vendidos}/${k.total}`} tone={k.conv >= 0.25 ? "healthy" : k.conv >= 0.15 ? "attention" : "critical"} />
        <Stat icon={TrendingUp} label="Taxa (valor)" value={fmtPct(k.convValor)} sub={`Ticket: ${fmtMoney(k.ticket)}`} tone={k.convValor >= 0.25 ? "healthy" : k.convValor >= 0.15 ? "attention" : "critical"} />
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Funil de Conversão
          </div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando funil...</div>
          ) : k.total === 0 ? (
            <div className="text-sm text-muted-foreground">Sem orçamentos no período.</div>
          ) : (
            <div className="space-y-3">
              <FunnelBar label="Orçados" qtd={k.total} valor={k.orcado} pct={1} tone="primary" />
              <FunnelBar label="Em aberto" qtd={k.abertos} valor={k.abertoValor} pct={k.total ? k.abertos / k.total : 0} tone="attention" />
              <FunnelBar label="Vendidos" qtd={k.vendidos} valor={k.vendido} pct={k.total ? k.vendidos / k.total : 0} tone="healthy" />
              <FunnelBar label="Perdidos" qtd={k.perdidos} valor={k.perdidoValor} pct={k.total ? k.perdidos / k.total : 0} tone="critical" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-sm font-semibold">Top 10 lojas por valor vendido</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Loja", "Orçamentos", "Vendas", "Conversão", "Orçado", "Vendido", "Taxa Valor"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porLoja.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>}
              {porLoja.map((l) => {
                const conv = l.qtd ? l.vendidos / l.qtd : 0;
                const convV = l.orcado ? l.vendido / l.orcado : 0;
                return (
                  <tr key={l.nome} className="border-t">
                    <td className="p-3 font-medium">{l.nome}</td>
                    <td className="p-3 tabular-nums">{fmtInt(l.qtd)}</td>
                    <td className="p-3 tabular-nums">{fmtInt(l.vendidos)}</td>
                    <td className={cn("p-3 tabular-nums font-medium", conv >= 0.25 ? "text-[var(--status-healthy)]" : conv < 0.15 ? "text-[var(--status-critical)]" : "")}>{fmtPct(conv)}</td>
                    <td className="p-3 tabular-nums">{fmtMoney(l.orcado)}</td>
                    <td className="p-3 tabular-nums">{fmtMoney(l.vendido)}</td>
                    <td className="p-3 tabular-nums">{fmtPct(convV)}</td>
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

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Target; label: string; value: string; sub: string; tone: "primary" | "healthy" | "attention" | "critical" }) {
  const cls = {
    primary: "bg-primary/10 text-primary",
    healthy: "bg-[var(--status-healthy-soft)] text-[var(--status-healthy)]",
    attention: "bg-[var(--status-attention-soft)] text-[var(--status-attention)]",
    critical: "bg-[var(--status-critical-soft)] text-[var(--status-critical)]",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center mb-3", cls)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</div>
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, qtd, valor, pct, tone }: { label: string; qtd: number; valor: number; pct: number; tone: "primary" | "healthy" | "attention" | "critical" }) {
  const bg = {
    primary: "bg-primary",
    healthy: "bg-[var(--status-healthy)]",
    attention: "bg-[var(--status-attention)]",
    critical: "bg-[var(--status-critical)]",
  }[tone];
  const width = Math.max(4, pct * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-muted-foreground tabular-nums">{qtd} · {fmtMoney(valor)} · {(pct * 100).toFixed(1)}%</div>
      </div>
      <div className="h-7 rounded-md bg-muted overflow-hidden">
        <div className={cn("h-full transition-all flex items-center px-3 text-[11px] font-medium text-white", bg)} style={{ width: `${width}%` }}>
          {pct >= 0.1 ? `${(pct * 100).toFixed(0)}%` : ""}
        </div>
      </div>
    </div>
  );
}

export const _icons = { XCircle };
