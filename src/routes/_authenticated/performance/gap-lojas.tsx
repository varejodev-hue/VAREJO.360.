import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText, Save, Target, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/gap-lojas")({
  component: GapLojas,
});

type Loja = { id: string; codigo: string | null; nome: string; canal: string | null; cidade: string | null; uf: string | null };
type Orcamento = { loja_id: string | null; data_orcamento: string; valor_orcado: number; valor_vendido: number };
type Meta = { loja_id: string; ano: number; meta_anual: number };

function GapLojas() {
  const queryClient = useQueryClient();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(String(anoAtual));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const year = Number(ano);

  const { data, isLoading } = useQuery({
    queryKey: ["gap-lojas", year],
    queryFn: async () => {
      const db = supabase as any;
      const inicio = `${year}-01-01`;
      const fim = `${year}-12-31`;
      const inicioAnt = `${year - 1}-01-01`;
      const fimAntMesmoDia = sameDayPreviousYear(year);

      const [lojas, atual, anterior, metas] = await Promise.all([
        db.from("lojas").select("id,codigo,nome,canal,cidade,uf").eq("ativo", true).eq("canal", "loja_propria").order("nome"),
        db.from("orcamentos").select("loja_id,data_orcamento,valor_orcado,valor_vendido").gte("data_orcamento", inicio).lte("data_orcamento", fim),
        db.from("orcamentos").select("loja_id,data_orcamento,valor_orcado,valor_vendido").gte("data_orcamento", inicioAnt).lte("data_orcamento", fimAntMesmoDia),
        db.from("performance_metas_loja").select("loja_id,ano,meta_anual").eq("ano", year),
      ]);

      const errors = [lojas, atual, anterior, metas].map((r: any) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];

      return {
        lojas: (lojas.data ?? []) as Loja[],
        atual: (atual.data ?? []) as Orcamento[],
        anterior: (anterior.data ?? []) as Orcamento[],
        metas: (metas.data ?? []) as Meta[],
      };
    },
  });

  const rows = useMemo(() => buildRows(data?.lojas ?? [], data?.atual ?? [], data?.anterior ?? [], data?.metas ?? [], year), [data, year]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const r of rows) next[r.loja_id] = r.meta_anual ? String(r.meta_anual) : "";
    setDraft(next);
  }, [rows]);

  const saveMeta = useMutation({
    mutationFn: async ({ lojaId, meta }: { lojaId: string; meta: number }) => {
      const db = supabase as any;
      const { error } = await db.from("performance_metas_loja").upsert({
        loja_id: lojaId,
        ano: year,
        meta_anual: meta,
      }, { onConflict: "loja_id,ano" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta atualizada");
      queryClient.invalidateQueries({ queryKey: ["gap-lojas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar meta"),
  });

  const resumo = useMemo(() => {
    const vendido = rows.reduce((s, r) => s + r.vendido_ano, 0);
    const meta = rows.reduce((s, r) => s + r.meta_anual, 0);
    const anterior = rows.reduce((s, r) => s + r.vendido_ano_anterior, 0);
    const gap = meta > 0 ? vendido - meta : 0;
    return {
      vendido,
      meta,
      anterior,
      gap,
      atingimento: meta > 0 ? vendido / meta : 0,
      crescimento: anterior > 0 ? (vendido - anterior) / anterior : vendido > 0 ? 1 : 0,
      lojasAbaixo: rows.filter((r) => r.meta_anual > 0 && r.gap_meta < 0).length,
    };
  }, [rows]);

  const exportRows = rows.map((r) => ({
    Codigo: r.codigo,
    Loja: r.loja,
    Cidade: r.cidade,
    UF: r.uf,
    Ano: year,
    Meta: r.meta_anual,
    Vendido: r.vendido_ano,
    Gap: r.gap_meta,
    Atingimento: pctValue(r.atingimento_meta),
    "Ano anterior": r.vendido_ano_anterior,
    "Crescimento YoY": pctValue(r.crescimento_yoy),
    Projecao: r.projecao_ano,
    Status: r.status,
  }));

  const filename = `gap-lojas-${year}`;

  return (
    <div>
      <PageHeader
        title="Gap por Loja"
        description="Desempenho do ano, meta anual, gap financeiro e comparativo contra o mesmo periodo do ano anterior."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCSV(filename, exportRows)}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportExcel(filename, exportRows)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadPDF(filename, exportRows, {
              title: "Gap por Loja - Desempenho Anual",
              subtitle: `Ano ${year}`,
              headers: ["Codigo", "Loja", "Meta", "Vendido", "Gap", "Atingimento", "Ano anterior", "Crescimento YoY", "Status"],
            })}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Ano</div>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => anoAtual - 3 + i).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            O gap usa meta anual cadastrada por loja. Sem meta, a loja aparece com desempenho real e comparativo YoY.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Mini label="Vendido no ano" value={fmtMoney(resumo.vendido)} tone="healthy" />
        <Mini label="Meta anual" value={fmtMoney(resumo.meta)} />
        <Mini label="Gap total" value={resumo.meta ? fmtMoney(resumo.gap) : "Sem meta"} tone={resumo.gap >= 0 ? "healthy" : "critical"} />
        <Mini label="Atingimento" value={resumo.meta ? fmtPct(resumo.atingimento) : "-"} tone={resumo.atingimento >= 1 ? "healthy" : resumo.atingimento >= 0.8 ? "attention" : "critical"} />
        <Mini label="Vs ano anterior" value={fmtPct(resumo.crescimento)} tone={resumo.crescimento >= 0 ? "healthy" : "critical"} />
        <Mini label="Lojas abaixo" value={resumo.lojasAbaixo.toLocaleString("pt-BR")} tone={resumo.lojasAbaixo ? "critical" : "healthy"} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Gap financeiro por loja propria</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Loja", "Meta anual", "Vendido ano", "Gap", "Ating.", "Ano anterior", "YoY", "Projecao", "Status", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Carregando gap...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma loja propria ativa encontrada.</td></tr>}
              {rows.map((r) => (
                <tr key={r.loja_id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <div className="font-medium">{r.loja}</div>
                    <div className="text-xs text-muted-foreground">{r.codigo} - {r.cidade || "-"} {r.uf || ""}</div>
                  </td>
                  <td className="p-3 min-w-[150px]">
                    <Input
                      className="h-8"
                      inputMode="decimal"
                      value={draft[r.loja_id] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [r.loja_id]: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                  <td className="p-3 tabular-nums font-medium">{fmtMoney(r.vendido_ano)}</td>
                  <td className={cn("p-3 tabular-nums font-medium", r.meta_anual > 0 && (r.gap_meta >= 0 ? "text-[var(--status-healthy)]" : "text-[var(--status-critical)]"))}>
                    {r.meta_anual > 0 ? fmtMoney(r.gap_meta) : "-"}
                  </td>
                  <td className="p-3"><AtingimentoBadge pct={r.atingimento_meta} hasMeta={r.meta_anual > 0} /></td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.vendido_ano_anterior)}</td>
                  <td className={cn("p-3 tabular-nums font-medium", r.crescimento_yoy >= 0 ? "text-[var(--status-healthy)]" : "text-[var(--status-critical)]")}>
                    {fmtPct(r.crescimento_yoy)}
                  </td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.projecao_ano)}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => saveMeta.mutate({ lojaId: r.loja_id, meta: parseMoney(draft[r.loja_id]) })}
                      disabled={saveMeta.isPending}
                    >
                      <Save className="h-4 w-4" /> Salvar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function buildRows(lojas: Loja[], atual: Orcamento[], anterior: Orcamento[], metas: Meta[], ano: number) {
  const atualMap = aggregate(atual);
  const anteriorMap = aggregate(anterior);
  const metaMap = new Map(metas.map((m) => [m.loja_id, Number(m.meta_anual) || 0]));
  const dayOfYear = yearProgressDay(ano);

  return lojas.map((loja) => {
    const vendido = atualMap.get(loja.id)?.vendido ?? 0;
    const orcado = atualMap.get(loja.id)?.orcado ?? 0;
    const vendidoAnterior = anteriorMap.get(loja.id)?.vendido ?? 0;
    const meta = metaMap.get(loja.id) ?? 0;
    const gap = meta ? vendido - meta : 0;
    const atingimento = meta ? vendido / meta : 0;
    const crescimento = vendidoAnterior > 0 ? (vendido - vendidoAnterior) / vendidoAnterior : vendido > 0 ? 1 : 0;
    const projecao = dayOfYear > 0 ? (vendido / dayOfYear) * daysInYear(ano) : vendido;
    const status = meta <= 0 ? "Sem meta" : gap >= 0 ? "Acima da meta" : atingimento >= yearProgressPct(ano) ? "No ritmo" : "Abaixo do ritmo";
    return {
      loja_id: loja.id,
      codigo: loja.codigo ?? "-",
      loja: loja.nome,
      cidade: loja.cidade ?? "",
      uf: loja.uf ?? "",
      meta_anual: meta,
      vendido_ano: vendido,
      orcado_ano: orcado,
      gap_meta: gap,
      atingimento_meta: atingimento,
      vendido_ano_anterior: vendidoAnterior,
      crescimento_yoy: crescimento,
      projecao_ano: projecao,
      status,
    };
  }).sort((a, b) => {
    const score = (r: any) => r.meta_anual <= 0 ? -999999999 : r.gap_meta;
    return score(a) - score(b);
  });
}

function aggregate(rows: Orcamento[]) {
  const map = new Map<string, { vendido: number; orcado: number }>();
  for (const r of rows) {
    if (!r.loja_id) continue;
    const cur = map.get(r.loja_id) ?? { vendido: 0, orcado: 0 };
    cur.vendido += Number(r.valor_vendido) || 0;
    cur.orcado += Number(r.valor_orcado) || 0;
    map.set(r.loja_id, cur);
  }
  return map;
}

function AtingimentoBadge({ pct, hasMeta }: { pct: number; hasMeta: boolean }) {
  if (!hasMeta) return <Badge variant="outline">Sem meta</Badge>;
  return (
    <Badge variant="outline" className={cn(
      pct >= 1 && "text-[var(--status-healthy)] border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)]",
      pct >= 0.8 && pct < 1 && "text-[var(--status-attention)] border-[var(--status-attention)]/40 bg-[var(--status-attention-soft)]",
      pct < 0.8 && "text-[var(--status-critical)] border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)]",
    )}>{fmtPct(pct)}</Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const healthy = status === "Acima da meta" || status === "No ritmo";
  const noMeta = status === "Sem meta";
  const Icon = healthy ? TrendingUp : TrendingDown;
  return (
    <Badge variant="outline" className={cn(
      "gap-1 whitespace-nowrap",
      healthy && "text-[var(--status-healthy)] border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)]",
      !healthy && !noMeta && "text-[var(--status-critical)] border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)]",
    )}>
      {!noMeta && <Icon className="h-3 w-3" />}
      {status}
    </Badge>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "healthy" | "attention" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "text-lg font-semibold tabular-nums mt-0.5",
        tone === "healthy" && "text-[var(--status-healthy)]",
        tone === "attention" && "text-[var(--status-attention)]",
        tone === "critical" && "text-[var(--status-critical)]",
      )}>{value}</div>
    </CardContent></Card>
  );
}

function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gap por Loja");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function parseMoney(value?: string) {
  if (!value) return 0;
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function sameDayPreviousYear(year: number) {
  const now = new Date();
  const target = year === now.getFullYear() ? new Date(year - 1, now.getMonth(), now.getDate()) : new Date(year - 1, 11, 31);
  return target.toISOString().slice(0, 10);
}

function yearProgressDay(year: number) {
  const now = new Date();
  const end = year === now.getFullYear() ? now : new Date(year, 11, 31);
  const start = new Date(year, 0, 1);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function yearProgressPct(year: number) {
  return yearProgressDay(year) / daysInYear(year);
}

function daysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function pctValue(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
