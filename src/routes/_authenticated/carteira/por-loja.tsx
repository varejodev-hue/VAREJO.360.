import { Fragment, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGlobalFilters } from "@/lib/global-filters";
import { fmtBRL, fmtDate, fmtInt, fmtPct, STATUS_META } from "@/lib/carteira-utils";
import { downloadCSV } from "@/lib/csv-export";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { CarteiraExpandida } from "./por-vendedor";

export const Route = createFileRoute("/_authenticated/carteira/por-loja")({
  component: PorLoja,
});

type Row = {
  loja_id: string; loja_nome: string; canal: string | null;
  qtd_vendedores: number;
  qtd_especificadores: number; qtd_ativos: number; qtd_risco: number; qtd_inativos: number;
  valor_orcado: number; valor_vendido: number;
  conversao_pct: number; ticket_medio: number; ultimo_contato: string | null;
};

type Vend = {
  vendedor_id: string; vendedor_nome: string;
  loja_id: string | null; loja_nome: string | null;
  qtd_especificadores: number; qtd_ativos: number; qtd_risco: number; qtd_inativos: number;
  valor_orcado: number; valor_vendido: number;
  conversao_pct: number; ticket_medio: number; ultimo_contato: string | null;
};

type Esp = {
  id: string; nome: string; cidade: string | null; uf: string | null;
  status_carteira: string;
  valor_orcado: number; valor_vendido: number;
  qtd_orcamentos: number; qtd_vendas: number;
  ultimo_orcamento: string | null; ultima_venda: string | null;
  dias_sem_contato: number | null;
  conversao_pct: number; ticket_medio: number;
};

