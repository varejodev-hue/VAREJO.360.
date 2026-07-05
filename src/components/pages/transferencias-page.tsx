import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightLeft, TrendingUp, TrendingDown, Minus, AlertCircle, Plus, Users2 } from "lucide-react";
import { toast } from "sonner";

export { TransferenciasPage };


const MOTIVOS = [
  "Troca de gerente",
  "Troca de vendedor",
  "Reestruturação comercial",
  "Mudança de região",
  "Solicitação do especificador",
  "Recuperação de relacionamento",
  "Baixa performance",
  "Outro",
];

const FEEDBACKS = [
  "Gostou do atendimento",
  "Não gostou do atendimento",
  "Sem retorno",
  "Solicita novo responsável",
  "Solicita nova loja",
  "Solicita visita",
  "Relacionamento recuperado",
  "Relacionamento em risco",
];

const PERIODOS = [30, 60, 90, 180] as const;

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtDate(s: string | null) { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; }

type Resultado = "melhorou" | "estavel" | "piorou" | "sem_movimentacao";
const resultadoMeta: Record<Resultado, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  melhorou: { label: "Melhorou", cls: "bg-green-100 text-green-800", icon: TrendingUp },
  estavel: { label: "Estável", cls: "bg-blue-100 text-blue-800", icon: Minus },
  piorou: { label: "Piorou", cls: "bg-red-100 text-red-800", icon: TrendingDown },
  sem_movimentacao: { label: "Sem movimentação", cls: "bg-gray-100 text-gray-800", icon: AlertCircle },
};

function classificar(antes: { orcado: number; vendido: number; qtd: number }, depois: { orcado: number; vendido: number; qtd: number }): Resultado {
  if (depois.qtd === 0 && depois.orcado === 0) return "sem_movimentacao";
  const baseRef = antes.vendido || antes.orcado || 1;
  const depRef = depois.vendido || depois.orcado;
  const delta = (depRef - baseRef) / baseRef;
  if (delta > 0.1) return "melhorou";
  if (delta < -0.1) return "piorou";
  return "estavel";
}

