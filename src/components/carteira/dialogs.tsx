import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { STATUS_OPTIONS } from "@/lib/carteira-utils";

export function DistribuirDialog({ open, onOpenChange, espIds, onDone }: {
  open: boolean; onOpenChange: (b: boolean) => void; espIds: string[]; onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [vendedorId, setVendedorId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");

  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendedores").select("id,nome,loja_id,lojas(nome)").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = busca.toLowerCase();
    return (vendedores ?? []).filter((v) => !t || v.nome.toLowerCase().includes(t));
  }, [vendedores, busca]);

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_distribuir", {
        p_esp_ids: espIds, p_vendedor_id: vendedorId, p_motivo: motivo || null,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} especificador(es) distribuído(s).`);
      qc.invalidateQueries({ queryKey: ["carteira"] });
      onOpenChange(false);
      setVendedorId(""); setMotivo("");
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Distribuir carteira</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{espIds.length} especificador(es) selecionado(s).</div>
          <div>
            <Label>Buscar vendedor</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome…" />
          </div>
          <div>
            <Label>Vendedor responsável</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {filtered.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}{(v.lojas as { nome: string } | null)?.nome ? ` — ${(v.lojas as { nome: string }).nome}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!vendedorId || espIds.length === 0 || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Aplicando…" : "Distribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatusDialog({ open, onOpenChange, espIds, onDone }: {
  open: boolean; onOpenChange: (b: boolean) => void; espIds: string[]; onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ativo");
  const [motivo, setMotivo] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_alterar_status", {
        p_esp_ids: espIds, p_status: status, p_motivo: motivo || null,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} status atualizado(s).`);
      qc.invalidateQueries({ queryKey: ["carteira"] });
      onOpenChange(false);
      setMotivo("");
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Alterar status</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{espIds.length} especificador(es) selecionado(s).</div>
          <div>
            <Label>Novo status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={espIds.length === 0 || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Aplicando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
