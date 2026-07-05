import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/relacionamento/roi")({
  component: RoiEventos,
});

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

type EventoRow = {
  id: string;
  nome: string;
  tipo: string;
  data_evento: string;
  investimento: number | null;
  lojas: { nome: string } | null;
  evento_participantes: { especificador_id: string | null }[] | null;
};
type OrcRow = { id: string; especificador_id: string | null; valor_orcado: number | null; valor_vendido: number | null; data_orcamento: string };

function RoiEventos() {
  const eventos = useQuery({
    queryKey: ["roi-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id,nome,tipo,data_evento,investimento,lojas(nome),evento_participantes(especificador_id)")
        .order("data_evento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventoRow[];
    },
  });

  const orcs = useQuery({
    queryKey: ["roi-orcs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id,especificador_id,valor_orcado,valor_vendido,data_orcamento");
      if (error) throw error;
      return (data ?? []) as OrcRow[];
    },
  });

  const rows = useMemo(() => {
    if (!eventos.data || !orcs.data) return [];
    return eventos.data.map((ev) => {
      const data = new Date(ev.data_evento).getTime();
      const espIds = new Set((ev.evento_participantes ?? []).map((p) => p.especificador_id).filter(Boolean) as string[]);
      const buckets = { d30: 0, d60: 0, d90: 0, d180: 0, vendido: 0, qtdOrc: 0, qtdVendas: 0 };
      orcs.data.forEach((o) => {
        if (!o.especificador_id || !espIds.has(o.especificador_id)) return;
        const dt = new Date(o.data_orcamento).getTime();
        const dias = (dt - data) / 86400000;
        if (dias < 0 || dias > 180) return;
        const orc = Number(o.valor_orcado) || 0;
        const ven = Number(o.valor_vendido) || 0;
        buckets.qtdOrc++; if (ven > 0) buckets.qtdVendas++;
        buckets.vendido += ven;
        if (dias <= 30) buckets.d30 += orc;
        if (dias <= 60) buckets.d60 += orc;
        if (dias <= 90) buckets.d90 += orc;
        if (dias <= 180) buckets.d180 += orc;
      });
      const inv = Number(ev.investimento) || 0;
      const roi = inv > 0 ? buckets.vendido / inv : 0;
      return { ev, espIds: espIds.size, ...buckets, inv, roi };
    });
  }, [eventos.data, orcs.data]);

  const loading = eventos.isLoading || orcs.isLoading;

  return (
    <div>
      <PageHeader title="ROI de Eventos" description="Acompanhe orçamentos e vendas dos participantes em janelas de 30/60/90/180 dias." />
      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Evento", "Tipo", "Data", "Loja", "Participantes", "Investido", "Orçado 30d", "Orçado 90d", "Vendido 180d", "ROI"].map(h => (
                  <th key={h} className="text-left p-3 text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={10}><EmptyState icon={TrendingUp} title="Sem eventos" description="Cadastre eventos em Agenda e adicione participantes para calcular o ROI." /></td></tr>}
              {rows.map(r => (
                <tr key={r.ev.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-medium">{r.ev.nome}</td>
                  <td className="p-3 capitalize">{r.ev.tipo}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(r.ev.data_evento).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">{r.ev.lojas?.nome ?? "—"}</td>
                  <td className="p-3 tabular-nums">{r.espIds}</td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.inv)}</td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.d30)}</td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.d90)}</td>
                  <td className="p-3 tabular-nums font-medium">{fmtMoney(r.vendido)}</td>
                  <td className="p-3"><Badge variant={r.roi >= 5 ? "default" : r.roi >= 1 ? "secondary" : "outline"}>{r.roi.toFixed(1)}x</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
