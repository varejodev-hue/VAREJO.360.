import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { STATUS_META } from "@/lib/carteira-utils";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/historico")({
  component: Historico,
});

type Row = {
  id: string;
  tipo: string;
  motivo: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  created_at: string;
  especificadores: { nome: string } | null;
  lojas: { nome: string } | null;
  vendedor_anterior: { nome: string } | null;
  vendedor_novo: { nome: string } | null;
};

function Historico() {
  const { lojaId } = useGlobalFilters();

  const q = useQuery({
    queryKey: ["carteira", "historico", lojaId],
    queryFn: async () => {
      let query = (supabase.from as any)("carteira_movimentacoes")
        .select(`id,tipo,motivo,status_anterior,status_novo,created_at,
                 especificadores(nome), lojas(nome),
                 vendedor_anterior:vendedores!vendedor_anterior_id(nome),
                 vendedor_novo:vendedores!vendedor_novo_id(nome)`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (lojaId) query = query.eq("loja_id", lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-3 px-1">
      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40">
              <tr>
                {["Data","Especificador","Loja","Tipo","De","Para","Status","Motivo"].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sem movimentações.</td></tr>}
              {rows.map((r) => {
                const sA = r.status_anterior ? STATUS_META[r.status_anterior] : null;
                const sN = r.status_novo ? STATUS_META[r.status_novo] : null;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-2 font-medium">{r.especificadores?.nome ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.lojas?.nome ?? "—"}</td>
                    <td className="p-2 capitalize">{r.tipo.replace("_", " ")}</td>
                    <td className="p-2">{r.vendedor_anterior?.nome ?? <span className="text-muted-foreground italic">—</span>}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {r.vendedor_novo?.nome ?? <span className="text-muted-foreground italic">—</span>}
                      </div>
                    </td>
                    <td className="p-2">
                      {sA && sN && sA.label !== sN.label ? (
                        <div className="flex items-center gap-1">
                          <Badge className={sA.cls}>{sA.label}</Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge className={sN.cls}>{sN.label}</Badge>
                        </div>
                      ) : sN ? <Badge className={sN.cls}>{sN.label}</Badge> : "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">{r.motivo ?? "—"}</td>
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
