import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGlobalFilters } from "@/lib/global-filters";
import { fmtBRL, fmtDate, fmtInt, fmtPct, STATUS_META, STATUS_OPTIONS } from "@/lib/carteira-utils";
import { DistribuirDialog, StatusDialog } from "@/components/carteira/dialogs";
import { downloadCSV } from "@/lib/csv-export";
import { Search, Users, Activity, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/distribuir")({
  component: Distribuir,
});

type Row = {
  id: string; nome: string; cidade: string | null; uf: string | null;
  vendedor_id: string | null; vendedor_nome: string | null;
  loja_id: string | null; loja_nome: string | null;
  status_carteira: string;
  valor_orcado: number; valor_vendido: number;
  qtd_orcamentos: number; qtd_vendas: number;
  ultimo_orcamento: string | null; ultima_venda: string | null;
  dias_sem_contato: number | null;
  conversao_pct: number; ticket_medio: number;
};

function Distribuir() {
  const { dataInicio, dataFim, lojaId, vendedorId } = useGlobalFilters();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [openDist, setOpenDist] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);

  const q = useQuery({
    queryKey: ["carteira", "lista", dataInicio, dataFim, lojaId, vendedorId, statusFiltro, busca],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_especificadores", {
        p_loja: lojaId, p_vendedor: vendedorId,
        p_status: statusFiltro === "todos" ? null : statusFiltro,
        p_busca: busca || null,
        p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));

  const totSel = useMemo(() => {
    const ids = sel; let v = 0;
    rows.forEach((r) => { if (ids.has(r.id)) v += r.valor_vendido; });
    return v;
  }, [sel, rows]);

  function exportCsv() {
    downloadCSV("carteira", rows.map((r) => ({
      Especificador: r.nome, Loja: r.loja_nome ?? "", Vendedor: r.vendedor_nome ?? "",
      Status: STATUS_META[r.status_carteira]?.label ?? r.status_carteira,
      "Cidade/UF": `${r.cidade ?? ""}${r.uf ? "/" + r.uf : ""}`,
      Orçado: r.valor_orcado, Vendido: r.valor_vendido,
      "Conversão %": r.conversao_pct, "Ticket médio": r.ticket_medio,
      "Último orçamento": fmtDate(r.ultimo_orcamento),
      "Dias sem contato": r.dias_sem_contato ?? "",
    })));
  }

  return (
    <div className="space-y-3 px-1">
      <Card className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar especificador…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          <strong>{fmtInt(rows.length)}</strong> especificadores.
          {sel.size > 0 && <span className="ml-2 text-muted-foreground">{sel.size} selecionado(s) · {fmtBRL(totSel)} em vendas.</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
          <Button size="sm" variant="outline" disabled={sel.size === 0} onClick={() => setOpenStatus(true)}>
            <Activity className="h-4 w-4" />Alterar status
          </Button>
          <Button size="sm" disabled={sel.size === 0} onClick={() => setOpenDist(true)}>
            <Users className="h-4 w-4" />Atribuir vendedor
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 w-8"><Checkbox checked={rows.length > 0 && sel.size === rows.length} onCheckedChange={toggleAll} /></th>
                {["Especificador","Status","Vendedor","Loja","Orçado","Vendido","Conv.","Ticket","Último mov.","Dias s/ contato"].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Nenhum especificador.</td></tr>}
              {rows.map((r) => {
                const m = STATUS_META[r.status_carteira];
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-2"><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                    <td className="p-2">
                      <div className="font-medium">{r.nome}</div>
                      {r.cidade && <div className="text-xs text-muted-foreground">{r.cidade}{r.uf ? `/${r.uf}` : ""}</div>}
                    </td>
                    <td className="p-2"><Badge className={m?.cls ?? ""}>{m?.label ?? r.status_carteira}</Badge></td>
                    <td className="p-2">{r.vendedor_nome ?? <span className="text-muted-foreground italic">Sem responsável</span>}</td>
                    <td className="p-2 text-muted-foreground">{r.loja_nome ?? "—"}</td>
                    <td className="p-2 tabular-nums">{fmtBRL(r.valor_orcado)}</td>
                    <td className="p-2 tabular-nums font-medium">{fmtBRL(r.valor_vendido)}</td>
                    <td className="p-2 tabular-nums">{fmtPct(r.conversao_pct)}</td>
                    <td className="p-2 tabular-nums">{fmtBRL(r.ticket_medio)}</td>
                    <td className="p-2">{fmtDate(r.ultimo_orcamento)}</td>
                    <td className="p-2 tabular-nums">{r.dias_sem_contato ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <DistribuirDialog open={openDist} onOpenChange={setOpenDist} espIds={[...sel]} onDone={() => setSel(new Set())} />
      <StatusDialog open={openStatus} onOpenChange={setOpenStatus} espIds={[...sel]} onDone={() => setSel(new Set())} />
    </div>
  );
}
