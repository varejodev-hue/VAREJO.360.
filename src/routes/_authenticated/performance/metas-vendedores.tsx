import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText, Save, Target, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/metas-vendedores")({
  component: MetasVendedores,
});

type Vendedor = { id: string; nome: string; loja_id: string | null; ativo: boolean | null; lojas?: { nome: string } | null };
type Orcamento = { vendedor_id: string | null; loja_id: string | null; especificador_id: string | null; valor_orcado: number; valor_vendido: number; status: string | null };
type Meta = {
  vendedor_id: string;
  loja_id: string | null;
  ano: number;
  mes: number | null;
  periodo_tipo: "mensal" | "trimestral" | "semestral" | "anual";
  periodo_numero: number;
  meta_total_valor: number;
  meta_b2b_valor: number;
  meta_b2c_valor: number;
  meta_b2b_pct: number | null;
  meta_b2c_pct: number | null;
  meta_conversao_pct: number | null;
};

const periodos = [
  ["mes:1", "Janeiro"],
  ["mes:2", "Fevereiro"],
  ["mes:3", "Marco"],
  ["mes:4", "Abril"],
  ["mes:5", "Maio"],
  ["mes:6", "Junho"],
  ["mes:7", "Julho"],
  ["mes:8", "Agosto"],
  ["mes:9", "Setembro"],
  ["mes:10", "Outubro"],
  ["mes:11", "Novembro"],
  ["mes:12", "Dezembro"],
  ["tri:1", "1o trimestre"],
  ["tri:2", "2o trimestre"],
  ["tri:3", "3o trimestre"],
  ["tri:4", "4o trimestre"],
  ["sem:1", "1o semestre"],
  ["sem:2", "2o semestre"],
  ["ano:0", "Ano inteiro"],
] as const;

