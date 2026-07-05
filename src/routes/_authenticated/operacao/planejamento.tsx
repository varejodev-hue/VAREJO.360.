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
import { CalendarRange, CheckCircle2, ClipboardCheck, Plus, Target, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacao/planejamento")({
  component: PlanejamentoGerente,
});

const indicadoresBase = [
  { key: "sell_out", label: "Sell out" },
  { key: "entrada", label: "Entrada" },
  { key: "b2b", label: "B2B" },
  { key: "raio_x", label: "Raio X" },
  { key: "aprende_shop", label: "Aprende Shop" },
  { key: "impactos", label: "Impactos" },
  { key: "visitas", label: "Visitas" },
  { key: "eventos", label: "Eventos" },
  { key: "convidados", label: "Convidados" },
] as const;

const checklistBase = [
  "Analisou compromissos da semana/mes anterior",
  "Preencheu fato, causa e plano de acao",
  "Definiu metas previstas",
  "Registrou realizado e atingimento",
  "Compartilhou recado da semana/mes",
  "Atribuiu responsaveis pelas acoes",
  "Revisou pendencias com assistente",
] as const;

type Indicadores = Record<string, { previsto?: string; realizado?: string }>;

function PlanejamentoGerente() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const currentUser = useCurrentUser();
  const [filtroTipo, setFiltroTipo] = useState<"semanal" | "mensal" | "todos">("semanal");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initialForm("semanal"));

  const planejamentos = useQuery({
    queryKey: ["operacao-planejamentos", lojaId, filtroTipo],
    queryFn: async () => {
      let q = db.from("operacao_planejamentos").select("*").order("periodo_inicio", { ascending: false }).limit(40);
      if (lojaId) q = q.eq("loja_id", lojaId);
      if (filtroTipo !== "todos") q = q.eq("tipo", filtroTipo);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const resumo = useMemo(() => {
    const rows = planejamentos.data ?? [];
    return {
      total: rows.length,
      abertos: rows.filter((r: any) => ["planejado", "em_execucao"].includes(r.status)).length,
      concluidos: rows.filter((r: any) => r.status === "concluido").length,
    };
  }, [planejamentos.data]);

  const createPlanejamento = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o titulo do planejamento");
      if (!form.periodo_inicio || !form.periodo_fim) throw new Error("Informe o periodo");
      const { error } = await db.from("operacao_planejamentos").insert({
        loja_id: lojaId,
        tipo: form.tipo,
        titulo: form.titulo,
        periodo_inicio: form.periodo_inicio,
        periodo_fim: form.periodo_fim,
        status: form.status,
        responsavel_user_id: currentUser.data?.id ?? null,
        recado: form.recado || null,
        objetivo: form.objetivo || null,
        fato: form.fato || null,
        causa: form.causa || null,
        plano_acao: form.plano_acao || null,
        indicadores: form.indicadores,
        checklist: Object.fromEntries(checklistBase.map((item) => [item, false])),
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Planejamento cadastrado");
      queryClient.invalidateQueries({ queryKey: ["operacao-planejamentos"] });
      queryClient.invalidateQueries({ queryKey: ["operacao-calendario"] });
      queryClient.invalidateQueries({ queryKey: ["operacao-alertas"] });
      setOpen(false);
      setForm(initialForm(filtroTipo === "mensal" ? "mensal" : "semanal"));
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar planejamento"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await db.from("operacao_planejamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["operacao-planejamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar status"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Planejamentos" value={resumo.total} icon={CalendarRange} />
        <Kpi label="Em aberto" value={resumo.abertos} icon={Target} tone={resumo.abertos > 0 ? "attention" : "healthy"} />
        <Kpi label="Concluidos" value={resumo.concluidos} icon={CheckCircle2} tone="healthy" />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Planejamento do gerente</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                O administrador decide se a loja usa semanal, mensal ou os dois. A estrutura segue FCA: fato, causa e plano de acao.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => {
                setForm(initialForm(filtroTipo === "mensal" ? "mensal" : "semanal"));
                setOpen(true);
              }}>
                <Plus className="h-4 w-4" /> Planejamento
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {(planejamentos.data ?? []).length === 0 ? (
              <div className="xl:col-span-2">
                <Empty text="Nenhum planejamento cadastrado para este filtro." />
              </div>
            ) : (
              planejamentos.data?.map((item: any) => (
                <PlanejamentoCard key={item.id} item={item} onStatus={(status) => updateStatus.mutate({ id: item.id, status })} />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo planejamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v: "semanal" | "mensal") => setForm({ ...initialForm(v), titulo: form.titulo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejado">Planejado</SelectItem>
                  <SelectItem value="em_execucao">Em execucao</SelectItem>
                  <SelectItem value="concluido">Concluido</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Titulo" className="md:col-span-2">
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="ex.: FCA Semana 2 - Loja Botafogo" />
            </Field>
            <Field label="Inicio">
              <Input type="date" value={form.periodo_inicio} onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value })} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={form.periodo_fim} onChange={(e) => setForm({ ...form, periodo_fim: e.target.value })} />
            </Field>
            <Field label="Objetivo SMART" className="md:col-span-2">
              <Textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Objetivo claro, mensuravel e com prazo." />
            </Field>
            <Field label="Fato" className="md:col-span-2">
              <Textarea value={form.fato} onChange={(e) => setForm({ ...form, fato: e.target.value })} placeholder="O que aconteceu no periodo anterior?" />
            </Field>
            <Field label="Causa">
              <Textarea value={form.causa} onChange={(e) => setForm({ ...form, causa: e.target.value })} placeholder="Por que aconteceu?" />
            </Field>
            <Field label="Plano de acao">
              <Textarea value={form.plano_acao} onChange={(e) => setForm({ ...form, plano_acao: e.target.value })} placeholder="O que sera feito, por quem e ate quando?" />
            </Field>
            <Field label="Recado para o periodo" className="md:col-span-2">
              <Input value={form.recado} onChange={(e) => setForm({ ...form, recado: e.target.value })} placeholder="Mensagem principal para o time." />
            </Field>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Indicadores do periodo</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {indicadoresBase.map((ind) => {
                const value = form.indicadores[ind.key] ?? {};
                return (
                  <div key={ind.key} className="rounded-lg border p-3">
                    <div className="text-xs font-medium mb-2">{ind.label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={value.previsto ?? ""} onChange={(e) => setIndicador(ind.key, "previsto", e.target.value, form, setForm)} placeholder="Previsto" />
                      <Input value={value.realizado ?? ""} onChange={(e) => setIndicador(ind.key, "realizado", e.target.value, form, setForm)} placeholder="Realizado" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Observacoes" className="mt-4">
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createPlanejamento.mutate()} disabled={createPlanejamento.isPending}>
              {createPlanejamento.isPending ? "Salvando..." : "Salvar planejamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanejamentoCard({ item, onStatus }: { item: any; onStatus: (status: string) => void }) {
  const indicadores = (item.indicadores ?? {}) as Indicadores;
  const preenchidos = indicadoresBase.filter((ind) => indicadores[ind.key]?.previsto || indicadores[ind.key]?.realizado).length;
  const statusTone = item.status === "concluido" ? "secondary" : item.status === "em_execucao" ? "default" : "outline";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{item.titulo}</h3>
            <Badge variant="outline">{item.tipo}</Badge>
            <Badge variant={statusTone as any}>{labelStatus(item.status)}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {fmtDate(item.periodo_inicio)} ate {fmtDate(item.periodo_fim)}
          </div>
        </div>
        <Select value={item.status} onValueChange={onStatus}>
          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="planejado">Planejado</SelectItem>
            <SelectItem value="em_execucao">Em execucao</SelectItem>
            <SelectItem value="concluido">Concluido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
        <MiniBlock label="Fato" value={item.fato} />
        <MiniBlock label="Causa" value={item.causa} />
        <MiniBlock label="Plano de acao" value={item.plano_acao} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-2 py-1">Indicadores: {preenchidos}/{indicadoresBase.length}</span>
        {item.recado && <span className="rounded-md bg-muted px-2 py-1">Recado: {item.recado}</span>}
      </div>
    </div>
  );
}

function MiniBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-muted/50 p-3 min-h-[88px]">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="text-xs mt-1 line-clamp-3">{value || "Nao preenchido"}</div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: number; icon: any; tone?: "neutral" | "attention" | "healthy" }) {
  const toneClass = tone === "attention" ? "text-amber-600" : tone === "healthy" ? "text-emerald-600" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value.toLocaleString("pt-BR")}</div>
        </div>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </CardContent>
    </Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function initialForm(tipo: "semanal" | "mensal") {
  const hoje = new Date();
  const inicio = new Date(hoje);
  const fim = new Date(hoje);
  if (tipo === "semanal") {
    const dia = hoje.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    inicio.setDate(hoje.getDate() + diff);
    fim.setDate(inicio.getDate() + 5);
  } else {
    inicio.setDate(1);
    fim.setMonth(inicio.getMonth() + 1, 0);
  }

  return {
    tipo,
    titulo: tipo === "semanal" ? "FCA semanal" : "Planejamento mensal",
    periodo_inicio: toDate(inicio),
    periodo_fim: toDate(fim),
    status: "planejado",
    recado: "",
    objetivo: "",
    fato: "",
    causa: "",
    plano_acao: "",
    indicadores: {} as Indicadores,
    observacoes: "",
  };
}

function setIndicador(
  key: string,
  field: "previsto" | "realizado",
  value: string,
  form: ReturnType<typeof initialForm>,
  setForm: (value: ReturnType<typeof initialForm>) => void,
) {
  setForm({
    ...form,
    indicadores: {
      ...form.indicadores,
      [key]: {
        ...(form.indicadores[key] ?? {}),
        [field]: value,
      },
    },
  });
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function labelStatus(status: string) {
  const labels: Record<string, string> = {
    planejado: "Planejado",
    em_execucao: "Em execucao",
    concluido: "Concluido",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}
