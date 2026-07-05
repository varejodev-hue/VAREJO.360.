import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { TrendingDown, ArrowUpRight, Megaphone } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ campanha: z.string().optional() });

export const Route = createFileRoute("/_authenticated/campanhas/oportunidades")({
  validateSearch: searchSchema,
  component: OportunidadesFila,
});

function fmtMoney(n: number) { return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

type Op = {
  id: string;
  orcamento_id: string;
  campanha_id: string;
  valor_original: number;
  valor_atual: number;
  economia: number;
  economia_pct: number;
  status: string;
  itens_impactados: number;
  campanhas: { nome: string } | null;
  orcamentos: { numero: string; clientes: { nome: string } | null } | null;
  vendedores: { nome: string } | null;
  lojas: { nome: string } | null;
  especificadores: { nome: string } | null;
};

function OportunidadesFila() {
  const { campanha } = Route.useSearch();
  const { lojaId, vendedorId, especificadorId } = useGlobalFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["oportunidades-fila", campanha, lojaId, vendedorId, especificadorId],
    queryFn: async () => {
      let q = supabase
        .from("oportunidades")
        .select("id,orcamento_id,campanha_id,valor_original,valor_atual,economia,economia_pct,status,itens_impactados,campanhas(nome),orcamentos(numero,clientes(nome)),vendedores(nome),lojas(nome),especificadores(nome)")
        .order("economia", { ascending: false })
        .limit(200);
      if (campanha) q = q.eq("campanha_id", campanha);
      if (lojaId) q = q.eq("loja_id", lojaId);
      if (vendedorId) q = q.eq("vendedor_id", vendedorId);
      if (especificadorId) q = q.eq("especificador_id", especificadorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Op[];
    },
  });

  const rows = data ?? [];
  const totalEconomia = rows.reduce((s, r) => s + Number(r.economia || 0), 0);

  return (
    <div>
      <PageHeader
        title="Oportunidades de Reativação"
        description={`${rows.length} orçamentos identificados • Potencial: ${fmtMoney(totalEconomia)}`}
      />

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      {!isLoading && rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <div>
              <div className="font-medium">Nenhuma oportunidade no momento</div>
              <div className="text-sm text-muted-foreground">Crie ou recalcule uma campanha para gerar oportunidades.</div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && rows.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Orçamento</th>
                  <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                  <th className="text-left font-medium px-4 py-2.5">Vendedor</th>
                  <th className="text-left font-medium px-4 py-2.5">Campanha</th>
                  <th className="text-right font-medium px-4 py-2.5">Valor original</th>
                  <th className="text-right font-medium px-4 py-2.5">Valor atual</th>
                  <th className="text-right font-medium px-4 py-2.5">Economia</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.orcamentos?.numero ?? "—"}</td>
                    <td className="px-4 py-2.5">{r.orcamentos?.clientes?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vendedores?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.campanhas?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(Number(r.valor_original))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(Number(r.valor_atual))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {fmtMoney(Number(r.economia))}
                        <Badge variant="outline" className="ml-1 text-[10px]">{Number(r.economia_pct).toFixed(1)}%</Badge>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to="/campanhas/$id" params={{ id: r.campanha_id }} className="inline-flex items-center text-xs text-primary hover:underline">
                        Ver <ArrowUpRight className="h-3 w-3 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
