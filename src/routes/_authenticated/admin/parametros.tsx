import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/parametros")({
  component: Parametros,
});

type Param = { id: string; chave: string; valor: string; descricao: string | null; grupo: string | null };

function Parametros() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["parametros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parametros").select("*").order("grupo").order("chave");
      if (error) throw error;
      return (data ?? []) as Param[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: string }) => {
      const { error } = await supabase.from("parametros").update({ valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parâmetro salvo"); qc.invalidateQueries({ queryKey: ["parametros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const grupos = (list.data ?? []).reduce<Record<string, Param[]>>((acc, p) => {
    const g = p.grupo ?? "geral";
    (acc[g] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Parâmetros do sistema"
        description="Configurações globais que afetam regras automáticas (follow-up, criticidade, metas)."
      />
      {list.isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([grupo, items]) => (
            <Card key={grupo}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold capitalize">
                  <Settings className="h-4 w-4 text-primary" /> {grupo}
                </div>
                {items.map((p) => {
                  const value = edits[p.id] ?? p.valor;
                  const dirty = value !== p.valor;
                  return (
                    <div key={p.id} className="grid md:grid-cols-[1fr,200px,auto] gap-3 items-end pb-3 border-b last:border-0">
                      <div>
                        <Label className="text-xs">{p.chave}</Label>
                        {p.descricao && <p className="text-xs text-muted-foreground mt-1">{p.descricao}</p>}
                      </div>
                      <Input
                        value={value}
                        onChange={(e) => setEdits((s) => ({ ...s, [p.id]: e.target.value }))}
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        disabled={!dirty || save.isPending}
                        onClick={() => save.mutate({ id: p.id, valor: value }, { onSuccess: () => setEdits((s) => { const n = { ...s }; delete n[p.id]; return n; }) })}
                      >
                        <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
