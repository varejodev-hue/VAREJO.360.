import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/ajuda/historico")({
  component: Hist,
});

function Hist() {
  const { data: rows = [] } = useQuery({
    queryKey: ["novidades-hist"],
    queryFn: async () => (await supabase.from("novidades").select("*").order("publicado_em", { ascending: false })).data ?? [],
  });
  return (
    <Card><CardContent className="p-0">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Título</th><th className="text-left p-3">Módulo</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3 whitespace-nowrap">{new Date(r.publicado_em).toLocaleDateString("pt-BR")}</td>
              <td className="p-3"><Badge variant="outline" className="text-[10px]">{r.tipo}</Badge></td>
              <td className="p-3 font-medium">{r.titulo}</td>
              <td className="p-3 text-muted-foreground">{r.modulo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardContent></Card>
  );
}