function MetasVendedores() {
  const queryClient = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [periodoKey, setPeriodoKey] = useState(`mes:${now.getMonth() + 1}`);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const year = Number(ano);
  const periodoSelecionado = parsePeriodo(periodoKey);

  const periodo = useMemo(() => rangeFor(year, periodoSelecionado), [year, periodoSelecionado.tipo, periodoSelecionado.numero]);

  const { data, isLoading } = useQuery({
    queryKey: ["metas-vendedores", lojaId, year, periodoKey],
    queryFn: async () => {
      const db = supabase as any;
      const [vendedores, orcamentos, metas] = await Promise.all([
        (() => {
          let q = db.from("vendedores").select("id,nome,loja_id,ativo,lojas(nome)").eq("ativo", true).order("nome");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db
            .from("orcamentos")
            .select("vendedor_id,loja_id,especificador_id,valor_orcado,valor_vendido,status")
            .gte("data_orcamento", periodo.inicio)
            .lte("data_orcamento", periodo.fim);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("performance_metas_vendedor").select("*").eq("ano", year);
          q = q.eq("periodo_tipo", periodoSelecionado.tipo).eq("periodo_numero", periodoSelecionado.numero);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
      ]);

      const errors = [vendedores, orcamentos, metas].map((r: any) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];
      return {
        vendedores: (vendedores.data ?? []) as Vendedor[],
        orcamentos: (orcamentos.data ?? []) as Orcamento[],
        metas: (metas.data ?? []) as Meta[],
      };
    },
  });

  const rows = useMemo(() => buildRows(data?.vendedores ?? [], data?.orcamentos ?? [], data?.metas ?? []), [data]);

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const r of rows) {
      next[r.vendedor_id] = {
        total: r.meta_total_valor ? String(r.meta_total_valor) : "",
        b2bValor: r.meta_b2b_valor ? String(r.meta_b2b_valor) : "",
        b2cValor: r.meta_b2c_valor ? String(r.meta_b2c_valor) : "",
        b2bPct: r.meta_b2b_pct != null ? String(r.meta_b2b_pct) : "",
        b2cPct: r.meta_b2c_pct != null ? String(r.meta_b2c_pct) : "",
        convPct: r.meta_conversao_pct != null ? String(r.meta_conversao_pct) : "",
      };
    }
    setDraft(next);
  }, [rows]);

  const saveMeta = useMutation({
    mutationFn: async ({ row }: { row: RowOut }) => {
      const d = draft[row.vendedor_id] ?? emptyDraft;
      const db = supabase as any;
      const { error } = await db.from("performance_metas_vendedor").upsert({
        loja_id: row.loja_id,
        vendedor_id: row.vendedor_id,
        ano: year,
        mes: periodoSelecionado.tipo === "mensal" ? periodoSelecionado.numero : null,
        periodo_tipo: periodoSelecionado.tipo,
        periodo_numero: periodoSelecionado.numero,
        meta_total_valor: parseNumber(d.total),
        meta_b2b_valor: parseNumber(d.b2bValor),
        meta_b2c_valor: parseNumber(d.b2cValor),
        meta_b2b_pct: nullableNumber(d.b2bPct),
        meta_b2c_pct: nullableNumber(d.b2cPct),
        meta_conversao_pct: nullableNumber(d.convPct),
      }, { onConflict: "vendedor_id,ano,periodo_tipo,periodo_numero" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta do vendedor atualizada");
      queryClient.invalidateQueries({ queryKey: ["metas-vendedores"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar meta"),
  });

  const resumo = useMemo(() => ({
    vendido: rows.reduce((s, r) => s + r.vendido_total, 0),
    meta: rows.reduce((s, r) => s + r.meta_total_valor, 0),
    b2b: rows.reduce((s, r) => s + r.vendido_b2b, 0),
    b2c: rows.reduce((s, r) => s + r.vendido_b2c, 0),
    abaixo: rows.filter((r) => r.meta_total_valor > 0 && r.gap_total < 0).length,
  }), [rows]);

  const exportRows = rows.map((r) => ({
    Loja: r.loja_nome,
    Vendedor: r.vendedor_nome,
    Periodo: periodo.label,
    "Meta total": r.meta_total_valor,
    "Vendido total": r.vendido_total,
    "Gap total": r.gap_total,
    "Atingimento total": fmtPctRaw(r.ating_total),
    "Meta B2B valor": r.meta_b2b_valor,
    "Vendido B2B": r.vendido_b2b,
    "Mix B2B": fmtPctRaw(r.mix_b2b),
    "Meta B2C valor": r.meta_b2c_valor,
    "Vendido B2C": r.vendido_b2c,
    "Mix B2C": fmtPctRaw(r.mix_b2c),
    "Conversao": fmtPctRaw(r.conversao),
    Status: r.status,
  }));
  const filename = `metas-vendedores-${year}-${periodoKey.replace(":", "-")}`;

  return (
    <div>
      <PageHeader
        title="Metas dos Vendedores"
        description="Gerente parametriza meta por valor e percentual, com separacao B2B/B2C por vendedor."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCSV(filename, exportRows)}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportExcel(filename, exportRows)}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadPDF(filename, exportRows, {
              title: "Metas dos Vendedores - B2B/B2C",
              subtitle: periodo.label,
              headers: ["Loja", "Vendedor", "Meta total", "Vendido total", "Gap total", "Atingimento total", "Vendido B2B", "Mix B2B", "Vendido B2C", "Mix B2C", "Status"],
            })}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Ano</div>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Periodo</div>
            <Select value={periodoKey} onValueChange={setPeriodoKey}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{periodos.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            B2B considera orcamentos com especificador. B2C considera cliente final/sem especificador.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Mini label="Vendido" value={fmtMoney(resumo.vendido)} tone="healthy" />
        <Mini label="Meta total" value={fmtMoney(resumo.meta)} />
        <Mini label="Gap total" value={resumo.meta ? fmtMoney(resumo.vendido - resumo.meta) : "Sem meta"} tone={resumo.vendido - resumo.meta >= 0 ? "healthy" : "critical"} />
        <Mini label="Mix B2B" value={fmtPct(resumo.vendido ? resumo.b2b / resumo.vendido : 0)} />
        <Mini label="Abaixo da meta" value={resumo.abaixo.toLocaleString("pt-BR")} tone={resumo.abaixo ? "critical" : "healthy"} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Acompanhamento por vendedor</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Vendedor", "Meta total", "Vendido", "Gap", "B2B valor", "B2B %", "B2C valor", "B2C %", "Conv. %", "Status", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Carregando metas...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Nenhum vendedor ativo encontrado.</td></tr>}
              {rows.map((r) => {
                const d = draft[r.vendedor_id] ?? emptyDraft;
                return (
                  <tr key={r.vendedor_id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <div className="font-medium">{r.vendedor_nome}</div>
                      <div className="text-xs text-muted-foreground">{r.loja_nome}</div>
                    </td>
                    <td className="p-3 min-w-[120px]"><MoneyInput value={d.total} onChange={(v) => setDraftValue(r.vendedor_id, "total", v, draft, setDraft)} /></td>
                    <td className="p-3 tabular-nums font-medium">{fmtMoney(r.vendido_total)}</td>
                    <td className={cn("p-3 tabular-nums font-medium", r.meta_total_valor > 0 && (r.gap_total >= 0 ? "text-[var(--status-healthy)]" : "text-[var(--status-critical)]"))}>{r.meta_total_valor ? fmtMoney(r.gap_total) : "-"}</td>
                    <td className="p-3 min-w-[120px]"><MoneyInput value={d.b2bValor} onChange={(v) => setDraftValue(r.vendedor_id, "b2bValor", v, draft, setDraft)} hint={fmtMoney(r.vendido_b2b)} /></td>
                    <td className="p-3 min-w-[90px]"><PctInput value={d.b2bPct} onChange={(v) => setDraftValue(r.vendedor_id, "b2bPct", v, draft, setDraft)} hint={fmtPct(r.mix_b2b)} /></td>
                    <td className="p-3 min-w-[120px]"><MoneyInput value={d.b2cValor} onChange={(v) => setDraftValue(r.vendedor_id, "b2cValor", v, draft, setDraft)} hint={fmtMoney(r.vendido_b2c)} /></td>
                    <td className="p-3 min-w-[90px]"><PctInput value={d.b2cPct} onChange={(v) => setDraftValue(r.vendedor_id, "b2cPct", v, draft, setDraft)} hint={fmtPct(r.mix_b2c)} /></td>
                    <td className="p-3 min-w-[90px]"><PctInput value={d.convPct} onChange={(v) => setDraftValue(r.vendedor_id, "convPct", v, draft, setDraft)} hint={fmtPct(r.conversao)} /></td>
                    <td className="p-3"><StatusBadge row={r} /></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => saveMeta.mutate({ row: r })} disabled={saveMeta.isPending}>
                        <Save className="h-4 w-4" /> Salvar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type Draft = { total: string; b2bValor: string; b2cValor: string; b2bPct: string; b2cPct: string; convPct: string };
const emptyDraft: Draft = { total: "", b2bValor: "", b2cValor: "", b2bPct: "", b2cPct: "", convPct: "" };

type RowOut = ReturnType<typeof buildRows>[number];

function buildRows(vendedores: Vendedor[], orcamentos: Orcamento[], metas: Meta[]) {
  const metaMap = new Map(metas.map((m) => [m.vendedor_id, m]));
  const agg = new Map<string, { orcado: number; vendido: number; qtd: number; vendas: number; b2b: number; b2c: number }>();
  for (const o of orcamentos) {
    if (!o.vendedor_id) continue;
    const cur = agg.get(o.vendedor_id) ?? { orcado: 0, vendido: 0, qtd: 0, vendas: 0, b2b: 0, b2c: 0 };
    const vendido = Number(o.valor_vendido) || 0;
    cur.qtd += 1;
    cur.orcado += Number(o.valor_orcado) || 0;
    cur.vendido += vendido;
    if (vendido > 0) cur.vendas += 1;
    if (o.especificador_id) cur.b2b += vendido;
    else cur.b2c += vendido;
    agg.set(o.vendedor_id, cur);
  }

  return vendedores.map((v) => {
    const a = agg.get(v.id) ?? { orcado: 0, vendido: 0, qtd: 0, vendas: 0, b2b: 0, b2c: 0 };
    const m = metaMap.get(v.id);
    const total = Number(m?.meta_total_valor) || 0;
    const mixB2b = a.vendido ? a.b2b / a.vendido : 0;
    const mixB2c = a.vendido ? a.b2c / a.vendido : 0;
    const conv = a.qtd ? a.vendas / a.qtd : 0;
    const gap = total ? a.vendido - total : 0;
    const status = total <= 0 ? "Sem meta" : gap >= 0 ? "Meta batida" : "Abaixo da meta";
    return {
      vendedor_id: v.id,
      loja_id: v.loja_id,
      vendedor_nome: v.nome,
      loja_nome: v.lojas?.nome ?? "Sem loja",
      meta_total_valor: total,
      meta_b2b_valor: Number(m?.meta_b2b_valor) || 0,
      meta_b2c_valor: Number(m?.meta_b2c_valor) || 0,
      meta_b2b_pct: m?.meta_b2b_pct ?? null,
      meta_b2c_pct: m?.meta_b2c_pct ?? null,
      meta_conversao_pct: m?.meta_conversao_pct ?? null,
      vendido_total: a.vendido,
      vendido_b2b: a.b2b,
      vendido_b2c: a.b2c,
      gap_total: gap,
      ating_total: total ? a.vendido / total : 0,
      mix_b2b: mixB2b,
      mix_b2c: mixB2c,
      conversao: conv,
      status,
    };
  }).sort((a, b) => (a.gap_total - b.gap_total) || a.vendedor_nome.localeCompare(b.vendedor_nome));
}

function parsePeriodo(key: string) {
  const [kind, rawNumber] = key.split(":");
  const numero = Number(rawNumber) || 0;
  if (kind === "tri") return { tipo: "trimestral" as const, numero };
  if (kind === "sem") return { tipo: "semestral" as const, numero };
  if (kind === "ano") return { tipo: "anual" as const, numero: 0 };
  return { tipo: "mensal" as const, numero: numero || 1 };
}

function rangeFor(year: number, periodo: ReturnType<typeof parsePeriodo>) {
  if (periodo.tipo === "anual") return { inicio: `${year}-01-01`, fim: `${year}-12-31`, label: `Ano ${year}` };
  if (periodo.tipo === "trimestral") {
    const firstMonth = (periodo.numero - 1) * 3;
    const start = new Date(year, firstMonth, 1);
    const end = new Date(year, firstMonth + 3, 0);
    return { inicio: toDate(start), fim: toDate(end), label: `${periodo.numero}o trimestre de ${year}` };
  }
  if (periodo.tipo === "semestral") {
    const firstMonth = periodo.numero === 2 ? 6 : 0;
    const start = new Date(year, firstMonth, 1);
    const end = new Date(year, firstMonth + 6, 0);
    return { inicio: toDate(start), fim: toDate(end), label: `${periodo.numero}o semestre de ${year}` };
  }
  const start = new Date(year, periodo.numero - 1, 1);
  const end = new Date(year, periodo.numero, 0);
  return { inicio: toDate(start), fim: toDate(end), label: `${periodos.find(([v]) => v === `mes:${periodo.numero}`)?.[1]} de ${year}` };
}

function setDraftValue(id: string, key: keyof Draft, value: string, draft: Record<string, Draft>, setDraft: (value: Record<string, Draft>) => void) {
  setDraft({ ...draft, [id]: { ...(draft[id] ?? emptyDraft), [key]: value } });
}

function MoneyInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return <div><Input className="h-8" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />{hint && <div className="text-[10px] text-muted-foreground mt-1">Real: {hint}</div>}</div>;
}

function PctInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return <div><Input className="h-8" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="%" />{hint && <div className="text-[10px] text-muted-foreground mt-1">Real: {hint}</div>}</div>;
}

function StatusBadge({ row }: { row: RowOut }) {
  const ok = row.status === "Meta batida";
  return (
    <Badge variant="outline" className={cn(
      ok && "text-[var(--status-healthy)] border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)]",
      row.status === "Abaixo da meta" && "text-[var(--status-critical)] border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)]",
    )}>{row.status}</Badge>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "healthy" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone === "healthy" && "text-[var(--status-healthy)]", tone === "critical" && "text-[var(--status-critical)]")}>{value}</div>
    </CardContent></Card>
  );
}

function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Metas Vendedores");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function parseNumber(value?: string) {
  if (!value) return 0;
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function nullableNumber(value?: string) {
  if (!value) return null;
  return parseNumber(value);
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPctRaw(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
