import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Plus, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacao/manutencao")({
  component: Manutencao,
});

const periodicidades = ["mensal", "trimestral", "semestral", "anual", "conforme contrato"];
const categorias = ["Ar-condicionado", "Dedetizacao", "Cafe", "Agua", "Extintor", "Obra", "Loja", "Outros"];

function Manutencao() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item: "",
    categoria: "Loja",
    periodicidade: "mensal",
    ultima_execucao: "",
    proxima_execucao: "",
    fornecedor: "",
    telefone: "",
    contato: "",
    regra: "",
  });

  const preventivas = useQuery({
    queryKey: ["operacao-preventivas", lojaId],
    queryFn: async () => {
      let q = db.from("operacao_manutencoes_preventivas").select("*").order("proxima_execucao");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createPreventiva = useMutation({
    mutationFn: async () => {
      if (!form.item.trim()) throw new Error("Informe o item de manutencao");
      const status = statusFromDate(form.proxima_execucao);
      const { error } = await db.from("operacao_manutencoes_preventivas").insert({
        loja_id: lojaId,
        item: form.item,
        categoria: form.categoria,
        periodicidade: form.periodicidade,
        ultima_execucao: form.ultima_execucao || null,
        proxima_execucao: form.proxima_execucao || null,
        fornecedor: form.fornecedor || null,
        telefone: form.telefone || null,
        contato: form.contato || null,
        regra: form.regra || null,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preventiva cadastrada");
      queryClient.invalidateQueries({ queryKey: ["operacao-preventivas"] });
      setOpen(false);
      setForm({ item: "", categoria: "Loja", periodicidade: "mensal", ultima_execucao: "", proxima_execucao: "", fornecedor: "", telefone: "", contato: "", regra: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar preventiva"),
  });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Manutencao preventiva da loja</h2>
            </div>
            <p className="text-xs text-muted-foreground">Ar-condicionado, dedetizacao, cafe, agua, extintores, obra e contratos recorrentes.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Preventiva</Button>
        </div>
        <div className="space-y-2">
          {(preventivas.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma preventiva cadastrada ainda.</div>
          ) : preventivas.data?.map((item: any) => {
            const status = statusFromDate(item.proxima_execucao);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{item.item}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.fornecedor ?? "Fornecedor a definir"} - {item.periodicidade} - {item.telefone ?? "sem telefone"}</div>
                  {item.contato && <div className="text-xs text-muted-foreground truncate">Contato: {item.contato}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={status === "vencida" ? "destructive" : status === "a_vencer" ? "outline" : "secondary"}>{status}</Badge>
                  <Badge variant="outline" className="gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {item.proxima_execucao ? new Date(item.proxima_execucao).toLocaleDateString("pt-BR") : "sem data"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova manutencao preventiva</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Item"><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="ex.: Ar-condicionado showroom" /></Field>
              <Field label="Categoria">
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Periodicidade">
                <Select value={form.periodicidade} onValueChange={(v) => setForm({ ...form, periodicidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{periodicidades.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Ultima execucao"><Input type="date" value={form.ultima_execucao} onChange={(e) => setForm({ ...form, ultima_execucao: e.target.value })} /></Field>
              <Field label="Proxima execucao"><Input type="date" value={form.proxima_execucao} onChange={(e) => setForm({ ...form, proxima_execucao: e.target.value })} /></Field>
              <Field label="Fornecedor"><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
              <Field label="Contato"><Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></Field>
              <Field label="Regra/legislacao/observacao" className="md:col-span-2">
                <Textarea value={form.regra} onChange={(e) => setForm({ ...form, regra: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createPreventiva.mutate()} disabled={createPreventiva.isPending}>{createPreventiva.isPending ? "Salvando..." : "Salvar preventiva"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function statusFromDate(value: string | null | undefined) {
  if (!value) return "em_dia";
  const today = new Date();
  const due = new Date(`${value}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (diffDays < 0) return "vencida";
  if (diffDays <= 15) return "a_vencer";
  return "em_dia";
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
