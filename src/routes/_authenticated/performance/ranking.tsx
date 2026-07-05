import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";
import { useGlobalFilters } from "@/lib/global-filters";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText, Store, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/ranking")({
  component: Ranking,
});

type Row = {
  loja_id: string | null;
  vendedor_id: string | null;
  especificador_id: string | null;
  valor_orcado: number | null;
  valor_vendido: number | null;
  status: string | null;
  lojas: { nome: string } | null;
  vendedores: { nome: string } | null;
};

type RankRow = {
  id: string;
  nome: string;
  loja: string;
  qtd: number;
  b2b: number;
  b2c: number;
  vendidos: number;
  orcado: number;
  vendido: number;
  ticketMedio: number;
  conv: number;
  comparativoQtd: number;
  comparativoOrcado: number;
  comparativoVendido: number;
  deltaQtd: number;
  deltaQtdPct: number | null;
  deltaOrcado: number;
  deltaOrcadoPct: number | null;
  deltaVendido: number;
  deltaVendidoPct: number | null;
};

type Comparativo = "none" | "mes_anterior" | "ano_anterior";

function Ranking() {
  const { inicioISO, fimISO, lojaId } = useGlobalFilters();
  const [tab, setTab] = useState<"lojas" | "vendedores">("lojas");
  const [lojaDetalheId, setLojaDetalheId] = useState<string | null>(null);
  const [comparativo, setComparativo] = useState<Comparativo>("none");
  const lojaAtiva = lojaId ?? lojaDetalheId;
  const rangeComparativo = useMemo(() => getCompareRange(inicioISO, fimISO, comparativo), [inicioISO, fimISO, comparativo]);

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["ranking-entrada-orcamento", inicioISO, fimISO, lojaId, comparativo],
    queryFn: async () => {
      const atual = fetchOrcamentos(inicioISO, fimISO, lojaId);
      const anterior = rangeComparativo ? fetchOrcamentos(rangeComparativo.inicio, rangeComparativo.fim, lojaId) : Promise.resolve([] as Row[]);
      const [data, compareData] = await Promise.all([atual, anterior]);
      return { data, compareData };
    },
  });

  const data = queryData?.data ?? [];
  const compareData = queryData?.compareData ?? [];

  const rankingLojas = useMemo(() => buildRanking(data, "loja", compareData), [data, compareData]);
  const rankingVendedores = useMemo(() => {
    const rows = lojaAtiva ? data.filter((r) => r.loja_id === lojaAtiva) : data;
    const compareRows = lojaAtiva ? compareData.filter((r) => r.loja_id === lojaAtiva) : compareData;
    return buildRanking(rows, "vendedor", compareRows);
  }, [data, compareData, lojaAtiva]);

  const lojaDetalhe = rankingLojas.find((r) => r.id === lojaAtiva);
  const resumo = useMemo(() => {
    const qtd = data.length;
    const vendido = data.reduce((s, r) => s + money(r.valor_vendido), 0);
    const orcado = data.reduce((s, r) => s + money(r.valor_orcado), 0);
    const vendas = data.filter((r) => money(r.valor_vendido) > 0).length;
    const lojasComEntrada = new Set(data.map((r) => r.loja_id).filter(Boolean)).size;
    return {
      qtd,
      vendido,
      orcado,
      vendas,
      lojasComEntrada,
      ticketMedio: qtd ? orcado / qtd : 0,
      conv: qtd ? vendas / qtd : 0,
    };
  }, [data]);

  const lojaRows = rankingLojas.map((r, i) => toExportRow(r, i + 1, "Loja"));
  const vendedorRows = rankingVendedores.map((r, i) => toExportRow(r, i + 1, "Vendedor"));
  const exportRows = tab === "lojas" ? lojaRows : vendedorRows;
  const filename = `ranking-entrada-orcamentos-${tab}-${inicioISO}-${fimISO}`;
  const compareLabel = getCompareLabel(comparativo);

  return (
    <div>
      <PageHeader
        title="Ranking de Entrada de Orcamentos"
        description="Acompanha quantos orcamentos entram por loja e, dentro da loja, por vendedor."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!exportRows.length} onClick={() => downloadCSV(filename, exportRows)}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!exportRows.length} onClick={() => exportExcel(filename, exportRows)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!exportRows.length} onClick={() => downloadPDF(filename, exportRows, {
              title: tab === "lojas" ? "Ranking de Entrada por Loja" : "Ranking de Entrada por Vendedor",
              subtitle: `${inicioISO} ate ${fimISO}${compareLabel ? ` | comparativo: ${compareLabel}` : ""}${lojaDetalhe ? ` - ${lojaDetalhe.nome}` : ""}`,
              headers: ["Posicao", "Tipo", "Nome", "Loja", "Orcamentos", "Comparativo", "Var entradas", "B2B", "B2C", "Vendas", "Conversao", "Orcado", "Var orcado", "Vendido", "Var vendido", "Ticket medio"],
            })}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Comparar com</div>
            <Select value={comparativo} onValueChange={(v) => setComparativo(v as Comparativo)}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem comparacao</SelectItem>
                <SelectItem value="mes_anterior">Mes anterior</SelectItem>
                <SelectItem value="ano_anterior">Ano anterior</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            {rangeComparativo
              ? `Comparando periodo atual (${inicioISO} ate ${fimISO}) com ${rangeComparativo.inicio} ate ${rangeComparativo.fim}.`
              : `Periodo atual: ${inicioISO} ate ${fimISO}.`}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        <Mini label="Entradas" value={resumo.qtd.toLocaleString("pt-BR")} tone="primary" />
        <Mini label="Lojas com entrada" value={resumo.lojasComEntrada.toLocaleString("pt-BR")} />
        <Mini label="Vendas geradas" value={resumo.vendas.toLocaleString("pt-BR")} />
        <Mini label="Conversao" value={fmtPct(resumo.conv)} tone={resumo.conv >= 0.35 ? "healthy" : resumo.conv >= 0.2 ? "attention" : "critical"} />
        <Mini label="Orcado" value={fmtMoney(resumo.orcado)} />
        <Mini label="Ticket medio" value={fmtMoney(resumo.ticketMedio)} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "lojas" | "vendedores")}>
        <TabsList>
          <TabsTrigger value="lojas"><Store className="h-3.5 w-3.5 mr-1.5" /> Por loja <TabCount n={rankingLojas.length} /></TabsTrigger>
          <TabsTrigger value="vendedores"><Users className="h-3.5 w-3.5 mr-1.5" /> Por vendedor <TabCount n={rankingVendedores.length} /></TabsTrigger>
        </TabsList>

        <TabsContent value="lojas">
          <RankTable
            rows={rankingLojas}
            isLoading={isLoading}
            mode="loja"
            comparativo={comparativo}
            selectedId={lojaAtiva}
            onSelect={(id) => {
              setLojaDetalheId(id === lojaDetalheId ? null : id);
              setTab("vendedores");
            }}
          />
        </TabsContent>

        <TabsContent value="vendedores">
          <Card className="mt-4 mb-3">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Ranking dentro da loja</div>
                <div className="text-xs text-muted-foreground">
                  {lojaDetalhe ? lojaDetalhe.nome : lojaId ? "Loja filtrada no painel global" : "Todas as lojas consolidadas"}
                </div>
              </div>
              {lojaDetalheId && !lojaId && (
                <Button variant="outline" size="sm" onClick={() => setLojaDetalheId(null)}>
                  Ver todos os vendedores
                </Button>
              )}
            </CardContent>
          </Card>
          <RankTable rows={rankingVendedores} isLoading={isLoading} mode="vendedor" comparativo={comparativo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function fetchOrcamentos(inicio: string, fim: string, lojaId: string | null) {
  let q = supabase
    .from("orcamentos")
    .select("loja_id,vendedor_id,especificador_id,valor_orcado,valor_vendido,status,lojas(nome),vendedores(nome)")
    .gte("data_orcamento", inicio)
    .lte("data_orcamento", fim);
  if (lojaId) q = q.eq("loja_id", lojaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Row[];
}

function buildRanking(rows: Row[], mode: "loja" | "vendedor", compareRows: Row[] = []): RankRow[] {
  const map = new Map<string, RankRow>();
  const compareMap = aggregateCompare(compareRows, mode);

  for (const r of rows) {
    const id = mode === "loja" ? r.loja_id : r.vendedor_id;
    if (!id) continue;

    const nome = mode === "loja" ? r.lojas?.nome ?? "Sem loja" : r.vendedores?.nome ?? "Sem vendedor";
    const loja = r.lojas?.nome ?? "Sem loja";
    const cur = map.get(id) ?? {
      id,
      nome,
      loja,
      qtd: 0,
      b2b: 0,
      b2c: 0,
      vendidos: 0,
      orcado: 0,
      vendido: 0,
      ticketMedio: 0,
      conv: 0,
      comparativoQtd: 0,
      comparativoOrcado: 0,
      comparativoVendido: 0,
      deltaQtd: 0,
      deltaQtdPct: null,
      deltaOrcado: 0,
      deltaOrcadoPct: null,
      deltaVendido: 0,
      deltaVendidoPct: null,
    };

    cur.qtd += 1;
    cur.orcado += money(r.valor_orcado);
    cur.vendido += money(r.valor_vendido);
    cur.vendidos += money(r.valor_vendido) > 0 ? 1 : 0;
    if (r.especificador_id) cur.b2b += 1;
    else cur.b2c += 1;
    map.set(id, cur);
  }

  return [...map.values()]
    .map((r) => {
      const prev = compareMap.get(r.id) ?? { qtd: 0, orcado: 0, vendido: 0 };
      return {
        ...r,
        ticketMedio: r.qtd ? r.orcado / r.qtd : 0,
        conv: r.qtd ? r.vendidos / r.qtd : 0,
        comparativoQtd: prev.qtd,
        comparativoOrcado: prev.orcado,
        comparativoVendido: prev.vendido,
        deltaQtd: r.qtd - prev.qtd,
        deltaQtdPct: pctDelta(r.qtd, prev.qtd),
        deltaOrcado: r.orcado - prev.orcado,
        deltaOrcadoPct: pctDelta(r.orcado, prev.orcado),
        deltaVendido: r.vendido - prev.vendido,
        deltaVendidoPct: pctDelta(r.vendido, prev.vendido),
      };
    })
    .sort((a, b) => (b.qtd - a.qtd) || (b.orcado - a.orcado) || a.nome.localeCompare(b.nome));
}

function aggregateCompare(rows: Row[], mode: "loja" | "vendedor") {
  const map = new Map<string, { qtd: number; orcado: number; vendido: number }>();
  for (const r of rows) {
    const id = mode === "loja" ? r.loja_id : r.vendedor_id;
    if (!id) continue;
    const cur = map.get(id) ?? { qtd: 0, orcado: 0, vendido: 0 };
    cur.qtd += 1;
    cur.orcado += money(r.valor_orcado);
    cur.vendido += money(r.valor_vendido);
    map.set(id, cur);
  }
  return map;
}

function RankTable({
  rows,
  isLoading,
  mode,
  selectedId,
  onSelect,
  comparativo,
}: {
  rows: RankRow[];
  isLoading: boolean;
  mode: "loja" | "vendedor";
  comparativo: Comparativo;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const max = rows[0]?.qtd ?? 1;
  const hasCompare = comparativo !== "none";
  return (
    <Card className="overflow-hidden mt-4">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["#", mode === "loja" ? "Loja" : "Vendedor", "Orcamentos", ...(hasCompare ? ["Vs comp."] : []), "B2B", "B2C", "Vendas", "Conversao", "Orcado", ...(hasCompare ? ["Var orcado"] : []), "Vendido", "Ticket medio", ""].map((h) => (
                <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={hasCompare ? 13 : 11} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={hasCompare ? 13 : 11} className="p-6 text-center text-muted-foreground">Sem entrada de orcamento no periodo.</td></tr>}
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={cn("border-t hover:bg-muted/40", onSelect && "cursor-pointer", selectedId === r.id && "bg-primary/5")}
                onClick={() => onSelect?.(r.id)}
              >
                <td className="p-3 font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {i < 3 && <Trophy className="h-3.5 w-3.5 text-[var(--status-attention)]" />}
                    {i + 1}o
                  </span>
                </td>
                <td className="p-3">
                  <div className="font-medium">{r.nome}</div>
                  {mode === "vendedor" && <div className="text-xs text-muted-foreground">{r.loja}</div>}
                </td>
                <td className="p-3 tabular-nums font-semibold">{r.qtd}</td>
                {hasCompare && <td className="p-3"><Delta value={r.deltaQtd} pct={r.deltaQtdPct} suffix=" entr." /></td>}
                <td className="p-3 tabular-nums">{r.b2b}</td>
                <td className="p-3 tabular-nums">{r.b2c}</td>
                <td className="p-3 tabular-nums">{r.vendidos}</td>
                <td className="p-3 tabular-nums">
                  <Badge variant="outline">{fmtPct(r.conv)}</Badge>
                </td>
                <td className="p-3 tabular-nums">{fmtMoney(r.orcado)}</td>
                {hasCompare && <td className="p-3"><Delta value={r.deltaOrcado} pct={r.deltaOrcadoPct} money /></td>}
                <td className="p-3 tabular-nums font-medium">{fmtMoney(r.vendido)}</td>
                <td className="p-3 tabular-nums">{fmtMoney(r.ticketMedio)}</td>
                <td className="p-3 min-w-32">
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.max(3, (r.qtd / max) * 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Delta({ value, pct, money: isMoney, suffix = "" }: { value: number; pct: number | null; money?: boolean; suffix?: string }) {
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : null;
  const text = isMoney ? fmtMoney(value) : `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR")}${suffix}`;
  return (
    <div className={cn(
      "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
      positive && "text-[var(--status-healthy)]",
      negative && "text-[var(--status-critical)]",
      !positive && !negative && "text-muted-foreground",
    )}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span>{text}</span>
      {pct !== null && <span className="text-muted-foreground">({fmtPct(pct)})</span>}
    </div>
  );
}

function Mini({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" | "healthy" | "attention" | "critical" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "primary" && "text-primary",
          tone === "healthy" && "text-[var(--status-healthy)]",
          tone === "attention" && "text-[var(--status-attention)]",
          tone === "critical" && "text-[var(--status-critical)]",
        )}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TabCount({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium rounded-full bg-muted text-muted-foreground tabular-nums">{n}</span>;
}

function toExportRow(r: RankRow, posicao: number, tipo: string) {
  return {
    Posicao: posicao,
    Tipo: tipo,
    Nome: r.nome,
    Loja: r.loja,
    Orcamentos: r.qtd,
    Comparativo: r.comparativoQtd,
    "Var entradas": r.deltaQtd,
    "Var entradas %": r.deltaQtdPct === null ? "" : fmtPct(r.deltaQtdPct),
    B2B: r.b2b,
    B2C: r.b2c,
    Vendas: r.vendidos,
    Conversao: fmtPct(r.conv),
    Orcado: r.orcado,
    "Orcado comparativo": r.comparativoOrcado,
    "Var orcado": r.deltaOrcado,
    "Var orcado %": r.deltaOrcadoPct === null ? "" : fmtPct(r.deltaOrcadoPct),
    Vendido: r.vendido,
    "Vendido comparativo": r.comparativoVendido,
    "Var vendido": r.deltaVendido,
    "Var vendido %": r.deltaVendidoPct === null ? "" : fmtPct(r.deltaVendidoPct),
    "Ticket medio": r.ticketMedio,
  };
}

function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Ranking");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function money(n: number | null | undefined) {
  return Number(n) || 0;
}

function pctDelta(current: number, previous: number) {
  if (!previous) return current ? 1 : null;
  return (current - previous) / previous;
}

function getCompareRange(inicio: string, fim: string, comparativo: Comparativo) {
  if (comparativo === "none") return null;
  const start = parseISODate(inicio);
  const end = parseISODate(fim);
  if (comparativo === "mes_anterior") {
    return {
      inicio: toISODate(addMonths(start, -1)),
      fim: toISODate(addMonths(end, -1)),
    };
  }
  return {
    inicio: toISODate(new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())),
    fim: toISODate(new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())),
  };
}

function getCompareLabel(comparativo: Comparativo) {
  if (comparativo === "mes_anterior") return "mes anterior";
  if (comparativo === "ano_anterior") return "ano anterior";
  return "";
}

function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
