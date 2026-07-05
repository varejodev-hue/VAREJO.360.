import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { executarWorkflow } from "@/lib/workflows.functions";
import { Plug, Plus, Trash2, Play, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/workflows")({
  component: Page,
});

type Trigger = "orcamento_criado" | "task_vencida" | "especificador_inativo";
type ActionTipo = "criar_task" | "criar_interacao" | "notificar_usuario";

const TRIGGERS: { v: Trigger; label: string }[] = [
  { v: "orcamento_criado", label: "Quando orçamento for criado" },
  { v: "task_vencida", label: "Quando tarefa vencer" },
  { v: "especificador_inativo", label: "Quando especificador ficar inativo" },
];

const ACOES: { v: ActionTipo; label: string }[] = [
  { v: "criar_task", label: "Criar tarefa" },
  { v: "criar_interacao", label: "Registrar interação" },
  { v: "notificar_usuario", label: "Notificar usuário" },
];

function Page() {
  const qc = useQueryClient();
  const exec = useServerFn(executarWorkflow);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data: workflows = [] } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await supabase.from("workflows").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: async () => (await supabase.from("workflow_runs").select("*").order("executado_em", { ascending: false }).limit(30)).data ?? [],
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) =>
      (await supabase.from("workflows").update({ ativo }).eq("id", id)).error,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await supabase.from("workflows").delete().eq("id", id)).error,
    onSuccess: () => { toast.success("Workflow removido"); qc.invalidateQueries({ queryKey: ["workflows"] }); },
  });

  const runMut = useMutation({
    mutationFn: (id: string) => exec({ data: { workflow_id: id, payload: {}, force_dry_run: true } }),
    onSuccess: (r) => {
      toast.success(`Simulação: ${r.status}`);
      qc.invalidateQueries({ queryKey: ["workflow-runs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Automatize ações com regras 'Quando → Se → Então'. Comece em modo simulação."
        action={<Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Novo workflow</Button>}
      />

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plug className="h-4 w-4" />Regras configuradas</CardTitle></CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum workflow ainda. Clique em "Novo workflow" para criar.</p>
          ) : (
            <div className="divide-y">
              {workflows.map((w) => (
                <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {w.nome}
                      {w.dry_run && <Badge variant="outline" className="text-[10px]">simulação</Badge>}
                      {!w.ativo && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {TRIGGERS.find((t) => t.v === w.gatilho)?.label ?? w.gatilho}
                      {w.descricao ? ` — ${w.descricao}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={w.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: w.id, ativo: v })} />
                    <Button size="sm" variant="outline" onClick={() => runMut.mutate(w.id)} disabled={runMut.isPending}>
                      <Play className="h-3 w-3 mr-1" />Testar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(w.id)}>Ações</Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(w.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Últimas execuções</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem execuções ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Quando</th><th className="text-left py-2">Workflow</th><th className="text-left py-2">Status</th><th className="text-left py-2">Observação</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const wf = workflows.find((w) => w.id === r.workflow_id);
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{new Date(r.executado_em).toLocaleString("pt-BR")}</td>
                      <td className="py-2">{wf?.nome ?? "—"}</td>
                      <td className="py-2"><Badge variant={r.status === "erro" ? "destructive" : r.status === "sucesso" ? "default" : "outline"}>{r.status}</Badge></td>
                      <td className="py-2 text-muted-foreground text-xs">{r.observacao ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {openNew && <NovoWorkflowDialog onClose={() => setOpenNew(false)} />}
      {editing && <AcoesDialog workflowId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function NovoWorkflowDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gatilho, setGatilho] = useState<Trigger>("orcamento_criado");
  const [campo, setCampo] = useState("");
  const [op, setOp] = useState("gte");
  const [valor, setValor] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const condicoes = campo ? { [campo]: { op, valor: isNaN(Number(valor)) ? valor : Number(valor) } } : {};
      const { error } = await supabase.from("workflows").insert({
        nome, descricao: descricao || null, gatilho, condicoes: condicoes as never, ativo: true, dry_run: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Workflow criado em modo simulação"); qc.invalidateQueries({ queryKey: ["workflows"] }); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo workflow</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Alerta orçamento alto valor" /></div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} /></div>
          <div>
            <Label>Quando</Label>
            <Select value={gatilho} onValueChange={(v) => setGatilho(v as Trigger)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="border rounded p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Condição (opcional)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="campo (ex: valor)" value={campo} onChange={(e) => setCampo(e.target.value)} />
              <Select value={op} onValueChange={setOp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["eq","neq","gt","gte","lt","lte"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="valor" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Novos workflows começam em modo simulação. Ações só executam de fato após você desativar a simulação.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!nome || create.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcoesDialog({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: acoes = [] } = useQuery({
    queryKey: ["wfa", workflowId],
    queryFn: async () => (await supabase.from("workflow_actions").select("*").eq("workflow_id", workflowId).order("ordem")).data ?? [],
  });
  const { data: wf } = useQuery({
    queryKey: ["wf", workflowId],
    queryFn: async () => (await supabase.from("workflows").select("*").eq("id", workflowId).maybeSingle()).data,
  });

  const [tipo, setTipo] = useState<ActionTipo>("criar_task");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {};
      if (tipo === "criar_task") params.titulo = titulo || "Tarefa automática";
      if (tipo === "notificar_usuario") { params.titulo = titulo || "Aviso"; params.mensagem = mensagem; }
      if (tipo === "criar_interacao") params.observacao = mensagem || "Interação registrada via workflow";
      const { error } = await supabase.from("workflow_actions").insert({
        workflow_id: workflowId, tipo, ordem: acoes.length, params: params as never,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wfa", workflowId] }); setTitulo(""); setMensagem(""); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await supabase.from("workflow_actions").delete().eq("id", id)).error,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wfa", workflowId] }),
  });

  const toggleDry = useMutation({
    mutationFn: async (dry: boolean) => (await supabase.from("workflows").update({ dry_run: dry }).eq("id", workflowId)).error,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wf", workflowId] }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Ações de: {wf?.nome}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 border rounded bg-muted/30">
            <Switch checked={!!wf?.dry_run} onCheckedChange={(v) => toggleDry.mutate(v)} />
            <div className="text-sm">Modo simulação <span className="text-muted-foreground">— quando ligado, nenhuma ação é executada de fato.</span></div>
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Ações configuradas</Label>
            {acoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma ação ainda.</p>
            ) : (
              <ul className="divide-y border rounded mt-1">
                {acoes.map((a) => (
                  <li key={a.id} className="px-3 py-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{ACOES.find((x) => x.v === a.tipo)?.label ?? a.tipo}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{JSON.stringify(a.params)}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border rounded p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Adicionar ação</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as ActionTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACOES.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
            {(tipo === "criar_task" || tipo === "notificar_usuario") && (
              <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            )}
            {(tipo === "notificar_usuario" || tipo === "criar_interacao") && (
              <Textarea placeholder="Mensagem / observação" rows={2} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            )}
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
