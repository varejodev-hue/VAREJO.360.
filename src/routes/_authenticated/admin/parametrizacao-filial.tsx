import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/parametrizacao-filial")({
  component: ParametrizacaoFilial,
});

type Loja = { id: string; nome: string };
type Peso = { id: string; loja_id: string | null; indicador: string; peso: number; limite_atencao: number | null; limite_critico: number | null };
type Param = { id: string; loja_id: string | null; chave: string; valor: Record<string, unknown>; descricao: string | null };

const DEFAULT_PESOS: Peso[] = [
  { id: "default-conversao", loja_id: null, indicador: "conversao_orcamento", peso: 25, limite_atencao: 45, limite_critico: 30 },
  { id: "default-carteira", loja_id: null, indicador: "saude_carteira", peso: 20, limite_atencao: 70, limite_critico: 50 },
  { id: "default-follow-up", loja_id: null, indicador: "follow_up_em_dia", peso: 20, limite_atencao: 80, limite_critico: 60 },
  { id: "default-atrasos", loja_id: null, indicador: "atrasos_devolucao", peso: 15, limite_atencao: 5, limite_critico: 10 },
  { id: "default-estoque", loja_id: null, indicador: "estoque_critico", peso: 10, limite_atencao: 8, limite_critico: 15 },
  { id: "default-manutencao", loja_id: null, indicador: "manutencao_preventiva", peso: 10, limite_atencao: 85, limite_critico: 70 },
];

const DEFAULT_PARAMS: Param[] = [
  {
    id: "default-atendimento",
    loja_id: null,
    chave: "atendimento_da_vez",
    descricao: "Regras locais da fila: tipos validos, desempate, fechamento automatico e domingo ignorado.",
    valor: {
      validos_para_fila: ["Novo", "WhatsApp", "Tel/E-mail"],
      nao_contam: ["Retorno", "Retorno dos Outros", "Novo dos Outros", "Folga", "Fora", "Ferias"],
      desempate: "quem estava mais abaixo na fila anterior passa a frente",
      fechamento_automatico: "23:00-00:00",
      ignorar_domingo: true,
    },
  },
  {
    id: "default-follow-up",
    loja_id: null,
    chave: "follow_up_orcamentos",
    descricao: "Rotina para nao perder orcamentos abertos e sinalizar carteira ao gerente.",
    valor: {
      primeiro_follow_up_dias: 1,
      recorrencia_dias: 3,
      alerta_gerente_dias_sem_movimento: 7,
      alerta_orcamento_critico_dias: 15,
    },
  },
  {
    id: "default-compras",
    loja_id: null,
    chave: "compras_materiais",
    descricao: "Checklist produtivo para compra, recebimento, NF, Oracle e encerramento.",
    valor: {
      usar_minimo_maximo: true,
      exigir_cotacao: true,
      exigir_fornecedor_cadastrado: true,
      exigir_ordem_compra: true,
      exigir_nf: true,
      exigir_chamado_oracle: true,
    },
  },
  {
    id: "default-manutencao",
    loja_id: null,
    chave: "manutencao_preventiva",
    descricao: "Prazos padrao para calendario preventivo da loja.",
    valor: {
      ar_condicionado_meses: 3,
      dedetizacao_meses: 6,
      filtro_agua_meses: 6,
      extintores_meses: 12,
      maquina_cafe_meses: 1,
    },
  },
  {
    id: "default-rotina",
    loja_id: null,
    chave: "rotina_responsabilidades",
    descricao: "Parametrizacao da rotina mensal, semanal e diaria por perfil.",
    valor: {
      gerente: ["planejamento semanal", "FCA mensal", "analise de carteira", "reuniao de performance"],
      vendedor: ["entrar na fila", "registrar atendimento", "follow-up de orcamentos", "cuidar especificadores"],
      assistente: ["suporte operacional", "compras", "materiais", "indicadores de pendencias"],
    },
  },
];

