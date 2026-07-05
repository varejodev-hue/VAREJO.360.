import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda/novidades")({
  component: Novidades,
});

const TIPO_LABEL: Record<string, string> = {
  nova_funcionalidade: "Nova funcionalidade",
  melhoria: "Melhoria",
  correcao: "Correção",
  nova_regra: "Nova regra",
  novo_indicador: "Novo indicador",
};

function Novidades() {
  const qc = useQueryClient();

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: novidades = [] } = useQuery({
    queryKey: ["novidades"],
    queryFn: async () => (await supabase.from("novidades").select("*").order("publicado_em", { ascending: false })).data ?? [],
  });

  const { data: leituras = [] } = useQuery({
    enabled: !!userId,
    queryKey: ["novidades-lidas", userId],
    queryFn: async () => (await supabase.from("novidades_leituras").select("novidade_id").eq("user_id", userId!)).data ?? [],
  });
  const lidos = new Set(leituras.map((l) => l.novidade_id));

  const marcar = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) return;
      await supabase.from("novidades_leituras").insert({ novidade_id: id, user_id: userId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["novidades-lidas", userId] }),
  });

  return (
    <div className="space-y-3">
      {novidades.length === 0 && <p className="text-sm text-muted-foreground">Sem novidades ainda.</p>}
      {novidades.map((n) => {
        const lido = lidos.has(n.id);
        return (
          <Card key={n.id} className={lido ? "opacity-70" : ""}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{n.titulo}</h3>
                    <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[n.tipo] ?? n.tipo}</Badge>
                    {n.modulo && <Badge variant="secondary" className="text-[10px]">{n.modulo}</Badge>}
                    {!lido && <Badge className="text-[10px]">Novo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(n.publicado_em).toLocaleDateString("pt-BR")}</div>
                </div>
              </div>
              <p className="text-sm">{n.descricao}</p>
              {n.regra_alterada && <p className="text-xs"><strong>Regra alterada:</strong> {n.regra_alterada}</p>}
              {n.perfis && n.perfis.length > 0 && (
                <div className="flex flex-wrap gap-1">{n.perfis.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}</div>
              )}
              <div className="flex gap-2 pt-1">
                {n.link && (
                  <Link to={n.link as string}>
                    <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" />Ver o que mudou</Button>
                  </Link>
                )}
                {!lido && (
                  <Button size="sm" variant="ghost" onClick={() => marcar.mutate(n.id)}>
                    <Check className="h-3 w-3 mr-1" />Marcar como lido
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
