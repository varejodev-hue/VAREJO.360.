import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacao/amostras")({
  component: Amostras,
});

function Amostras() {
  const db = supabase as any;
  const amostras = useQuery({
    queryKey: ["operacao-amostras"],
    queryFn: async () => {
      const { data, error } = await db.from("operacao_amostras").select("*").order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = amostras.data ?? [];
  const emprestadas = rows.filter((x) => x.status === "emprestado").length;
  const atrasadas = rows.filter((x) => x.status === "atrasado").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Amostras" value={rows.length} icon={Package} />
        <Kpi label="Emprestadas" value={emprestadas} icon={Clock} />
        <Kpi label="Atrasadas" value={atrasadas} icon={AlertTriangle} />
      </div>
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-1">Controle de amostras</h2>
          <p className="text-xs text-muted-foreground mb-4">Cadastro, emprestimo, devolucao, atraso e inativacao.</p>
          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma amostra cadastrada ainda.</div>
            ) : rows.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{item.codigo} · {item.produto}</div>
                  <div className="text-xs text-muted-foreground">{item.colecao ?? "sem colecao"} · {item.localizacao ?? "sem local"}</div>
                </div>
                <Badge variant={item.status === "disponivel" ? "secondary" : "outline"}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </CardContent></Card>
  );
}
