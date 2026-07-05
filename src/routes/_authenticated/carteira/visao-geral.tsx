import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { fmtBRL, fmtInt, fmtPct, STATUS_META } from "@/lib/carteira-utils";
import { Users, UserCheck, AlertTriangle, UserX, UserMinus, Share2, AlertCircle, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/visao-geral")({
  component: VisaoGeral,
});

type Kpis = {
  total: number; ativos: number; acompanhamento: number; em_risco: number;
  inativos: number; sem_responsavel: number; compartilhados: number;
  valor_orcado: number; valor_vendido: number; conversao_pct: number; ticket_medio: number;
};
type Alerta = { tipo: string; severidade: string; mensagem: string; valor: number };

function VisaoGeral() {
  const { dataInicio, dataFim, lojaId } = useGlobalFilters();

  const kpis = useQuery({
    queryKey: ["carteira", "kpis", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_kpis", {
        p_loja: lojaId, p_vendedor: null, p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as Kpis | null;
    },
  });

  const alertas = useQuery({
    queryKey: ["carteira", "alertas", lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_alertas", { p_loja: lojaId });
      if (error) throw error;
      return (data ?? []) as Alerta[];
    },
  });

  const k = kpis.data;
  const cards = [
    { key: "total", label: "Total", value: k?.total ?? 0, icon: Users, cls: "bg-zinc-50 text-zinc-700" },
    { key: "ativos", label: "Ativas", value: k?.ativos ?? 0, icon: UserCheck, cls: STATUS_META.ativo.cls },
    { key: "em_risco", label: "Em risco", value: k?.em_risco ?? 0, icon: AlertTriangle, cls: STATUS_META.em_risco.cls },
    { key: "inativos", label: "Inativas", value: k?.inativos ?? 0, icon: UserX, cls: STATUS_META.inativo.cls },
    { key: "sem_responsavel", label: "Sem responsável", value: k?.sem_responsavel ?? 0, icon: UserMinus, cls: STATUS_META.sem_responsavel.cls },
    { key: "compartilhados", label: "Compartilhadas", value: k?.compartilhados ?? 0, icon: Share2, cls: STATUS_META.compartilhado.cls },
  ];

  return (
    <div className="space-y-5 px-1">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                  <div className="text-2xl font-semibold mt-1 tabular-nums">{fmtInt(c.value)}</div>
                </div>
                <div className={`h-9 w-9 rounded-md flex items-center justify-center ${c.cls}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Valor orçado</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">{fmtBRL(k?.valor_orcado ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Valor vendido</div>
          <div className="text-xl font-semibold mt-1 tabular-nums text-emerald-700">{fmtBRL(k?.valor_vendido ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Conversão</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">{fmtPct(k?.conversao_pct ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Ticket médio</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">{fmtBRL(k?.ticket_medio ?? 0)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <h3 className="font-medium">Alertas inteligentes</h3>
        </div>
        {alertas.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!alertas.isLoading && (alertas.data ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4" /> Nenhum alerta no momento.
          </div>
        )}
        <ul className="space-y-2">
          {(alertas.data ?? []).map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Badge className={
                a.severidade === "alta" ? "bg-rose-100 text-rose-800 border-rose-200" :
                a.severidade === "media" ? "bg-amber-100 text-amber-800 border-amber-200" :
                "bg-sky-100 text-sky-800 border-sky-200"
              }>{a.severidade}</Badge>
              <span>{a.mensagem}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
