import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, ClipboardList, RotateCcw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacao/atendimento-da-vez")({
  component: AtendimentoDaVez,
});

const tipos = ["Novo", "WhatsApp", "Tel/E-mail", "Retorno", "Retorno dos Outros", "Novo dos Outros"] as const;
const tiposValidos = new Set<string>(["Novo", "WhatsApp", "Tel/E-mail"]);
const canais = ["Loja", "WhatsApp", "Telefone", "E-mail", "Instagram", "Indicacao", "Outros"];
const statusOptions = [
  ["registrado", "Registrado"],
  ["orcamento_pendente", "Orcamento pendente"],
  ["orcamento_gerado", "Orcamento gerado"],
  ["sem_orcamento", "Sem orcamento"],
  ["convertido", "Convertido"],
  ["perdido", "Perdido"],
];

const regras = [
  ["Conta para a fila", "Novo, WhatsApp e Tel/E-mail formam o Total Valido da coluna X."],
  ["Nao conta", "Retorno, Retorno dos Outros, Novo dos Outros parametrizado como historico, folga, fora, ferias e almoco."],
  ["Prioridade", "Menor Total Valido fica na frente no proximo dia."],
  ["Empate", "Quem estava mais abaixo na fila anterior passa a frente."],
  ["Sem valido no dia", "A ordem permanece exatamente igual ao dia anterior."],
  ["Fechamento", "Entre 23h e 0h salva historico, recalcula fila, limpa lancamentos e pula domingo."],
];

const totais = [
  ["R", "Total de Novos"],
  ["S", "Novos via WhatsApp"],
  ["T", "Telefone / E-mail"],
  ["U", "Retornos"],
  ["V", "Retornos de outros consultores"],
  ["W", "Novos de outros consultores"],
  ["X", "Total Valido para a Fila"],
  ["Y", "Total Geral de atendimentos"],
];

type AtendimentoForm = {
  vendedor_id: string;
  tipo: string;
  canal: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
  gerou_orcamento: boolean;
  valor_orcamento: string;
  status_atendimento: string;
  observacoes: string;
};

const emptyForm: AtendimentoForm = {
  vendedor_id: "__none",
  tipo: "Novo",
  canal: "Loja",
  cliente_nome: "",
  cliente_telefone: "",
  cliente_email: "",
  gerou_orcamento: false,
  valor_orcamento: "",
  status_atendimento: "registrado",
  observacoes: "",
};

