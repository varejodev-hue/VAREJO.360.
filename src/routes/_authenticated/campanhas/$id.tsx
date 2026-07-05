import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Calendar, Package, TrendingDown, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/campanhas/$id")({
  component: CampanhaDetalhe,
});

function fmtMoney(n: number) { return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("pt-BR"); }

function CampanhaDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const campanha = useQuery({
    queryKey: ["campanha", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanhas")
        .select("id,nome,descricao,data_inicio,data_fim,status")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const itens = useQuery({
    queryKey: ["campanha-itens", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanha_itens")
        .select("id,codigo_produto,preco_promocional,desconto_pct")
        .eq("campanha_id", id)
        .order("codigo_produto");
      if (error) throw error;
      return data ?? [];
    },
  });

  const oportunidades = useQuery({
    queryKey: ["campanha-ops", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("id,economia,valor_original,valor_atual,status,itens_impactados")
        .eq("campanha_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recalc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("recalcular_oportunidades_campanha", { _campanha_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oportunidades recalculadas.");
      qc.invalidateQueries({ queryKey: ["campanha-ops", id] });
      qc.invalidateQueries({ queryKey: ["oportunidades-fila"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ops = oportunidades.data ?? [];
  const totalEconomia = ops.reduce((s, o) => s + Number(o.economia || 0), 0);
  const totalImpactado = ops.reduce((s, o) => s + Number(o.valor_original || 0), 0);
  const reativadas = ops.filter((o) => o.status === "convertida").length;

  if (campanha.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!campanha.data) return <div className="text-sm text-muted-foreground">Campanha não encontrada.</div>;

  return (
    <div>
      <PageHeader
        title={campanha.data.nome}
        description={`${fmtDate(campanha.data.data_inicio)} — ${fmtDate(campanha.data.data_fim)}`}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/campanhas" })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button size="sm" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1 ${recalc.isPending ? "animate-spin" : ""}`} />
              Recalcular oportunidades
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <Kpi icon={Package} label="Itens promocionais" value={itens.data?.length ?? 0} />
        <Kpi icon={FileSpreadsheet} label="Orçamentos impactados" value={ops.length} />
        <Kpi icon={TrendingDown} label="Economia gerada" value={fmtMoney(totalEconomia)} highlight />
        <Kpi icon={Calendar} label="Reativados" value={`${reativadas} / ${ops.length}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="font-semibold text-sm mb-3">Itens promocionais</div>
            {(itens.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">Nenhum item cadastrado.</div>
            )}
            <div className="max-h-80 overflow-auto divide-y">
              {(itens.data ?? []).map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono text-xs">{i.codigo_produto}</span>
                  <span className="text-muted-foreground">
                    {i.preco_promocional != null
                      ? fmtMoney(Number(i.preco_promocional))
                      : i.desconto_pct != null
                        ? `-${i.desconto_pct}%`
                        : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">Resumo de impacto</div>
              <Link to="/campanhas/oportunidades" search={{ campanha: id }} className="text-xs text-primary hover:underline">
                Ver oportunidades →
              </Link>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Valor total impactado" value={fmtMoney(totalImpactado)} />
              <Row label="Economia gerada" value={fmtMoney(totalEconomia)} />
              <Row label="% médio de economia" value={`${totalImpactado > 0 ? ((totalEconomia / totalImpactado) * 100).toFixed(1) : "0"}%`} />
              <Row label="Status" value={<Badge variant="outline">{campanha.data.status}</Badge>} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${highlight ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
