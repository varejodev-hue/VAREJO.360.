import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const MOTIVOS_TRANSFERENCIA = [
  "Vendedor desligado",
  "Troca de loja",
  "Redistribuição de carteira",
  "Baixa performance",
  "Recuperação de relacionamento",
  "Solicitação do especificador",
  "Reestruturação da loja",
  "Outro",
];

export function TransferirDialog({
  open, onOpenChange, vendedorOrigemId, vendedorOrigemNome, espIds, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  vendedorOrigemId?: string | null;
  vendedorOrigemNome?: string;
  /** se vazio e vendedorOrigemId definido → transfere carteira inteira */
  espIds: string[];
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [destinoId, setDestinoId] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS_TRANSFERENCIA[0]);
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");

  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores").select("id,nome,loja_id,lojas(nome)").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = busca.toLowerCase();
    return (vendedores ?? []).filter(
      (v) => v.id !== vendedorOrigemId && (!t || v.nome.toLowerCase().includes(t)),
    );
  }, [vendedores, busca, vendedorOrigemId]);

  const transferenciaTotal = espIds.length === 0 && !!vendedorOrigemId;

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_transferir", {
        p_vendedor_destino: destinoId,
        p_esp_ids: espIds.length > 0 ? espIds : null,
        p_vendedor_origem: vendedorOrigemId ?? null,
        p_motivo: motivo,
        p_observacao: observacao || null,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} especificador(es) transferido(s). Tarefas de follow-up criadas (D+2).`);
      qc.invalidateQueries({ queryKey: ["carteira"] });
      onOpenChange(false);
      setDestinoId(""); setObservacao("");
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{transferenciaTotal ? "Transferir carteira inteira" : "Transferir selecionados"}</DialogTitle>
          <DialogDescription>
            {transferenciaTotal
              ? `Todos os especificadores de ${vendedorOrigemNome ?? "vendedor"} serão movidos.`
              : `${espIds.length} especificador(es) selecionado(s).`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Buscar vendedor destino</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome…" />
          </div>
          <div>
            <Label>Vendedor destino</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
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
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_TRANSFERENCIA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!destinoId || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Transferindo…" : "Confirmar transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
