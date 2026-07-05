import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/turnover/parametros")({
  component: ParametrosPage,
});

type Parametros = {
  id: string;
  meses_pausa: number;
  janela_vendedor_principal_meses: number;
  janela_comparacao_meses: number;
  tolerancia_recuperacao_total_pct: number;
  recuperacao_parcial_min_pct: number;
  recuperacao_parcial_max_pct: number;
  sem_recuperacao_max_pct: number;
  alerta_queda_sem_turnover_pct: number;
  alerta_queda_conversao_pp: number;
  alerta_carteira_nao_recuperada_pct: number;
  janela_loja_predominante_meses: number;
};

type FieldDef = {
  key: keyof Omit<Parametros, "id">;
  label: string;
  help: string;
  step?: string;
  min?: number;
};

const FIELDS: { group: string; items: FieldDef[] }[] = [
  {
    group: "Detecção de pausa e vínculo",
    items: [
      {
        key: "meses_pausa",
        label: "Meses consecutivos sem atividade para detectar pausa",
        help: "Seção 4 — abaixo desse limiar o vendedor segue 'ativo'.",
        min: 1,
      },
      {
        key: "janela_vendedor_principal_meses",
        label: "Janela (meses) para definir vendedor principal do especificador",
        help: "Seção 5 — meses antes do evento usados para escolher o vendedor com maior peso na carteira.",
        min: 1,
      },
    ],
  },
  {
    group: "Comparação antes × depois",
    items: [
      {
        key: "janela_comparacao_meses",
        label: "Janela antes/depois do evento (meses)",
        help: "Seções 6 e 7 — período espelhado para comparar carteira.",
        min: 1,
      },
      {
        key: "tolerancia_recuperacao_total_pct",
        label: "Tolerância para 'recuperação total' (%)",
        help: "Seção 6 — venda depois ≥ venda antes mais essa tolerância (use número negativo, ex.: -5).",
        step: "0.1",
      },
      {
        key: "recuperacao_parcial_min_pct",
        label: "Recuperação parcial — mínimo (%)",
        help: "Seção 6 — abaixo disso é considerado 'sem recuperação'.",
        step: "0.1",
      },
      {
        key: "recuperacao_parcial_max_pct",
        label: "Recuperação parcial — máximo (%)",
        help: "Seção 6 — acima disso (ajustado pela tolerância) é 'recuperação total'.",
        step: "0.1",
      },
      {
        key: "sem_recuperacao_max_pct",
        label: "Limite de 'sem recuperação' (%)",
        help: "Seção 6 — venda depois abaixo desse % da venda antes vira perda.",
        step: "0.1",
      },
    ],
  },
  {
    group: "Alertas",
    items: [
      {
        key: "alerta_queda_sem_turnover_pct",
        label: "Queda de orçamento/venda para alerta sem turnover (%)",
        help: "Seção 9 — alerta quando carteira cai além desse % sem evento de vendedor associado.",
        step: "0.1",
      },
      {
        key: "alerta_queda_conversao_pp",
        label: "Queda de conversão para alerta de migração (pontos %)",
        help: "Seção 9 — orçamento estável + conversão caindo além desse valor sinaliza fechamento em outro lugar.",
        step: "0.1",
      },
      {
        key: "alerta_carteira_nao_recuperada_pct",
        label: "Carteira não recuperada por vendedor para alerta (%)",
        help: "Seção 9 — alerta quando vendedor retorna e mais que esse % da carteira segue sem recuperação.",
        step: "0.1",
      },
    ],
  },
  {
    group: "Migração entre lojas",
    items: [
      {
        key: "janela_loja_predominante_meses",
        label: "Janela de agregação para loja predominante (meses)",
        help: "Seção 8 — agrupamento por trimestre = 3 meses; mude para sensibilidade maior/menor.",
        min: 1,
      },
    ],
  },
];

function ParametrosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["turnover", "parametros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnover_parametros")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Parametros | null;
    },
  });

  const [form, setForm] = useState<Parametros | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function update<K extends keyof Parametros>(k: K, v: Parametros[K]) {
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function onSave() {
    if (!form) return;
    setSaving(true);
    const { id, ...rest } = form;
    const { error } = await supabase
      .from("turnover_parametros")
      .update(rest)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Parâmetros atualizados");
    qc.invalidateQueries({ queryKey: ["turnover"] });
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando parâmetros…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros do módulo</CardTitle>
          <CardDescription>
            Todas as regras de classificação, comparação e alerta usam os valores abaixo.
            Editar aqui recalcula os resultados sem precisar de novo deploy. Apenas
            administradores podem salvar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {FIELDS.map((g) => (
            <div key={g.group} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground/80">{g.group}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.items.map((f) => (
                  <div key={f.key} className="grid gap-1.5">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <Input
                      id={f.key}
                      type="number"
                      step={f.step ?? "1"}
                      min={f.min}
                      value={form[f.key] as number}
                      onChange={(e) =>
                        update(f.key, Number(e.target.value) as Parametros[typeof f.key])
                      }
                    />
                    <p className="text-xs text-muted-foreground">{f.help}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => data && setForm(data)} disabled={saving}>
              Reverter
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar parâmetros
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
