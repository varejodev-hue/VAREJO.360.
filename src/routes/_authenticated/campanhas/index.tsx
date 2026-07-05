import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, ArrowUpRight, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/campanhas/")({
  component: CampanhasList,
});

const statusTone: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  ativa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  encerrada: "bg-muted text-muted-foreground",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function CampanhasList() {
  const { data, isLoading } = useQuery({
    queryKey: ["campanhas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanhas")
        .select("id,nome,descricao,data_inicio,data_fim,status,created_at")
        .order("data_inicio", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Campanhas promocionais"
        description="Importe campanhas e o sistema identifica oportunidades em orçamentos abertos."
        action={
          <Button asChild size="sm">
            <Link to="/campanhas/nova"><Plus className="h-4 w-4 mr-1" /> Nova campanha</Link>
          </Button>
        }
      />

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      {!isLoading && (data ?? []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <div>
              <div className="font-medium">Nenhuma campanha ainda</div>
              <div className="text-sm text-muted-foreground">Crie a primeira campanha para começar a gerar oportunidades.</div>
            </div>
            <Button asChild size="sm">
              <Link to="/campanhas/nova"><Plus className="h-4 w-4 mr-1" /> Nova campanha</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && (data ?? []).length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/campanhas/$id"
              params={{ id: c.id }}
              className="group rounded-lg border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-semibold text-sm truncate">{c.nome}</div>
                <Badge variant="outline" className={statusTone[c.status] ?? ""}>{c.status}</Badge>
              </div>
              {c.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{c.descricao}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(c.data_inicio)} → {fmtDate(c.data_fim)}</span>
                <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