function AtendimentoDaVez() {
  const hoje = new Date().toISOString().slice(0, 10);
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AtendimentoForm>(emptyForm);

  const fila = useQuery({
    queryKey: ["operacao-fila", hoje, lojaId],
    queryFn: async () => {
      let q = db
        .from("operacao_fila_consultores")
        .select("*, vendedores(nome)")
        .eq("data_operacao", hoje)
        .order("ordem");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendedores = useQuery({
    queryKey: ["operacao-vendedores", lojaId],
    queryFn: async () => {
      let q = db.from("vendedores").select("id,nome,loja_id,ativo").order("nome");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((v: any) => v.ativo !== false);
    },
  });

  const lancamentos = useQuery({
    queryKey: ["operacao-atendimentos", hoje, lojaId],
    queryFn: async () => {
      let q = db
        .from("operacao_atendimento_lancamentos")
        .select("*, vendedores(nome)")
        .eq("data_operacao", hoje)
        .order("created_at", { ascending: false })
        .limit(50);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const resumo = useMemo(() => {
    const rows = lancamentos.data ?? [];
    return {
      validos: rows.filter((x: any) => x.conta_fila).length,
      total: rows.length,
      orcamentos: rows.filter((x: any) => x.gerou_orcamento).length,
      canais: new Set(rows.map((x: any) => x.canal).filter(Boolean)).size,
    };
  }, [lancamentos.data]);

  const createAtendimento = useMutation({
    mutationFn: async () => {
      const contaFila = tiposValidos.has(form.tipo);
      const valor = form.valor_orcamento ? Number(form.valor_orcamento.replace(",", ".")) : 0;
      const { error } = await db.from("operacao_atendimento_lancamentos").insert({
        loja_id: lojaId,
        vendedor_id: form.vendedor_id === "__none" ? null : form.vendedor_id,
        data_operacao: hoje,
        tipo: form.tipo,
        canal: form.canal,
        cliente_nome: form.cliente_nome || null,
        cliente_telefone: form.cliente_telefone || null,
        cliente_email: form.cliente_email || null,
        gerou_orcamento: form.gerou_orcamento,
        valor_orcamento: Number.isFinite(valor) ? valor : 0,
        status_atendimento: form.status_atendimento,
        conta_fila: contaFila,
        observacoes: form.observacoes || null,
        created_by: currentUser.data?.id ?? null,
      });
      if (error) throw error;
      return contaFila;
    },
    onSuccess: (contaFila) => {
      toast.success(contaFila ? "Atendimento registrado e contado na fila" : "Atendimento registrado no historico");
      queryClient.invalidateQueries({ queryKey: ["operacao-atendimentos"] });
      setForm(emptyForm);
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar atendimento"),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Data" value={new Date().toLocaleDateString("pt-BR")} icon={CalendarClock} />
        <Kpi label="Total Valido" value={resumo.validos} icon={ShieldCheck} />
        <Kpi label="Orcamentos" value={resumo.orcamentos} icon={ClipboardList} />
        <Kpi label="Fechamento" value="23h-0h" icon={RotateCcw} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold">Fila de prioridade do dia</h2>
                <p className="text-xs text-muted-foreground">Equivalente a ordem dos consultores em A6:A9.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Registrar atendimento</Button>
            </div>
            <div className="space-y-2">
              {(fila.data ?? []).length === 0 ? (
                <EmptyHint text="Aguardando fechamento ou carga inicial da fila de hoje." />
              ) : (
                fila.data?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
                        {item.ordem}
                      </span>
                      <div>
                        <div className="text-sm font-medium">{item.vendedores?.nome ?? "Consultor"}</div>
                        <div className="text-xs text-muted-foreground">{item.total_valido} validos de {item.total_geral} registros</div>
                      </div>
                    </div>
                    <Badge variant={item.status === "disponivel" ? "secondary" : "outline"}>{item.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold">Lancamentos do dia</h2>
                <p className="text-xs text-muted-foreground">Todos entram no historico; apenas os validos mexem na fila.</p>
              </div>
              <Badge variant="outline">{resumo.total} registros</Badge>
            </div>
            <div className="space-y-2">
              {(lancamentos.data ?? []).length === 0 ? (
                <EmptyHint text="Nenhum atendimento registrado hoje." />
              ) : (
                lancamentos.data?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.tipo} - {item.cliente_nome ?? "Cliente nao informado"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.vendedores?.nome ?? "Consultor"} - {item.canal ?? "canal nao informado"} - {statusLabel(item.status_atendimento)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.gerou_orcamento && <Badge variant="secondary">Orcamento</Badge>}
                      <Badge variant={item.conta_fila ? "default" : "outline"}>{item.conta_fila ? "Coluna X" : "Historico"}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3">Regra oficial da prioridade</h2>
            <div className="space-y-2">
              {regras.map(([titulo, texto]) => (
                <div key={titulo} className="flex gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div><span className="font-medium">{titulo}:</span> <span className="text-muted-foreground">{texto}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3">Totais automaticos R:Y</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {totais.map(([coluna, campo]) => (
                <div key={coluna} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Coluna {coluna}</div>
                  <div className="text-sm font-medium">{campo}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar atendimento</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Consultor">
              <Select value={form.vendedor_id} onValueChange={(v) => setForm({ ...form, vendedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nao informado</SelectItem>
                  {(vendedores.data ?? []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Canal de entrada">
              <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{canais.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status_atendimento} onValueChange={(v) => setForm({ ...form, status_atendimento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Cliente">
              <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input value={form.cliente_telefone} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.cliente_email} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} />
            </Field>
            <Field label="Valor do orcamento">
              <Input inputMode="decimal" value={form.valor_orcamento} onChange={(e) => setForm({ ...form, valor_orcamento: e.target.value })} placeholder="0,00" />
            </Field>
            <label className="md:col-span-2 flex items-center gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.gerou_orcamento}
                onChange={(e) => setForm({ ...form, gerou_orcamento: e.target.checked, status_atendimento: e.target.checked ? "orcamento_gerado" : form.status_atendimento })}
              />
              Gerou orcamento
            </label>
            <Field label="Observacoes" className="md:col-span-2">
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createAtendimento.mutate()} disabled={createAtendimento.isPending}>
              {createAtendimento.isPending ? "Salvando..." : "Salvar atendimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusLabel(value: string | null | undefined) {
  return statusOptions.find(([key]) => key === value)?.[1] ?? "Registrado";
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