function EspecificadoresDoVendedor({ vendedorId, lojaId }: { vendedorId: string; lojaId: string }) {
  const { dataInicio, dataFim } = useGlobalFilters();
  const q = useQuery({
    queryKey: ["carteira", "lista", vendedorId, lojaId, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_especificadores", {
        p_loja: lojaId, p_vendedor: vendedorId, p_status: null, p_busca: null,
        p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Esp[];
    },
  });
  const rows = q.data ?? [];
  return (
    <div className="bg-background border-t p-3">
      <div className="text-[11px] font-medium text-muted-foreground mb-2">Especificadores deste vendedor</div>
      {q.isLoading && <div className="text-xs text-muted-foreground p-2">Carregando…</div>}
      {!q.isLoading && rows.length === 0 && <div className="text-xs text-muted-foreground p-2">Sem especificadores.</div>}
      {rows.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-muted/40">
              <tr>
                {["Especificador","Status","Orçado","Vendido","Conv.","Ticket","Últ. orç.","Dias s/ contato"].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const meta = STATUS_META[e.status_carteira];
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{e.nome}</div>
                      {e.cidade && <div className="text-[10px] text-muted-foreground">{e.cidade}{e.uf ? `/${e.uf}` : ""}</div>}
                    </td>
                    <td className="p-2"><Badge variant="outline" className={meta?.cls}>{meta?.label ?? e.status_carteira}</Badge></td>
                    <td className="p-2 tabular-nums">{fmtBRL(e.valor_orcado)}</td>
                    <td className="p-2 tabular-nums font-medium">{fmtBRL(e.valor_vendido)}</td>
                    <td className="p-2 tabular-nums">{fmtPct(e.conversao_pct)}</td>
                    <td className="p-2 tabular-nums">{fmtBRL(e.ticket_medio)}</td>
                    <td className="p-2">{fmtDate(e.ultimo_orcamento)}</td>
                    <td className="p-2 tabular-nums">{e.dias_sem_contato ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendedoresDaLoja({ lojaId }: { lojaId: string }) {
  const { dataInicio, dataFim } = useGlobalFilters();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const q = useQuery({
    queryKey: ["carteira", "por-vendedor", lojaId, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_por_vendedor", {
        p_loja: lojaId, p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return ((data ?? []) as Vend[]).filter((v) => v.loja_id === lojaId);
    },
  });
  const rows = q.data ?? [];
  return (
    <div className="bg-muted/20 border-y p-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">Vendedores desta loja</div>
      {q.isLoading && <div className="text-sm text-muted-foreground p-2">Carregando…</div>}
      {!q.isLoading && rows.length === 0 && <div className="text-sm text-muted-foreground p-2">Sem vendedores com carteira atribuída.</div>}
      {rows.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 w-8"></th>
                {["Vendedor","Especif.","Ativos","Risco","Inativos","Orçado","Vendido","Conv.","Ticket","Último contato"].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const open = expanded.has(v.vendedor_id);
                return (
                  <Fragment key={v.vendedor_id}>
                    <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(v.vendedor_id)}>
                      <td className="p-2">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                      <td className="p-2 font-medium">{v.vendedor_nome}</td>
                      <td className="p-2 tabular-nums">{v.qtd_especificadores}</td>
                      <td className="p-2 tabular-nums text-emerald-700">{v.qtd_ativos}</td>
                      <td className="p-2 tabular-nums text-amber-700">{v.qtd_risco}</td>
                      <td className="p-2 tabular-nums text-rose-700">{v.qtd_inativos}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(v.valor_orcado)}</td>
                      <td className="p-2 tabular-nums font-medium">{fmtBRL(v.valor_vendido)}</td>
                      <td className="p-2 tabular-nums">{fmtPct(v.conversao_pct)}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(v.ticket_medio)}</td>
                      <td className="p-2">{fmtDate(v.ultimo_contato)}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={11} className="p-0">
                          <CarteiraExpandida vendedorId={v.vendedor_id} vendedorNome={v.vendedor_nome} lojaFiltradaId={lojaId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PorLoja() {
  const { dataInicio, dataFim, lojaId } = useGlobalFilters();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const q = useQuery({
    queryKey: ["carteira", "por-loja", dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_por_loja", {
        p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = (q.data ?? []).filter((r) => !lojaId || r.loja_id === lojaId);

  const totals = rows.reduce(
    (a, r) => ({
      esp: a.esp + r.qtd_especificadores,
      vnd: a.vnd + Number(r.valor_vendido || 0),
      orc: a.orc + Number(r.valor_orcado || 0),
    }),
    { esp: 0, vnd: 0, orc: 0 }
  );

  function exportCsv() {
    downloadCSV("carteira-por-loja", rows.map((r) => ({
      Loja: r.loja_nome, Canal: r.canal ?? "",
      Vendedores: r.qtd_vendedores,
      Especificadores: r.qtd_especificadores, Ativos: r.qtd_ativos,
      "Em risco": r.qtd_risco, Inativos: r.qtd_inativos,
      Orçado: r.valor_orcado, Vendido: r.valor_vendido,
      "Conversão %": r.conversao_pct, "Ticket médio": r.ticket_medio,
      "Último contato": fmtDate(r.ultimo_contato),
    })));
  }

  return (
    <div className="space-y-3 px-1">
      <Card className="p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {fmtInt(rows.length)} lojas · <strong>{fmtInt(totals.esp)}</strong> especificadores ·{" "}
          <strong>{fmtBRL(totals.vnd)}</strong> vendidos no período.
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 w-8"></th>
                {["Loja","Canal","Vendedores","Especif.","Ativos","Risco","Inativos","Orçado","Vendido","Conv.","Ticket","Último contato"].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Sem carteira atribuída.</td></tr>}
              {rows.map((r) => {
                const isOpen = expanded.has(r.loja_id);
                return (
                  <Fragment key={r.loja_id}>
                    <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(r.loja_id)}>
                      <td className="p-2">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="p-2 font-medium">{r.loja_nome}</td>
                      <td className="p-2"><Badge variant="outline" className="capitalize">{r.canal ?? "—"}</Badge></td>
                      <td className="p-2 tabular-nums">{r.qtd_vendedores}</td>
                      <td className="p-2 tabular-nums font-medium">{r.qtd_especificadores}</td>
                      <td className="p-2 tabular-nums text-emerald-700">{r.qtd_ativos}</td>
                      <td className="p-2 tabular-nums text-amber-700">{r.qtd_risco}</td>
                      <td className="p-2 tabular-nums text-rose-700">{r.qtd_inativos}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(r.valor_orcado)}</td>
                      <td className="p-2 tabular-nums font-medium">{fmtBRL(r.valor_vendido)}</td>
                      <td className="p-2 tabular-nums">{fmtPct(r.conversao_pct)}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(r.ticket_medio)}</td>
                      <td className="p-2">{fmtDate(r.ultimo_contato)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={13} className="p-0">
                          <CarteiraExpandida vendedorNome={r.loja_nome} lojaId={r.loja_id} lojaFiltradaId={r.loja_id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
