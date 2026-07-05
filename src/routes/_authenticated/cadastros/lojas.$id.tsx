import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalFilters } from "@/lib/global-filters";
import { toast } from "sonner";
import { ArrowLeft, Power, PowerOff, Users } from "lucide-react";
import { fmtBRL, fmtInt, fmtDate } from "@/lib/carteira-utils";

export const Route = createFileRoute("/_authenticated/cadastros/lojas/$id")({
  component: LojaDetalhe,
});

type Loja = { id: string; nome: string; codigo: string | null; tipo: string | null; canal: string | null; cidade: string | null; uf: string | null; ativo: boolean };
type VendedorKpi = {
  vendedor_id: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  carteira_qtd: number;
  valor_orcado: number;
  valor_vendido: number;
  ultima_movimentacao: string | null;
};
type LogRow = {
  id: string;
  vendedor_id: string;
  status_anterior: boolean | null;
  status_novo: boolean;
  motivo: string | null;
  created_at: string;
  alterado_por: string | null;
};

type Filtro = "todos" | "ativos" | "inativos" | "com_carteira" | "sem_carteira";

function LojaDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { inicioISO, fimISO } = useGlobalFilters() as any;
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const loja = useQuery({
    queryKey: ["loja", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Loja;
    },
  });

  const vendedores = useQuery({
    queryKey: ["loja-vendedores-kpis", id, inicioISO, fimISO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("loja_vendedores_kpis", {
        p_loja_id: id,
        p_inicio: inicioISO ?? null,
        p_fim: fimISO ?? null,
      });
      if (error) throw error;
      return (data ?? []) as VendedorKpi[];
    },
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (vendedores.data ?? []).filter((v) => {
      if (t && !v.nome.toLowerCase().includes(t) && !(v.email ?? "").toLowerCase().includes(t)) return false;
      if (filtro === "ativos") return v.ativo;
      if (filtro === "inativos") return !v.ativo;
      if (filtro === "com_carteira") return Number(v.carteira_qtd) > 0;
      if (filtro === "sem_carteira") return Number(v.carteira_qtd) === 0;
      return true;
    });
  }, [vendedores.data, busca, filtro]);

  const totais = useMemo(() => {
    const list = vendedores.data ?? [];
    return {
      total: list.length,
      ativos: list.filter((v) => v.ativo).length,
      inativos: list.filter((v) => !v.ativo).length,
      com_carteira: list.filter((v) => Number(v.carteira_qtd) > 0).length,
    };
  }, [vendedores.data]);

  const toggle = useMutation({
    mutationFn: async (p: { vendedor_id: string; ativo: boolean; motivo?: string | null }) => {
      const { error } = await (supabase as any).rpc("set_vendedor_ativo", {
        p_vendedor_id: p.vendedor_id,
        p_ativo: p.ativo,
        p_motivo: p.motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["loja-vendedores-kpis", id] });
      qc.invalidateQueries({ queryKey: ["vendedores-min"] });
      qc.invalidateQueries({ queryKey: ["loja-vendedor-status-log", id] });
      toast.success(v.ativo ? "Vendedor ativado" : "Vendedor desativado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao alterar status"),
  });

  const log = useQuery({
    queryKey: ["loja-vendedor-status-log", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendedor_status_log")
        .select("id,vendedor_id,status_anterior,status_novo,motivo,created_at,alterado_por")
        .eq("loja_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const vendedorNome = (vid: string) => vendedores.data?.find((v) => v.vendedor_id === vid)?.nome ?? vid.slice(0, 8);

  return (
    <div>
      <PageHeader
        title={loja.data?.nome ?? "Loja"}
        description={[loja.data?.codigo, loja.data?.cidade, loja.data?.uf].filter(Boolean).join(" · ")}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/cadastros/lojas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
        }
      />

      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList>
          <TabsTrigger value="vendedores"><Users className="h-4 w-4 mr-1" /> Vendedores da loja</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Mini label="Total" value={fmtInt(totais.total)} />
            <Mini label="Ativos" value={fmtInt(totais.ativos)} />
            <Mini label="Inativos" value={fmtInt(totais.inativos)} />
            <Mini label="Com carteira" value={fmtInt(totais.com_carteira)} />
          </div>

          <Card>
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <Input
                placeholder="Buscar por nome ou e-mail…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="max-w-xs"
              />
              <ToggleGroup type="single" value={filtro} onValueChange={(v) => v && setFiltro(v as Filtro)}>
                <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
                <ToggleGroupItem value="ativos">Ativos</ToggleGroupItem>
                <ToggleGroupItem value="inativos">Inativos</ToggleGroupItem>
                <ToggleGroupItem value="com_carteira">Com carteira</ToggleGroupItem>
                <ToggleGroupItem value="sem_carteira">Sem carteira</ToggleGroupItem>
              </ToggleGroup>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Carteira</TableHead>
                  <TableHead className="text-right">Orçado</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead>Última mov.</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!vendedores.isLoading && filtrados.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum vendedor encontrado.</TableCell></TableRow>
                )}
                {filtrados.map((v) => (
                  <TableRow key={v.vendedor_id}>
                    <TableCell className="font-medium">{v.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{v.email ?? "—"}</TableCell>
                    <TableCell>
                      {v.ativo
                        ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">Ativo</Badge>
                        : <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200" variant="outline">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(v.carteira_qtd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(v.valor_orcado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(v.valor_vendido)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.ultima_movimentacao ? fmtDate(v.ultima_movimentacao.slice(0, 10)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ToggleAction
                        vendedor={v}
                        disabled={toggle.isPending}
                        onConfirm={(motivo) => toggle.mutate({ vendedor_id: v.vendedor_id, ativo: !v.ativo, motivo })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!log.isLoading && (log.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem alterações registradas.</TableCell></TableRow>
                )}
                {(log.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{vendedorNome(r.vendedor_id)}</TableCell>
                    <TableCell>{r.status_anterior === null ? "—" : r.status_anterior ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell>
                      {r.status_novo
                        ? <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Ativo</Badge>
                        : <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.motivo ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleAction({
  vendedor, disabled, onConfirm,
}: { vendedor: VendedorKpi; disabled: boolean; onConfirm: (motivo: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (vendedor.ativo) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={disabled}>
            <PowerOff className="h-4 w-4 mr-1" /> Desativar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {vendedor.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este vendedor será desativado. A carteira dele não será apagada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onConfirm(motivo.trim() || null); setMotivo(""); }}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      size="sm"
      variant="default"
      disabled={disabled}
      onClick={() => onConfirm(null)}
    >
      <Power className="h-4 w-4 mr-1" /> Ativar
    </Button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </CardContent></Card>
  );
}
