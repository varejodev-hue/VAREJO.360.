import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useGlobalFilters } from "@/lib/global-filters";
import { fmtBRL, fmtDate, fmtInt, fmtPct, STATUS_META } from "@/lib/carteira-utils";
import { downloadCSV } from "@/lib/csv-export";
import { TransferirDialog } from "@/components/carteira/transferir-dialog";
import { StatusDialog } from "@/components/carteira/dialogs";
import { ChevronDown, ChevronRight, Download, MoreHorizontal, ArrowRightLeft, Users, Activity, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/por-vendedor")({
  component: PorVendedor,
});

type Row = {
  vendedor_id: string; vendedor_nome: string;
  loja_id: string | null; loja_nome: string | null;
  qtd_especificadores: number; qtd_ativos: number; qtd_risco: number; qtd_inativos: number;
  valor_orcado: number; valor_vendido: number; conversao_pct: number; ticket_medio: number;
  ultimo_contato: string | null;
};

type Esp = {
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

type DistribLoja = {
  especificador_id: string;
  loja_id: string | null;
  loja_nome: string | null;
  valor_orcado: number;
  valor_vendido: number;
  qtd_orcamentos: number;
  ultimo_orcamento: string | null;
};

type DistribDetalhe = {
  loja_id: string | null;
  loja_nome: string | null;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  valor_orcado: number;
  valor_vendido: number;
  qtd_orcamentos: number;
  ultimo_orcamento: string | null;
  ultima_venda: string | null;
};

type Relacionamento = "preservado" | "dividido" | "em_risco" | "perdido" | "recuperado" | "inativo";

const REL_META: Record<Relacionamento, { label: string; cls: string; acao: string }> = {
  preservado:  { label: "Preservado", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", acao: "Manter relacionamento" },
  dividido:    { label: "Dividido",   cls: "bg-amber-100 text-amber-800 border-amber-200",       acao: "Reforçar vínculo e oferta" },
  em_risco:    { label: "Em risco",   cls: "bg-rose-100 text-rose-800 border-rose-200",          acao: "Contato imediato do vendedor" },
  perdido:     { label: "Perdido",    cls: "bg-zinc-200 text-zinc-800 border-zinc-300",          acao: "Plano de recuperação ou reatribuir" },
  recuperado:  { label: "Recuperado", cls: "bg-sky-100 text-sky-800 border-sky-200",             acao: "Fidelizar com follow-up D+7" },
  inativo:     { label: "Inativo",    cls: "bg-zinc-100 text-zinc-700 border-zinc-200",          acao: "Reativar campanha" },
};

function EspDrawer({ esp, open, onClose }: { esp: Esp | null; open: boolean; onClose: () => void }) {
  const { dataInicio, dataFim } = useGlobalFilters();
  const q = useQuery({
    enabled: open && !!esp?.id,
    queryKey: ["carteira", "esp-detalhe", esp?.id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_esp_distribuicao_detalhe", {
        p_esp: esp!.id, p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as DistribDetalhe[];
    },
  });

  const rows = q.data ?? [];
  const totalOrc = rows.reduce((a, r) => a + Number(r.valor_orcado || 0), 0);

  return (
    <Sheet open={open} onOpenChange={(b) => !b && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{esp?.nome}</SheetTitle>
          <SheetDescription>
            Distribuição por loja e vendedor no período selecionado.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {q.isLoading && <div className="text-sm text-muted-foreground p-4">Carregando…</div>}
          {!q.isLoading && rows.length === 0 && (
            <div className="text-sm text-muted-foreground p-4">Sem movimentação no período.</div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40">
                <tr>
                  {["Loja","Vendedor","Orçado","Vendido","Part. %","Últ. orç.","Últ. venda"].map((h) => (
                    <th key={h} className="text-left p-2 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const pct = totalOrc > 0 ? (Number(r.valor_orcado) / totalOrc) * 100 : 0;
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.loja_nome ?? "—"}</td>
                      <td className="p-2">{r.vendedor_nome ?? "—"}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(r.valor_orcado)}</td>
                      <td className="p-2 tabular-nums font-medium">{fmtBRL(r.valor_vendido)}</td>
                      <td className="p-2 tabular-nums">{fmtPct(pct)}</td>
                      <td className="p-2">{fmtDate(r.ultimo_orcamento)}</td>
                      <td className="p-2">{fmtDate(r.ultima_venda)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LojaForaBadge({ outras }: { outras: { loja_id: string | null; loja_nome: string | null; valor_orcado: number }[] }) {
  if (outras.length === 0) return null;
  const label = outras.length === 1
    ? `Orçou em ${outras[0].loja_nome ?? "outra loja"}`
    : `Orçou em ${outras.length} lojas`;
  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 cursor-help gap-1">
          <MapPin className="h-3 w-3" />{label}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <div className="text-xs font-medium mb-2">Movimento fora da loja filtrada</div>
        <ul className="space-y-1 text-xs">
          {outras.map((o, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{o.loja_nome ?? "—"}</span>
              <span className="tabular-nums text-muted-foreground">{fmtBRL(o.valor_orcado)}</span>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function CarteiraExpandida({ vendedorId, vendedorNome, lojaFiltradaId, lojaId }: { vendedorId?: string | null; vendedorNome: string; lojaFiltradaId: string | null; lojaId?: string | null }) {
  const { dataInicio, dataFim } = useGlobalFilters();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [openTransf, setOpenTransf] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [drawerEsp, setDrawerEsp] = useState<Esp | null>(null);

  const scopeKey = vendedorId ? `v:${vendedorId}` : `l:${lojaId ?? ""}`;

  const q = useQuery({
    queryKey: ["carteira", "lista", scopeKey, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_especificadores", {
        p_loja: vendedorId ? null : (lojaId ?? null), p_vendedor: vendedorId ?? null, p_status: null, p_busca: null,
        p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Esp[];
    },
  });

  const qDistrib = useQuery({
    queryKey: ["carteira", "distrib-lojas", scopeKey, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_esp_distribuicao_lojas", {
        p_loja: vendedorId ? null : (lojaId ?? null), p_vendedor: vendedorId ?? null, p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as DistribLoja[];
    },
  });

  const distribByEsp = useMemo(() => {
    const m = new Map<string, DistribLoja[]>();
    (qDistrib.data ?? []).forEach((d) => {
      const k = d.especificador_id;
      const arr = m.get(k) ?? [];
      arr.push(d);
      m.set(k, arr);
    });
    return m;
  }, [qDistrib.data]);

  const rows = useMemo(() => {
    const all = q.data ?? [];
    if (filtroStatus === "todos") return all;
    if (filtroStatus === "inativos_60") return all.filter((r) => (r.dias_sem_contato ?? 0) >= 60);
    return all.filter((r) => r.status_carteira === filtroStatus);
  }, [q.data, filtroStatus]);

  function resumoEsp(esp: Esp) {
    const distrib = distribByEsp.get(esp.id) ?? [];
    const lojaRef = lojaFiltradaId ?? esp.loja_id;
    const dentroArr = distrib.filter((d) => lojaRef && d.loja_id === lojaRef);
    const dentro = dentroArr.reduce((a, d) => a + Number(d.valor_orcado || 0), 0);
    const fora = distrib.filter((d) => !lojaRef || d.loja_id !== lojaRef)
      .sort((a, b) => Number(b.valor_orcado) - Number(a.valor_orcado));
    const valorFora = fora.reduce((a, d) => a + Number(d.valor_orcado || 0), 0);
    const total = dentro + valorFora;
    const evasao = total > 0 ? (valorFora / total) * 100 : 0;
    const ultimaDentro = dentroArr.map((d) => d.ultimo_orcamento).filter(Boolean).sort().pop() ?? null;
    const ultimaFora = fora.map((d) => d.ultimo_orcamento).filter(Boolean).sort().pop() ?? null;
    const diasSemDentro = ultimaDentro ? Math.floor((Date.now() - new Date(ultimaDentro).getTime()) / 86400000) : 99999;
    const principalDestino = fora[0]?.loja_nome ?? null;

    let rel: Relacionamento;
    if (total === 0) rel = "inativo";
    else if (!lojaRef) rel = "preservado";
    else if (dentro === 0 && valorFora > 0 && diasSemDentro > 90) rel = "perdido";
    else if (dentro === 0 && valorFora > 0) rel = "em_risco";
    else if (valorFora === 0) rel = "preservado";
    else if (ultimaDentro && ultimaFora && ultimaDentro > ultimaFora) rel = "recuperado";
    else rel = "dividido";
    return { dentro, valorFora, fora, evasao, ultimaFora, principalDestino, rel };
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));

  function exportCsv() {
    downloadCSV(`carteira-${vendedorNome}`, rows.map((r) => {
      const x = resumoEsp(r);
      return {
        Especificador: r.nome,
        Status: STATUS_META[r.status_carteira]?.label ?? r.status_carteira,
        Relacionamento: REL_META[x.rel].label,
        "Nesta loja": x.dentro, "Fora da loja": x.valorFora,
        "Evasão %": x.evasao.toFixed(1),
        "Principal destino": x.principalDestino ?? "",
        "Última mov. fora": fmtDate(x.ultimaFora),
        Vendido: r.valor_vendido, "Conv.%": r.conversao_pct,
        "Último orçamento": fmtDate(r.ultimo_orcamento),
        "Dias s/ contato": r.dias_sem_contato ?? "",
        "Ação recomendada": REL_META[x.rel].acao,
      };
    }));
  }

  const resumos = useMemo(() => rows.map((r) => ({ esp: r, ...resumoEsp(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, distribByEsp, lojaFiltradaId]);

  const kpis = useMemo(() => {
    const total = resumos.reduce((a, x) => a + x.dentro + x.valorFora, 0);
    const fora = resumos.reduce((a, x) => a + x.valorFora, 0);
    const emRisco = resumos.filter((x) => x.rel === "em_risco" || x.rel === "perdido").length;
    const recuperaveis = resumos.filter((x) => x.rel === "recuperado" || x.rel === "dividido").length;
    const destinoMap = new Map<string, number>();
    resumos.forEach((x) => x.fora.forEach((f) => {
      const k = f.loja_nome ?? "—";
      destinoMap.set(k, (destinoMap.get(k) ?? 0) + Number(f.valor_orcado || 0));
    }));
    const principalDestino = [...destinoMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      valorFora: fora,
      evasao: total > 0 ? (fora / total) * 100 : 0,
      emRisco, pctRisco: resumos.length > 0 ? (emRisco / resumos.length) * 100 : 0,
      recuperaveis,
      principalDestino,
    };
  }, [resumos]);

  const contagem = useMemo(() => {
    const desta = lojaFiltradaId ? rows.filter((r) => r.loja_id === lojaFiltradaId).length : rows.length;
    return { total: rows.length, desta, fora: rows.length - desta };
  }, [rows, lojaFiltradaId]);

  return (
    <div className="bg-muted/20 border-y">
      {lojaFiltradaId && (
        <div className="px-3 pt-3 text-[11px] text-muted-foreground">
          Mostrando <strong className="text-foreground">{contagem.total}</strong> especificadores deste vendedor ·{" "}
          <strong className="text-foreground">{contagem.desta}</strong> desta loja (contam na linha acima) ·{" "}
          <strong className="text-foreground">{contagem.fora}</strong> atendidos em outras lojas. Métricas de evasão usam a loja filtrada como referência.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3">
        <Kpi label="Valor em risco (fora)" value={fmtBRL(kpis.valorFora)} tone="risk" />
        <Kpi label="% Evasão da carteira" value={`${kpis.evasao.toFixed(1)}%`} tone={kpis.evasao > 30 ? "risk" : kpis.evasao > 10 ? "warn" : "ok"} />
        <Kpi label="Especificadores em risco" value={`${kpis.emRisco} (${kpis.pctRisco.toFixed(0)}%)`} tone={kpis.emRisco > 0 ? "warn" : "ok"} />
        <Kpi label="Principal loja destino" value={kpis.principalDestino?.[0] ?? "—"} sub={kpis.principalDestino ? fmtBRL(kpis.principalDestino[1]) : undefined} />
        <Kpi label="Recuperáveis" value={String(kpis.recuperaveis)} tone="ok" sub="dividido + recuperado" />
      </div>

      <div className="p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted-foreground">Filtrar:</span>
          {[
            { v: "todos", l: "Todos" },
            { v: "ativo", l: "Ativos" },
            { v: "em_risco", l: "Em risco" },
            { v: "inativo", l: "Inativos" },
            { v: "inativos_60", l: "Sem contato 60d+" },
          ].map((o) => (
            <Button key={o.v} size="sm" variant={filtroStatus === o.v ? "default" : "outline"} className="h-7"
              onClick={() => setFiltroStatus(o.v)}>{o.l}</Button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground self-center">{sel.size} de {rows.length} selecionado(s)</span>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
          <Button size="sm" variant="outline" disabled={sel.size === 0} onClick={() => setOpenStatus(true)}>
            <Activity className="h-4 w-4" />Status
          </Button>
          <Button size="sm" disabled={sel.size === 0} onClick={() => setOpenTransf(true)}>
            <ArrowRightLeft className="h-4 w-4" />Transferir selecionados
          </Button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 w-8"><Checkbox checked={rows.length > 0 && sel.size === rows.length} onCheckedChange={toggleAll} /></th>
              {["Especificador","Relacionamento","Nesta loja","Fora da loja","Evasão","Principal destino","Últ. mov. fora","Dias s/ contato","Ação recomendada"].map((h) => (
                <th key={h} className="text-left p-2 font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
            {!q.isLoading && rows.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Sem especificadores.</td></tr>}
            {rows.map((r) => {
              const x = resumoEsp(r);
              const relMeta = REL_META[x.rel];
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2"><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                  <td className="p-2">
                    <button className="text-left hover:underline" onClick={() => setDrawerEsp(r)}>
                      <div className="font-medium">{r.nome}</div>
                      {r.cidade && <div className="text-[11px] text-muted-foreground">{r.cidade}{r.uf ? `/${r.uf}` : ""}</div>}
                    </button>
                  </td>
                  <td className="p-2"><Badge variant="outline" className={relMeta.cls}>{relMeta.label}</Badge></td>
                  <td className="p-2 tabular-nums">{fmtBRL(x.dentro)}</td>
                  <td className="p-2">
                    <button className="flex items-center gap-2 hover:underline" onClick={() => setDrawerEsp(r)}>
                      <span className="tabular-nums">{fmtBRL(x.valorFora)}</span>
                      <LojaForaBadge outras={x.fora} />
                    </button>
                  </td>
                  <td className="p-2 tabular-nums">
                    <span className={x.evasao > 30 ? "text-rose-700 font-medium" : x.evasao > 10 ? "text-amber-700" : "text-muted-foreground"}>
                      {x.evasao.toFixed(0)}%
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{x.principalDestino ?? "—"}</td>
                  <td className="p-2">{fmtDate(x.ultimaFora)}</td>
                  <td className="p-2 tabular-nums">{r.dias_sem_contato ?? "—"}</td>
                  <td className="p-2 text-[11px] text-muted-foreground">{relMeta.acao}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TransferirDialog open={openTransf} onOpenChange={setOpenTransf}
        vendedorOrigemId={vendedorId} vendedorOrigemNome={vendedorNome}
        espIds={[...sel]} onDone={() => setSel(new Set())} />
      <StatusDialog open={openStatus} onOpenChange={setOpenStatus}
        espIds={[...sel]} onDone={() => setSel(new Set())} />
      <EspDrawer esp={drawerEsp} open={!!drawerEsp} onClose={() => setDrawerEsp(null)} />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "risk" }) {
  const cls = tone === "risk" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums truncate ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function PorVendedor() {
  const { dataInicio, dataFim, lojaId } = useGlobalFilters();
  const [expandido, setExpandido] = useState<string | null>(null);
  const [transfVendedor, setTransfVendedor] = useState<Row | null>(null);

  const q = useQuery({
    queryKey: ["carteira", "por-vendedor", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_por_vendedor", {
        p_loja: lojaId, p_inicio: dataInicio, p_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const media = rows.length ? rows.reduce((a, r) => a + r.qtd_especificadores, 0) / rows.length : 0;

  function exportCsv() {
    downloadCSV("carteira-por-vendedor", rows.map((r) => ({
      Vendedor: r.vendedor_nome, Loja: r.loja_nome ?? "",
      Especificadores: r.qtd_especificadores, Ativos: r.qtd_ativos, "Em risco": r.qtd_risco, Inativos: r.qtd_inativos,
      Orçado: r.valor_orcado, Vendido: r.valor_vendido,
      "Conversão %": r.conversao_pct, "Ticket médio": r.ticket_medio,
      "Último contato": fmtDate(r.ultimo_contato),
    })));
  }

  return (
    <div className="space-y-3 px-1">
      <Card className="p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {fmtInt(rows.length)} vendedores · média de <strong>{media.toFixed(0)}</strong> especificadores/vendedor. Clique no vendedor para ver a carteira.
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-8" />
                {["Vendedor","Loja","Total","Ativos","Risco","Inativos","Orçado","Vendido","Conv.","Ticket","Último contato",""].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Sem carteira atribuída.</td></tr>}
              {rows.map((r) => {
                const sobrecarregado = media > 0 && r.qtd_especificadores > media * 1.5;
                const aberto = expandido === r.vendedor_id;
                return (
                  <Fragment key={r.vendedor_id}>
                    <tr className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpandido(aberto ? null : r.vendedor_id)}>
                      <td className="p-2 text-center">{aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="p-2 font-medium">{r.vendedor_nome}</td>
                      <td className="p-2 text-muted-foreground">{r.loja_nome ?? "—"}</td>
                      <td className={`p-2 tabular-nums font-medium ${sobrecarregado ? "text-amber-700" : ""}`}>{r.qtd_especificadores}</td>
                      <td className="p-2 tabular-nums text-emerald-700">{r.qtd_ativos}</td>
                      <td className="p-2 tabular-nums text-amber-700">{r.qtd_risco}</td>
                      <td className="p-2 tabular-nums text-rose-700">{r.qtd_inativos}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(r.valor_orcado)}</td>
                      <td className="p-2 tabular-nums font-medium">{fmtBRL(r.valor_vendido)}</td>
                      <td className="p-2 tabular-nums">{fmtPct(r.conversao_pct)}</td>
                      <td className="p-2 tabular-nums">{fmtBRL(r.ticket_medio)}</td>
                      <td className="p-2">{fmtDate(r.ultimo_contato)}</td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setExpandido(r.vendedor_id)}>
                              <Users className="h-4 w-4 mr-2" />Ver carteira
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setTransfVendedor(r)}>
                              <ArrowRightLeft className="h-4 w-4 mr-2" />Transferir carteira inteira
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                    {aberto && (
                      <tr>
                        <td colSpan={13} className="p-0">
                          <CarteiraExpandida vendedorId={r.vendedor_id} vendedorNome={r.vendedor_nome} lojaFiltradaId={lojaId ?? r.loja_id} />
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

      <TransferirDialog
        open={!!transfVendedor}
        onOpenChange={(b) => !b && setTransfVendedor(null)}
        vendedorOrigemId={transfVendedor?.vendedor_id}
        vendedorOrigemNome={transfVendedor?.vendedor_nome}
        espIds={[]}
      />
    </div>
  );
}