function ParametrizacaoFilial() {
  const qc = useQueryClient();
  const [lojaId, setLojaId] = useState<string>("global");
  const [pesos, setPesos] = useState<Record<string, { peso: string; atencao: string; critico: string }>>({});
  const [params, setParams] = useState<Record<string, string>>({});
  const [novoParam, setNovoParam] = useState({ chave: "", descricao: "", valor: "{\n  \n}" });
  const lojaFiltro = lojaId === "global" ? null : lojaId;

  const { data } = useQuery({
    queryKey: ["parametrizacao-filial", lojaFiltro],
    queryFn: async () => {
      const db = supabase as any;
      const [lojas, pesosGlobais, pesosLoja, paramsGlobais, paramsLoja] = await Promise.all([
        db.from("lojas").select("id,nome").eq("ativo", true).order("nome"),
        db.from("sgp_pesos_saude_loja").select("*").is("loja_id", null).order("indicador"),
        lojaFiltro ? db.from("sgp_pesos_saude_loja").select("*").eq("loja_id", lojaFiltro).order("indicador") : Promise.resolve({ data: [], error: null }),
        db.from("sgp_parametros_filial").select("*").is("loja_id", null).order("chave"),
        lojaFiltro ? db.from("sgp_parametros_filial").select("*").eq("loja_id", lojaFiltro).order("chave") : Promise.resolve({ data: [], error: null }),
      ]);
      const errors = [lojas, pesosGlobais, pesosLoja, paramsGlobais, paramsLoja].map((r: any) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];
      return {
        lojas: (lojas.data ?? []) as Loja[],
        pesos: mergeByKey([...DEFAULT_PESOS, ...((pesosGlobais.data ?? []) as Peso[])], (pesosLoja.data ?? []) as Peso[], "indicador"),
        params: mergeByKey([...DEFAULT_PARAMS, ...((paramsGlobais.data ?? []) as Param[])], (paramsLoja.data ?? []) as Param[], "chave"),
      };
    },
  });

  useEffect(() => {
    const nextPesos: typeof pesos = {};
    for (const p of data?.pesos ?? []) {
      nextPesos[p.indicador] = {
        peso: String(p.peso ?? 0),
        atencao: p.limite_atencao == null ? "" : String(p.limite_atencao),
        critico: p.limite_critico == null ? "" : String(p.limite_critico),
      };
    }
    setPesos(nextPesos);
    const nextParams: Record<string, string> = {};
    for (const p of data?.params ?? []) nextParams[p.chave] = JSON.stringify(p.valor ?? {}, null, 2);
    setParams(nextParams);
  }, [data]);

  const savePeso = useMutation({
    mutationFn: async (indicador: string) => {
      const p = pesos[indicador];
      const db = supabase as any;
      const { error } = await db.from("sgp_pesos_saude_loja").upsert({
        loja_id: lojaFiltro,
        indicador,
        peso: Number(p?.peso) || 0,
        limite_atencao: p?.atencao === "" ? null : Number(p?.atencao),
        limite_critico: p?.critico === "" ? null : Number(p?.critico),
      }, { onConflict: "loja_id,indicador" });
      if (error) throw error;
      await db.from("sgp_auditoria").insert({
        loja_id: lojaFiltro,
        entidade: "sgp_pesos_saude_loja",
        entidade_id: indicador,
        acao: "salvar_peso",
        depois: { indicador, ...p },
      });
    },
    onSuccess: () => { toast.success("Peso salvo"); qc.invalidateQueries({ queryKey: ["parametrizacao-filial"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const saveParam = useMutation({
    mutationFn: async ({ chave, descricao, valorTexto }: { chave: string; descricao?: string | null; valorTexto?: string }) => {
      let valor: Record<string, unknown>;
      try {
        valor = JSON.parse(valorTexto ?? params[chave] ?? "{}");
      } catch {
        throw new Error("JSON invalido");
      }
      const original = data?.params.find((p) => p.chave === chave);
      const db = supabase as any;
      const { error } = await db.from("sgp_parametros_filial").upsert({
        loja_id: lojaFiltro,
        chave,
        valor,
        descricao: descricao ?? original?.descricao ?? null,
      }, { onConflict: "loja_id,chave" });
      if (error) throw error;
      await db.from("sgp_auditoria").insert({
        loja_id: lojaFiltro,
        entidade: "sgp_parametros_filial",
        entidade_id: chave,
        acao: "salvar_parametro",
        depois: valor,
      });
    },
    onSuccess: () => { toast.success("Parametro salvo"); qc.invalidateQueries({ queryKey: ["parametrizacao-filial"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar parametro"),
  });

  function incluirParametro() {
    const chave = normalizaChave(novoParam.chave);
    if (!chave) {
      toast.error("Informe a chave do parametro");
      return;
    }
    try {
      JSON.parse(novoParam.valor || "{}");
    } catch {
      toast.error("JSON invalido no novo parametro");
      return;
    }
    setParams((s) => ({ ...s, [chave]: novoParam.valor || "{}" }));
    saveParam.mutate({ chave, descricao: novoParam.descricao || null, valorTexto: novoParam.valor || "{}" });
    setNovoParam({ chave: "", descricao: "", valor: "{\n  \n}" });
  }

  return (
    <div>
      <PageHeader
        title="Parametrizacao da Filial"
        description="Ajuste pesos da Saude da Loja e regras locais de follow-up, atendimento, alertas e rotina."
      />

      <Card className="mb-5">
        <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(260px,420px)_1fr] gap-4 items-end">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Escopo</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Padrao global</SelectItem>
                {(data?.lojas ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Parametros salvos no padrao global valem para todas as lojas. Ao escolher uma filial, o gestor pode sobrescrever a regra local sem alterar as demais.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Settings2 className="h-4 w-4 text-primary" /> Pesos da Saude da Loja
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Ajuste quanto cada indicador pesa na leitura da saude da loja e os limites de atencao/critico.
            </p>
            <div className="space-y-3">
              {(data?.pesos ?? []).map((p) => {
                const d = pesos[p.indicador] ?? { peso: "", atencao: "", critico: "" };
                return (
                  <div key={p.indicador} className="grid grid-cols-1 md:grid-cols-[1fr_90px_100px_100px_auto] gap-2 items-end border-b pb-3">
                    <div>
                      <Label className="text-xs">{labelIndicador(p.indicador)}</Label>
                      <div className="text-[11px] text-muted-foreground font-mono">{p.indicador}</div>
                    </div>
                    <Field label="Peso" value={d.peso} onChange={(v) => setPeso(p.indicador, "peso", v, setPesos)} />
                    <Field label="Atencao" value={d.atencao} onChange={(v) => setPeso(p.indicador, "atencao", v, setPesos)} />
                    <Field label="Critico" value={d.critico} onChange={(v) => setPeso(p.indicador, "critico", v, setPesos)} />
                    <Button size="sm" onClick={() => savePeso.mutate(p.indicador)}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Settings2 className="h-4 w-4 text-primary" /> Regras da Filial
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Edite as regras em JSON. Isso permite configurar rotina, fila, compras, follow-up e manutencao por loja.
            </p>
            <div className="space-y-4">
              {(data?.params ?? []).map((p) => (
                <div key={p.chave} className="border-b pb-4">
                  <Label className="text-xs">{p.chave}</Label>
                  {p.descricao && <div className="text-xs text-muted-foreground mt-1 mb-2">{p.descricao}</div>}
                  <textarea
                    className="w-full min-h-28 rounded-md border bg-background p-3 text-xs font-mono"
                    value={params[p.chave] ?? ""}
                    onChange={(e) => setParams((s) => ({ ...s, [p.chave]: e.target.value }))}
                  />
                  <Button size="sm" className="mt-2" onClick={() => saveParam.mutate({ chave: p.chave })}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Salvar regra
                  </Button>
                </div>
              ))}
              <div className="rounded-lg border bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Plus className="h-4 w-4 text-primary" /> Incluir parametro
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Chave</Label>
                    <Input
                      placeholder="ex: meta_b2b_b2c"
                      value={novoParam.chave}
                      onChange={(e) => setNovoParam((s) => ({ ...s, chave: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Descricao</Label>
                    <Input
                      placeholder="Explique para que serve"
                      value={novoParam.descricao}
                      onChange={(e) => setNovoParam((s) => ({ ...s, descricao: e.target.value }))}
                    />
                  </div>
                </div>
                <Label className="text-xs">Valor JSON</Label>
                <textarea
                  className="mt-1 w-full min-h-24 rounded-md border bg-background p-3 text-xs font-mono"
                  value={novoParam.valor}
                  onChange={(e) => setNovoParam((s) => ({ ...s, valor: e.target.value }))}
                />
                <Button size="sm" className="mt-2" onClick={incluirParametro}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Incluir parametro
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function setPeso(indicador: string, field: "peso" | "atencao" | "critico", value: string, setPesos: Dispatch<SetStateAction<Record<string, { peso: string; atencao: string; critico: string }>>>) {
  setPesos((s) => ({ ...s, [indicador]: { ...(s[indicador] ?? { peso: "", atencao: "", critico: "" }), [field]: value } }));
}

function mergeByKey<T extends Record<string, any>>(globalRows: T[], lojaRows: T[], key: keyof T) {
  const map = new Map<string, T>();
  for (const r of globalRows) map.set(String(r[key]), r);
  for (const r of lojaRows) map.set(String(r[key]), r);
  return [...map.values()];
}

function labelIndicador(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizaChave(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
