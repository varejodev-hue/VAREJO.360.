import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Flame, ThermometerSun, Snowflake, AlertOctagon, Pencil } from "lucide-react";
import { useGlobalFilters } from "@/lib/global-filters";
import { EmptyState } from "@/components/data-states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamentos/follow-up")({
  component: FollowUp,
});

type Row = {
  id: string; numero: string; data_orcamento: string;
  valor_orcado: number; valor_vendido: number;
  status: string; observacao: string | null;
  lojas: { nome: string } | null;
  vendedores: { nome: string } | null;
  especificadores: { nome: string } | null;
  clientes: { nome: string } | null;
};

type Tier = "quente" | "morno" | "frio" | "critico";
const TIER_META: Record<Tier, { label: string; icon: typeof Flame; tone: string; cls: string }> = {
  quente:  { label: "Quente (0–15d)",  icon: Flame,          tone: "healthy",   cls: "bg-[var(--status-healthy-soft)] text-[var(--status-healthy)]" },
  morno:   { label: "Morno (16–45d)",  icon: ThermometerSun, tone: "attention", cls: "bg-[var(--status-attention-soft)] text-[var(--status-attention)]" },
  frio:    { label: "Frio (46–90d)",   icon: Snowflake,      tone: "risk",      cls: "bg-[var(--status-risk-soft)] text-[var(--status-risk)]" },
  critico: { label: "Crítico (>90d)",  icon: AlertOctagon,   tone: "critical",  cls: "bg-[var(--status-critical-soft)] text-[var(--status-critical)]" },
};
function classify(dias: number): Tier {
  if (dias <= 15) return "quente";
  if (dias <= 45) return "morno";
  if (dias <= 90) return "frio";
  return "critico";
}

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtDate(s: string) { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; }

function FollowUp() {
  const { lojaId } = useGlobalFilters();
  const [busca, setBusca] = useState("");
  const [tier, setTier] = useState<Tier | "todos">("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["followup", lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("id,numero,data_orcamento,valor_orcado,valor_vendido,status,observacao,lojas(nome),vendedores(nome),especificadores(nome),clientes(nome)")
        .order("data_orcamento", { ascending: true })
        .in("status", ["orcado", "parcial"] as never[]);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const enriched = useMemo(() => {
    const hoje = Date.now();
    return (data ?? []).map((r) => {
      const dias = Math.floor((hoje - new Date(r.data_orcamento).getTime()) / 86400000);
      const aberto = Number(r.valor_orcado) - Number(r.valor_vendido);
      return { ...r, dias, aberto, tier: classify(dias) };
    });
  }, [data]);

  const buckets = useMemo(() => {
    const acc = { quente: { qtd: 0, valor: 0 }, morno: { qtd: 0, valor: 0 }, frio: { qtd: 0, valor: 0 }, critico: { qtd: 0, valor: 0 } } as Record<Tier, { qtd: number; valor: number }>;
    enriched.forEach((r) => { acc[r.tier].qtd++; acc[r.tier].valor += r.aberto; });
    return acc;
  }, [enriched]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (tier !== "todos") r = r.filter((x) => x.tier === tier);
    if (busca) {
      const t = busca.toLowerCase();
      r = r.filter((x) =>
        x.numero?.toLowerCase().includes(t) ||
        x.clientes?.nome.toLowerCase().includes(t) ||
        x.especificadores?.nome.toLowerCase().includes(t) ||
        x.vendedores?.nome.toLowerCase().includes(t) ||
        x.lojas?.nome.toLowerCase().includes(t),
      );
    }
    return r;
  }, [enriched, tier, busca]);

  const totalAberto = useMemo(() => filtered.reduce((s, r) => s + r.aberto, 0), [filtered]);

  return (
    <div>
      <PageHeader
        title="Follow-up de Orçamentos"
        description={`${filtered.length} orçamentos em aberto · ${fmtMoney(totalAberto)} a converter`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(["quente", "morno", "frio", "critico"] as Tier[]).map((t) => {
          const meta = TIER_META[t]; const Icon = meta.icon;
          const active = tier === t;
          return (
            <button key={t} onClick={() => setTier(active ? "todos" : t)} className="text-left">
              <Card className={cn("transition", active ? "ring-2 ring-primary border-primary" : "hover:border-primary/40")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", meta.cls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{meta.label}</div>
                  </div>
                  <div className="text-xl font-semibold tabular-nums">{buckets[t].qtd}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{fmtMoney(buckets[t].valor)}</div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por número, cliente, especificador, vendedor, loja..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {tier !== "todos" && (
            <Button variant="outline" size="sm" onClick={() => setTier("todos")}>Limpar classificação</Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Idade", "Número", "Data", "Cliente", "Especificador", "Vendedor", "Loja", "V.Aberto", "Status", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10}>
                  <EmptyState title="Sem orçamentos para follow-up" description="Nenhum orçamento em aberto se encaixa nos filtros atuais." />
                </td></tr>
              )}
              {filtered.map((r) => {
                const meta = TIER_META[r.tier];
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <Badge variant="outline" className={cn("gap-1 font-normal", meta.cls, "border-transparent")}>
                        {r.dias}d
                      </Badge>
                    </td>
                    <td className="p-3 font-medium">{r.numero}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(r.data_orcamento)}</td>
                    <td className="p-3">{r.clientes?.nome ?? "—"}</td>
                    <td className="p-3">{r.especificadores?.nome ?? "—"}</td>
                    <td className="p-3">{r.vendedores?.nome ?? "—"}</td>
                    <td className="p-3">{r.lojas?.nome ?? "—"}</td>
                    <td className="p-3 tabular-nums font-medium">{fmtMoney(r.aberto)}</td>
                    <td className="p-3"><Badge variant="secondary" className="capitalize">{r.status}</Badge></td>
                    <td className="p-3 text-right">
                      <Link to="/orcamentos/carteira">
                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
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
