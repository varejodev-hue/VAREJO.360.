import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: Auditoria,
});

type Audit = {
  id: string;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  observacao: string | null;
  created_at: string;
};

function Auditoria() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["sgp-auditoria"],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db.from("sgp_auditoria").select("id,entidade,entidade_id,acao,observacao,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Audit[];
    },
  });

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Historico de alteracoes sensiveis para rastrear quem mudou regras, metas, planos, compras e registros operacionais."
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Ultimos registros</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Data", "Entidade", "Acao", "Referencia", "Observacao"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando auditoria...</td></tr>}
              {!isLoading && data.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum registro de auditoria ainda.</td></tr>}
              {data.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3"><Badge variant="outline">{r.entidade}</Badge></td>
                  <td className="p-3 font-medium">{r.acao}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.entidade_id ?? "-"}</td>
                  <td className="p-3">{r.observacao ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
