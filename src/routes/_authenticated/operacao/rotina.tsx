import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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
import { CalendarDays, CheckSquare, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacao/rotina")({
  component: RotinaOperacional,
});

const perfis = ["Gerente", "Assistente de Vendas", "Consultor", "Projetista"];
const ciclos = ["diario", "semanal", "mensal", "eventual"];
const prioridades = ["baixa", "media", "alta"];

function RotinaOperacional() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const currentUser = useCurrentUser();
  const [openRotina, setOpenRotina] = useState(false);
  const [openResp, setOpenResp] = useState(false);
  const [rotina, setRotina] = useState({
    titulo: "",
    descricao: "",
    responsavel_perfil: "Gerente",
    prioridade: "media",
    prazo: new Date().toISOString().slice(0, 10),
  });
  const [resp, setResp] = useState({
    perfil: "Gerente",
    ciclo: "diario",
    quando: "",
    responsabilidade: "",
    responsavel_principal: "",
    substituto: "",
    evidencia: "",
    indicador: "",
  });

  const rotinas = useQuery({
    queryKey: ["operacao-rotinas", lojaId],
    queryFn: async () => {
      let q = db.from("operacao_rotinas").select("*").order("prioridade", { ascending: false }).order("prazo");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const responsabilidades = useQuery({
    queryKey: ["operacao-responsabilidades", lojaId],
    queryFn: async () => {
      let q = db.from("operacao_responsabilidades").select("*").eq("ativo", true).order("perfil").order("ciclo");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createRotina = useMutation({
    mutationFn: async () => {
      if (!rotina.titulo.trim()) throw new Error("Informe o titulo da rotina");
      const { error } = await db.from("operacao_rotinas").insert({
        loja_id: lojaId,
        titulo: rotina.titulo,
        descricao: rotina.descricao || null,
        responsavel_perfil: rotina.responsavel_perfil,
        origem: "manual",
        prioridade: rotina.prioridade,
        prazo: rotina.prazo || null,
        responsavel_user_id: currentUser.data?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rotina cadastrada");
      queryClient.invalidateQueries({ queryKey: ["operacao-rotinas"] });
      setOpenRotina(false);
      setRotina({ titulo: "", descricao: "", responsavel_perfil: "Gerente", prioridade: "media", prazo: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar rotina"),
  });

  const createResp = useMutation({
    mutationFn: async () => {
      if (!resp.responsabilidade.trim()) throw new Error("Informe a responsabilidade");
      const { error } = await db.from("operacao_responsabilidades").insert({
        loja_id: lojaId,
        perfil: resp.perfil,
        ciclo: resp.ciclo,
        quando: resp.quando || null,
        responsabilidade: resp.responsabilidade,
        responsavel_principal: resp.responsavel_principal || null,
        substituto: resp.substituto || null,
        evidencia: resp.evidencia || null,
        indicador: resp.indicador || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsabilidade cadastrada");
      queryClient.invalidateQueries({ queryKey: ["operacao-responsabilidades"] });
      setOpenResp(false);
      setResp({ perfil: "Gerente", ciclo: "diario", quando: "", responsabilidade: "", responsavel_principal: "", substituto: "", evidencia: "", indicador: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar responsabilidade"),
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Rotina do dia</h2>
              </div>
              <p className="text-xs text-muted-foreground">Pendencias por prazo, prioridade e responsavel.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenRotina(true)}><Plus className="h-4 w-4" /> Rotina</Button>
          </div>
          <div className="space-y-2">
            {(rotinas.data ?? []).length === 0 ? (
              <Empty text="Nenhuma rotina cadastrada ainda." />
            ) : (
              rotinas.data?.map((item: any) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{item.titulo}</div>
                    <Badge variant={item.status === "concluido" ? "secondary" : "outline"}>{item.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{item.responsavel_perfil} - {item.prazo ?? "sem prazo"} - prioridade {item.prioridade}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Matriz de responsabilidades</h2>
              </div>
              <p className="text-xs text-muted-foreground">Principal, substituto, evidencia e indicador por funcao.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenResp(true)}><Plus className="h-4 w-4" /> Responsabilidade</Button>
          </div>
          <div className="space-y-2">
            {(responsabilidades.data ?? []).length === 0 ? (
              <Empty text="Nenhuma responsabilidade cadastrada ainda." />
            ) : (
              responsabilidades.data?.map((item: any) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{item.responsabilidade}</div>
                    <Badge>{item.perfil}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{item.ciclo} - {item.quando ?? "sem data"} - indicador: {item.indicador ?? "nao definido"}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Uso operacional</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            O gerente parametriza a rotina e a matriz por perfil. Quando houver substituicao, o colaborador novo enxerga o que fazer, quando fazer, qual evidencia deixar e qual indicador acompanhar.
          </p>
        </CardContent>
      </Card>

      <Dialog open={openRotina} onOpenChange={setOpenRotina}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova rotina</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Titulo"><Input value={rotina.titulo} onChange={(e) => setRotina({ ...rotina, titulo: e.target.value })} /></Field>
            <Field label="Perfil responsavel">
              <Select value={rotina.responsavel_perfil} onValueChange={(v) => setRotina({ ...rotina, responsavel_perfil: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{perfis.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioridade">
                <Select value={rotina.prioridade} onValueChange={(v) => setRotina({ ...rotina, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{prioridades.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Prazo"><Input type="date" value={rotina.prazo} onChange={(e) => setRotina({ ...rotina, prazo: e.target.value })} /></Field>
            </div>
            <Field label="Descricao"><Textarea value={rotina.descricao} onChange={(e) => setRotina({ ...rotina, descricao: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRotina(false)}>Cancelar</Button>
            <Button onClick={() => createRotina.mutate()} disabled={createRotina.isPending}>{createRotina.isPending ? "Salvando..." : "Salvar rotina"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openResp} onOpenChange={setOpenResp}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova responsabilidade</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Perfil">
              <Select value={resp.perfil} onValueChange={(v) => setResp({ ...resp, perfil: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{perfis.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Ciclo">
              <Select value={resp.ciclo} onValueChange={(v) => setResp({ ...resp, ciclo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ciclos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Quando"><Input value={resp.quando} onChange={(e) => setResp({ ...resp, quando: e.target.value })} placeholder="ex.: segunda-feira, dia 5, todo fechamento" /></Field>
            <Field label="Indicador"><Input value={resp.indicador} onChange={(e) => setResp({ ...resp, indicador: e.target.value })} /></Field>
            <Field label="Responsavel principal"><Input value={resp.responsavel_principal} onChange={(e) => setResp({ ...resp, responsavel_principal: e.target.value })} /></Field>
            <Field label="Substituto"><Input value={resp.substituto} onChange={(e) => setResp({ ...resp, substituto: e.target.value })} /></Field>
            <Field label="Responsabilidade" className="md:col-span-2"><Textarea value={resp.responsabilidade} onChange={(e) => setResp({ ...resp, responsabilidade: e.target.value })} /></Field>
            <Field label="Evidencia esperada" className="md:col-span-2"><Input value={resp.evidencia} onChange={(e) => setResp({ ...resp, evidencia: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenResp(false)}>Cancelar</Button>
            <Button onClick={() => createResp.mutate()} disabled={createResp.isPending}>{createResp.isPending ? "Salvando..." : "Salvar responsabilidade"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
