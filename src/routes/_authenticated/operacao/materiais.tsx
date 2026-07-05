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
import { PackageCheck, Plus, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacao/materiais")({
  component: MateriaisCompras,
});

const etapasCompra = [
  "Levantamento de estoque",
  "Necessidade de compra",
  "Cotacao de fornecedores",
  "Cadastro do fornecedor confirmado",
  "Aprovacao da cotacao",
  "Emissao da Ordem de Compra",
  "Recebimento do material",
  "Recebimento da Nota Fiscal",
  "Abertura de chamado para lancamento da NF",
  "Integracao com Oracle",
  "Atualizacao do estoque e encerramento",
];

function MateriaisCompras() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const currentUser = useCurrentUser();
  const [openMaterial, setOpenMaterial] = useState(false);
  const [openCompra, setOpenCompra] = useState(false);
  const [material, setMaterial] = useState({ produto: "", unidade: "un", estoque_atual: "0", estoque_minimo: "0", estoque_maximo: "0", fornecedor: "", faturamento: "" });
  const [compra, setCompra] = useState({ material_id: "__manual", material: "", quantidade: "1", fornecedor: "", fornecedor_cadastrado: false });

  const materiais = useQuery({
    queryKey: ["operacao-materiais", lojaId],
    queryFn: async () => {
      let q = db.from("operacao_materiais").select("*").order("produto");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const compras = useQuery({
    queryKey: ["operacao-compras", lojaId],
    queryFn: async () => {
      let q = db.from("operacao_compras").select("*").order("created_at", { ascending: false }).limit(20);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMaterial = useMutation({
    mutationFn: async () => {
      if (!material.produto.trim()) throw new Error("Informe o produto");
      const { error } = await db.from("operacao_materiais").insert({
        loja_id: lojaId,
        produto: material.produto,
        unidade: material.unidade,
        estoque_atual: numberOrZero(material.estoque_atual),
        estoque_minimo: numberOrZero(material.estoque_minimo),
        estoque_maximo: numberOrZero(material.estoque_maximo),
        fornecedor: material.fornecedor || null,
        faturamento: material.faturamento || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material cadastrado");
      queryClient.invalidateQueries({ queryKey: ["operacao-materiais"] });
      setOpenMaterial(false);
      setMaterial({ produto: "", unidade: "un", estoque_atual: "0", estoque_minimo: "0", estoque_maximo: "0", fornecedor: "", faturamento: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar material"),
  });

  const createCompra = useMutation({
    mutationFn: async () => {
      const selected = (materiais.data ?? []).find((m: any) => m.id === compra.material_id);
      const nomeMaterial = selected?.produto ?? compra.material;
      if (!nomeMaterial.trim()) throw new Error("Informe o material da compra");
      const checklist = Object.fromEntries(etapasCompra.map((etapa, idx) => [etapa, idx === 0]));
      const { error } = await db.from("operacao_compras").insert({
        loja_id: lojaId,
        material_id: selected?.id ?? null,
        material: nomeMaterial,
        quantidade: numberOrZero(compra.quantidade) || 1,
        fornecedor: compra.fornecedor || selected?.fornecedor || null,
        fornecedor_cadastrado: compra.fornecedor_cadastrado,
        etapa_atual: etapasCompra[0],
        checklist,
        responsavel_user_id: currentUser.data?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra aberta com checklist");
      queryClient.invalidateQueries({ queryKey: ["operacao-compras"] });
      setOpenCompra(false);
      setCompra({ material_id: "__manual", material: "", quantidade: "1", fornecedor: "", fornecedor_cadastrado: false });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir compra"),
  });

  const updateChecklist = useMutation({
    mutationFn: async ({ row, etapa, checked }: { row: any; etapa: string; checked: boolean }) => {
      const checklist = { ...(row.checklist ?? {}), [etapa]: checked };
      const primeiraPendente = etapasCompra.find((e) => !checklist[e]);
      const encerrado = !primeiraPendente;
      const { error } = await db.from("operacao_compras").update({
        checklist,
        etapa_atual: primeiraPendente ?? etapasCompra[etapasCompra.length - 1],
        status: encerrado ? "encerrado" : "em_andamento",
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist atualizado");
      queryClient.invalidateQueries({ queryKey: ["operacao-compras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar checklist"),
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1"><PackageCheck className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Materiais internos</h2></div>
              <p className="text-xs text-muted-foreground">Estoque minimo, maximo e sugestao de compra.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenMaterial(true)}><Plus className="h-4 w-4" /> Material</Button>
          </div>
          <div className="space-y-2">
            {(materiais.data ?? []).length === 0 ? <Empty text="Nenhum material cadastrado ainda." /> : materiais.data?.map((item: any) => {
              const critico = Number(item.estoque_atual) < Number(item.estoque_minimo);
              const sugestao = Math.max(0, Number(item.estoque_maximo) - Number(item.estoque_atual));
              return (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">{item.produto}</div>
                    <div className="text-xs text-muted-foreground">Estoque {item.estoque_atual} - minimo {item.estoque_minimo} - maximo {item.estoque_maximo}</div>
                    {critico && <div className="text-xs text-muted-foreground">Sugestao: comprar {sugestao} {item.unidade ?? "un"}</div>}
                  </div>
                  <Badge variant={critico ? "destructive" : "secondary"}>{critico ? "Comprar" : "OK"}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Compras com checklist</h2></div>
              <p className="text-xs text-muted-foreground">Processo completo ate NF, Oracle e encerramento.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenCompra(true)}><Plus className="h-4 w-4" /> Compra</Button>
          </div>
          <div className="space-y-3">
            {(compras.data ?? []).length === 0 ? <Empty text="Nenhuma compra aberta ainda." /> : compras.data?.map((item: any) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{item.material}</div>
                  <Badge variant={item.status === "encerrado" ? "secondary" : "outline"}>{item.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Etapa atual: {item.etapa_atual}</div>
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {etapasCompra.map((etapa) => (
                    <label key={etapa} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={Boolean(item.checklist?.[etapa])}
                        onChange={(e) => updateChecklist.mutate({ row: item, etapa, checked: e.target.checked })}
                      />
                      <span className={Boolean(item.checklist?.[etapa]) ? "text-foreground" : "text-muted-foreground"}>{etapa}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openMaterial} onOpenChange={setOpenMaterial}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo material</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Produto"><Input value={material.produto} onChange={(e) => setMaterial({ ...material, produto: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unidade"><Input value={material.unidade} onChange={(e) => setMaterial({ ...material, unidade: e.target.value })} /></Field>
              <Field label="Minimo"><Input inputMode="decimal" value={material.estoque_minimo} onChange={(e) => setMaterial({ ...material, estoque_minimo: e.target.value })} /></Field>
              <Field label="Maximo"><Input inputMode="decimal" value={material.estoque_maximo} onChange={(e) => setMaterial({ ...material, estoque_maximo: e.target.value })} /></Field>
            </div>
            <Field label="Estoque atual"><Input inputMode="decimal" value={material.estoque_atual} onChange={(e) => setMaterial({ ...material, estoque_atual: e.target.value })} /></Field>
            <Field label="Fornecedor"><Input value={material.fornecedor} onChange={(e) => setMaterial({ ...material, fornecedor: e.target.value })} /></Field>
            <Field label="Faturamento"><Input value={material.faturamento} onChange={(e) => setMaterial({ ...material, faturamento: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMaterial(false)}>Cancelar</Button>
            <Button onClick={() => createMaterial.mutate()} disabled={createMaterial.isPending}>{createMaterial.isPending ? "Salvando..." : "Salvar material"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCompra} onOpenChange={setOpenCompra}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova compra</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Material cadastrado">
              <Select value={compra.material_id} onValueChange={(v) => setCompra({ ...compra, material_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">Informar manualmente</SelectItem>
                  {(materiais.data ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.produto}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {compra.material_id === "__manual" && <Field label="Material"><Input value={compra.material} onChange={(e) => setCompra({ ...compra, material: e.target.value })} /></Field>}
            <Field label="Quantidade"><Input inputMode="decimal" value={compra.quantidade} onChange={(e) => setCompra({ ...compra, quantidade: e.target.value })} /></Field>
            <Field label="Fornecedor"><Input value={compra.fornecedor} onChange={(e) => setCompra({ ...compra, fornecedor: e.target.value })} /></Field>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={compra.fornecedor_cadastrado} onChange={(e) => setCompra({ ...compra, fornecedor_cadastrado: e.target.checked })} />
              Fornecedor possui cadastro
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCompra(false)}>Cancelar</Button>
            <Button onClick={() => createCompra.mutate()} disabled={createCompra.isPending}>{createCompra.isPending ? "Abrindo..." : "Abrir compra"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function numberOrZero(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
