import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/importacao/historico")({
  component: Historico,
});

type Log = {
  id: string;
  arquivo: string;
  tipo: string;
  total_linhas: number;
  total_sucesso: number | null;
  total_erro: number | null;
  cadastros_criados: { lojas?: number; vendedores?: number; especificadores?: number; clientes?: number } | null;
  created_at: string;
};

function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Historico() {
  const { data, isLoading } = useQuery({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("id,arquivo,tipo,total_linhas,total_sucesso,total_erro,cadastros_criados,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Log[];
    },
  });

  return (
    <div>
      <PageHeader
        title="Histórico de Importações"
        description="Últimas 100 importações realizadas — controle de origem e qualidade dos dados."
        action={
          <Link to="/importacao/orcamentos">
            <Button><Upload className="h-4 w-4 mr-2" /> Nova importação</Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Data", "Arquivo", "Tipo", "Linhas", "Sucesso", "Erros", "Cadastros criados", "Status"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState icon={History} title="Nenhuma importação ainda" description="Faça uma importação para começar a popular os dados." />
                </td></tr>
              )}
              {(data ?? []).map((l) => {
                const ok = (l.total_erro ?? 0) === 0;
                const c = l.cadastros_criados ?? {};
                const created = (c.lojas ?? 0) + (c.vendedores ?? 0) + (c.especificadores ?? 0) + (c.clientes ?? 0);
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/40">
                    <td className="p-3 whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                    <td className="p-3 font-medium truncate max-w-xs">{l.arquivo}</td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{l.tipo}</Badge></td>
                    <td className="p-3 tabular-nums">{l.total_linhas}</td>
                    <td className="p-3 tabular-nums text-[var(--status-healthy)]">{l.total_sucesso ?? 0}</td>
                    <td className="p-3 tabular-nums text-[var(--status-critical)]">{l.total_erro ?? 0}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {created > 0 ? `${c.lojas ?? 0}L · ${c.vendedores ?? 0}V · ${c.especificadores ?? 0}E · ${c.clientes ?? 0}C` : "—"}
                    </td>
                    <td className="p-3">
                      {ok ? (
                        <Badge className="bg-[var(--status-healthy-soft)] text-[var(--status-healthy)] gap-1 border-transparent">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </Badge>
                      ) : (
                        <Badge className="bg-[var(--status-critical-soft)] text-[var(--status-critical)] gap-1 border-transparent">
                          <AlertCircle className="h-3 w-3" /> Com erros
                        </Badge>
                      )}
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
