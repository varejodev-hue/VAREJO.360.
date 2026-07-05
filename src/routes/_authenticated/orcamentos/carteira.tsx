import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { Wallet, Search, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamentos/carteira")({
  component: Carteira,
});

type Row = {
  id: string;
  numero: string;
  data_orcamento: string;
  valor_orcado: number;
  status: string;
  loja_id: string | null;
  vendedor_id: string | null;
  lojas: { nome: string } | null;
  vendedores: { nome: string } | null;
  clientes: { nome: string } | null;
};

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }
function daysSince(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function ageBucket(d: number): { label: string; tone: string } {
  if (d <= 15) return { label: "Quente", tone: "healthy" };
  if (d <= 45) return { label: "Morno", tone: "attention" };
  if (d <= 90) return { label: "Frio", tone: "critical" };
  return { label: "Crítico", tone: "critical" };
}

function Carteira() {
  const { inicioISO, lojaId, vendedorId, especificadorId } = useGlobalFilters();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["carteira", inicioISO, lojaId, vendedorId, especificadorId],
    queryFn: async () => {
      let qry = supabase
        .from("orcamentos")
        .select("id,numero,data_orcamento,valor_orcado,status,loja_id,vendedor_id,lojas(nome),vendedores(nome),clientes(nome)")
        .in("status", ["orcado", "parcial"])
        .gte("data_orcamento", inicioISO)
        .order("data_orcamento", { ascending: false })
        .limit(500);
      if (lojaId) qry = qry.eq("loja_id", lojaId);
      if (vendedorId) qry = qry.eq("vendedor_id", vendedorId);
      if (especificadorId) qry = qry.eq("especificador_id", especificadorId);
      const { data, error } = await qry;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.numero?.toLowerCase().includes(s) ||
      r.clientes?.nome?.toLowerCase().includes(s) ||
      r.lojas?.nome?.toLowerCase().includes(s) ||
      r.vendedores?.nome?.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const tot = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.valor_orcado), 0);
    const buckets = { quente: 0, morno: 0, frio: 0, critico: 0 };
    const lojaMap = new Map<string, number>();
    const vendMap = new Map<string, number>();
    rows.forEach((r) => {
      const d = daysSince(r.data_orcamento);
      const v = Number(r.valor_orcado);
      if (d <= 15) buckets.quente += v;
      else if (d <= 45) buckets.morno += v;
      else if (d <= 90) buckets.frio += v;
      else buckets.critico += v;
      lojaMap.set(r.lojas?.nome ?? "—", (lojaMap.get(r.lojas?.nome ?? "—") ?? 0) + v);
      vendMap.set(r.vendedores?.nome ?? "—", (vendMap.get(r.vendedores?.nome ?? "—") ?? 0) + v);
    });
    return { total, buckets, lojas: [...lojaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5), vends: [...vendMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Carteira de Orçamentos"
        description={`${fmtInt(rows.length)} orçamentos em aberto totalizando ${fmtMoney(tot.total)}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Mini label="Carteira total" value={fmtMoney(tot.total)} sub={`${fmtInt(rows.length)} orçamentos`} />
        <Mini label="Quente (0-15d)" value={fmtMoney(tot.buckets.quente)} tone="healthy" />
        <Mini label="Morno (16-45d)" value={fmtMoney(tot.buckets.morno)} tone="attention" />
        <Mini label="Frio (46-90d)" value={fmtMoney(tot.buckets.frio)} tone="critical" />
        <Mini label="Crítico (>90d)" value={fmtMoney(tot.buckets.critico)} tone="critical" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Top 5 Lojas em carteira</div>
          <div className="space-y-2">
            {tot.lojas.map(([nome, v]) => (
              <div key={nome} className="flex items-center gap-3">
                <div className="flex-1 text-sm truncate">{nome}</div>
                <div className="h-1.5 w-32 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(v / tot.lojas[0][1]) * 100}%` }} />
                </div>
                <div className="text-xs tabular-nums w-24 text-right">{fmtMoney(v)}</div>
              </div>
            ))}
            {tot.lojas.length === 0 && <div className="text-sm text-muted-foreground">Sem dados.</div>}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Top 5 Vendedores em carteira</div>
          <div className="space-y-2">
            {tot.vends.map(([nome, v]) => (
              <div key={nome} className="flex items-center gap-3">
                <div className="flex-1 text-sm truncate">{nome}</div>
                <div className="h-1.5 w-32 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(v / tot.vends[0][1]) * 100}%` }} />
                </div>
                <div className="text-xs tabular-nums w-24 text-right">{fmtMoney(v)}</div>
              </div>
            ))}
            {tot.vends.length === 0 && <div className="text-sm text-muted-foreground">Sem dados.</div>}
          </div>
        </CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Wallet className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Orçamentos em aberto</div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nº, cliente, loja, vendedor..." className="h-8 pl-7 w-64" />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Nº", "Data", "Idade", "Cliente", "Loja", "Vendedor", "Valor", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum orçamento em aberto.</td></tr>}
              {filtered.map((r) => {
                const d = daysSince(r.data_orcamento);
                const b = ageBucket(d);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="p-3 font-mono text-xs">{r.numero}</td>
                    <td className="p-3 text-xs text-muted-foreground tabular-nums">{new Date(r.data_orcamento).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={cn(
                        `text-[var(--status-${b.tone})] border-[var(--status-${b.tone})]/40 bg-[var(--status-${b.tone}-soft)]`,
                      )}>{d}d · {b.label}</Badge>
                    </td>
                    <td className="p-3">{r.clientes?.nome ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.lojas?.nome ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.vendedores?.nome ?? "—"}</td>
                    <td className="p-3 tabular-nums font-medium">{fmtMoney(Number(r.valor_orcado))}</td>
                    <td className="p-3 text-right">
                      <Link to="/orcamentos/carteira" className="text-primary inline-flex items-center gap-1 text-xs hover:underline">
                        abrir <ArrowUpRight className="h-3 w-3" />
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

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "healthy" | "attention" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone && `text-[var(--status-${tone})]`)}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}