function TransferenciasPage() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<number>(90);
  const [busca, setBusca] = useState("");
  const [filtroResultado, setFiltroResultado] = useState<string>("todos");
  const [openIndividual, setOpenIndividual] = useState(false);
  const [openMassa, setOpenMassa] = useState(false);

  const { data: especificadores = [] } = useQuery({
    queryKey: ["especificadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("especificadores").select("id,nome,ativo").order("nome");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendedores").select("id,nome,loja_id").order("nome");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id,nome").order("nome");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: orcamentos = [] } = useQuery({
    queryKey: ["orcamentos-transf"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orcamentos")
        .select("especificador_id,data_orcamento,data_venda,valor_orcado,valor_vendido");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: transferencias = [], isLoading } = useQuery({
    queryKey: ["transferencias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transferencias_especificador")
        .select("*").order("data_transferencia", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const espMap = useMemo(() => new Map(especificadores.map((e: any) => [e.id, e])), [especificadores]);
  const vendMap = useMemo(() => new Map(vendedores.map((v: any) => [v.id, v])), [vendedores]);
  const lojaMap = useMemo(() => new Map(lojas.map((l: any) => [l.id, l])), [lojas]);

  const rows = useMemo(() => {
    return transferencias.map((t: any) => {
      const dt = new Date(t.data_transferencia).getTime();
      const ms = periodo * 86400000;
      const antes = { orcado: 0, vendido: 0, qtd: 0, vendas: 0 };
      const depois = { orcado: 0, vendido: 0, qtd: 0, vendas: 0 };
      orcamentos.filter((o: any) => o.especificador_id === t.especificador_id).forEach((o: any) => {
        if (!o.data_orcamento) return;
        const od = new Date(o.data_orcamento).getTime();
        const orc = Number(o.valor_orcado ?? 0);
        const vnd = Number(o.valor_vendido ?? 0);
        if (od >= dt - ms && od < dt) { antes.orcado += orc; antes.vendido += vnd; antes.qtd += 1; if (vnd > 0) antes.vendas += 1; }
        else if (od >= dt && od <= dt + ms) { depois.orcado += orc; depois.vendido += vnd; depois.qtd += 1; if (vnd > 0) depois.vendas += 1; }
      });
      const resultado = classificar(antes, depois);
      return { ...t, antes, depois, resultado };
    });
  }, [transferencias, orcamentos, periodo]);

  const filtered = useMemo(() => {
    const b = busca.toLowerCase();
    return rows.filter((r: any) => {
      const esp = espMap.get(r.especificador_id);
      if (b && !esp?.nome?.toLowerCase().includes(b)) return false;
      if (filtroResultado !== "todos" && r.resultado !== filtroResultado) return false;
      return true;
    });
  }, [rows, busca, filtroResultado, espMap]);

  const kpis = useMemo(() => {
    const qtd = rows.length;
    const valor = rows.reduce((s: number, r: any) => s + r.depois.vendido, 0);
    const sucesso = rows.filter((r: any) => r.resultado === "melhorou" || r.resultado === "estavel").length;
    const recuperados = rows.filter((r: any) => r.feedback === "Relacionamento recuperado").length;
    const perdidos = rows.filter((r: any) => r.resultado === "sem_movimentacao" || r.feedback === "Relacionamento em risco").length;
    return {
      qtd, valor,
      taxaSucesso: qtd ? sucesso / qtd : 0,
      recuperados, perdidos,
      acompanhamento: rows.filter((r: any) => r.proxima_acao).length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Transferência de Carteira" description="Acompanhe mudanças de relacionamento entre vendedores, lojas e especificadores"
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenMassa(true)}><Users2 className="h-4 w-4 mr-2" />Em Massa</Button>
          <NovaTransferencia open={openIndividual} setOpen={setOpenIndividual}
            especificadores={especificadores} vendedores={vendedores} lojas={lojas}
            onSaved={() => qc.invalidateQueries({ queryKey: ["transferencias"] })} />
        </div>} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Transferências" value={String(kpis.qtd)} />
        <Kpi label="Valor pós" value={fmtMoney(kpis.valor)} />
        <Kpi label="Taxa de sucesso" value={`${(kpis.taxaSucesso * 100).toFixed(0)}%`} />
        <Kpi label="Recuperados" value={String(kpis.recuperados)} cls="text-green-700" />
        <Kpi label="Perdidos" value={String(kpis.perdidos)} cls="text-red-700" />
        <Kpi label="Acompanhamento" value={String(kpis.acompanhamento)} cls="text-amber-700" />
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Buscar especificador…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Select value={filtroResultado} onValueChange={setFiltroResultado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos resultados</SelectItem>
              <SelectItem value="melhorou">Melhorou</SelectItem>
              <SelectItem value="estavel">Estável</SelectItem>
              <SelectItem value="piorou">Piorou</SelectItem>
              <SelectItem value="sem_movimentacao">Sem movimentação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => <SelectItem key={p} value={String(p)}>Análise: {p} dias</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground self-center">{filtered.length} de {rows.length}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Especificador</th>
                <th className="py-2 pr-3">Origem</th>
                <th className="py-2 pr-3">Destino</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Motivo</th>
                <th className="py-2 pr-3 text-right">Antes</th>
                <th className="py-2 pr-3 text-right">Depois</th>
                <th className="py-2 pr-3">Resultado</th>
                <th className="py-2 pr-3">Próxima ação</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Nenhuma transferência registrada</td></tr>}
              {filtered.map((r: any) => {
                const meta = resultadoMeta[r.resultado as Resultado];
                const Icon = meta.icon;
                const esp = espMap.get(r.especificador_id);
                const vo = vendMap.get(r.vendedor_origem_id);
                const vd = vendMap.get(r.vendedor_destino_id);
                const lo = lojaMap.get(r.loja_origem_id);
                const ld = lojaMap.get(r.loja_destino_id);
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-3 font-medium">{esp?.nome ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{lo?.nome ?? "—"}<br /><span className="text-muted-foreground">{vo?.nome ?? "—"}</span></td>
                    <td className="py-2 pr-3 text-xs">{ld?.nome ?? "—"}<br /><span className="text-muted-foreground">{vd?.nome ?? "—"}</span></td>
                    <td className="py-2 pr-3">{fmtDate(r.data_transferencia)}</td>
                    <td className="py-2 pr-3 text-xs">{r.motivo}</td>
                    <td className="py-2 pr-3 text-right text-xs">
                      <div>{fmtMoney(r.antes.vendido)}</div>
                      <div className="text-muted-foreground">{r.antes.qtd} orç.</div>
                    </td>
                    <td className="py-2 pr-3 text-right text-xs">
                      <div>{fmtMoney(r.depois.vendido)}</div>
                      <div className="text-muted-foreground">{r.depois.qtd} orç.</div>
                    </td>
                    <td className="py-2 pr-3"><Badge className={meta.cls}><Icon className="h-3 w-3 mr-1" />{meta.label}</Badge></td>
                    <td className="py-2 pr-3 text-xs">{r.proxima_acao ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <FeedbackDialog row={r} onSaved={() => qc.invalidateQueries({ queryKey: ["transferencias"] })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <TransferenciaMassa open={openMassa} setOpen={setOpenMassa}
        especificadores={especificadores} vendedores={vendedores} lojas={lojas}
        onSaved={() => qc.invalidateQueries({ queryKey: ["transferencias"] })} />
    </div>
  );
}

function Kpi({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${cls ?? ""}`}>{value}</div>
    </Card>
  );
}

function NovaTransferencia({ open, setOpen, especificadores, vendedores, lojas, onSaved }: any) {
  const [form, setForm] = useState<any>({
    especificador_id: "", loja_origem_id: "", vendedor_origem_id: "",
    loja_destino_id: "", vendedor_destino_id: "", motivo: "", observacao: "",
    data_transferencia: new Date().toISOString().slice(0,10),
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!form.especificador_id || !form.motivo) throw new Error("Especificador e motivo são obrigatórios");
      const { data: u } = await supabase.auth.getUser();
      const payload = { ...form, responsavel_id: u.user?.id ?? null };
      Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
      const { error } = await supabase.from("transferencias_especificador").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transferência registrada"); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nova Transferência</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Transferência Individual</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Especificador *">
            <Select value={form.especificador_id} onValueChange={(v) => setForm({ ...form, especificador_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{especificadores.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Data *">
            <Input type="date" value={form.data_transferencia} onChange={(e) => setForm({ ...form, data_transferencia: e.target.value })} />
          </Field>
          <Field label="Loja origem">
            <Select value={form.loja_origem_id} onValueChange={(v) => setForm({ ...form, loja_origem_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vendedor origem">
            <Select value={form.vendedor_origem_id} onValueChange={(v) => setForm({ ...form, vendedor_origem_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Loja destino">
            <Select value={form.loja_destino_id} onValueChange={(v) => setForm({ ...form, loja_destino_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vendedor destino">
            <Select value={form.vendedor_destino_id} onValueChange={(v) => setForm({ ...form, vendedor_destino_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Motivo *" className="col-span-2">
            <Select value={form.motivo} onValueChange={(v) => setForm({ ...form, motivo: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Observação" className="col-span-2">
            <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferenciaMassa({ open, setOpen, especificadores, vendedores, lojas, onSaved }: any) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<any>({
    loja_destino_id: "", vendedor_destino_id: "", motivo: "",
    data_transferencia: new Date().toISOString().slice(0,10),
  });
  const [filtroAtivo, setFiltroAtivo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const lista = especificadores.filter((e: any) => {
    if (filtroAtivo === "ativo" && !e.ativo) return false;
    if (filtroAtivo === "inativo" && e.ativo) return false;
    if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const toggle = (id: string) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };

  const m = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) throw new Error("Selecione ao menos um especificador");
      if (!form.motivo) throw new Error("Motivo obrigatório");
      const { data: u } = await supabase.auth.getUser();
      const rows = Array.from(selected).map(id => ({
        especificador_id: id,
        loja_destino_id: form.loja_destino_id || null,
        vendedor_destino_id: form.vendedor_destino_id || null,
        motivo: form.motivo,
        data_transferencia: form.data_transferencia,
        responsavel_id: u.user?.id ?? null,
      }));
      const { error } = await supabase.from("transferencias_especificador").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`${selected.size} transferências registradas`); setSelected(new Set()); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Transferência em Massa</DialogTitle></DialogHeader>
        <Tabs defaultValue="selecao" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="selecao">Seleção ({selected.size})</TabsTrigger>
            <TabsTrigger value="destino">Destino & Motivo</TabsTrigger>
          </TabsList>
          <TabsContent value="selecao" className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded overflow-y-auto flex-1">
              {lista.map((e: any) => (
                <label key={e.id} className="flex items-center gap-2 p-2 border-b cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  <span>{e.nome}</span>
                  {!e.ativo && <Badge variant="outline" className="ml-auto text-xs">inativo</Badge>}
                </label>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="destino" className="space-y-3">
            <Field label="Loja destino">
              <Select value={form.loja_destino_id} onValueChange={(v) => setForm({ ...form, loja_destino_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Vendedor destino">
              <Select value={form.vendedor_destino_id} onValueChange={(v) => setForm({ ...form, vendedor_destino_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Motivo *">
              <Select value={form.motivo} onValueChange={(v) => setForm({ ...form, motivo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{MOTIVOS.map(mo => <SelectItem key={mo} value={mo}>{mo}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input type="date" value={form.data_transferencia} onChange={(e) => setForm({ ...form, data_transferencia: e.target.value })} />
            </Field>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />Transferir {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDialog({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string>(row.feedback ?? "");
  const [proxima, setProxima] = useState<string>(row.proxima_acao ?? "");
  const sugestao = useMemo(() => {
    if (row.resultado === "piorou" || row.resultado === "sem_movimentacao") {
      return ["Visita comercial recomendada", "Acompanhamento do gerente", "Nova transferência sugerida", "Reunião de alinhamento", "Recuperação de relacionamento"];
    }
    return [];
  }, [row.resultado]);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transferencias_especificador")
        .update({ feedback: feedback || null, proxima_acao: proxima || null, resultado: row.resultado })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">Feedback</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Feedback do Relacionamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Feedback">
            <Select value={feedback} onValueChange={setFeedback}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{FEEDBACKS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Próxima ação">
            {sugestao.length > 0 ? (
              <Select value={proxima} onValueChange={setProxima}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{sugestao.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input value={proxima} onChange={(e) => setProxima(e.target.value)} placeholder="Descreva…" />
            )}
          </Field>
          {sugestao.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded flex gap-2"><AlertCircle className="h-4 w-4 shrink-0" />Resultado em queda — ação recomendada</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
