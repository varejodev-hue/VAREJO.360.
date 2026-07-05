import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import { CalendarCheck2, Download, FileSpreadsheet, FileText, Store, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/planejamento-executivo")({
  component: PlanejamentoExecutivo,
});

type TipoFiltro = "todos" | "semanal" | "mensal";
type StatusExec = "feito" | "em_andamento" | "nao_fez" | "atrasado" | "cancelado";

type LojaRow = {
  id: string;
  codigo: string | null;
  nome: string;
  canal: string | null;
  cidade: string | null;
  uf: string | null;
};

type PlanejamentoRow = {
  id: string;
  loja_id: string | null;
  tipo: "semanal" | "mensal";
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  objetivo: string | null;
  fato: string | null;
  causa: string | null;
  plano_acao: string | null;
  recado: string | null;
  indicadores: Record<string, any> | null;
  updated_at: string | null;
};

type ExecRow = {
  loja_id: string;
  codigo: string;
  loja: string;
  cidade: string;
  uf: string;
  status_exec: StatusExec;
  status_label: string;
  tipo: string;
  planejamento: string;
  periodo: string;
  indicadores: string;
  objetivo: string;
  plano_acao: string;
  ultima_atualizacao: string;
};

function PlanejamentoExecutivo() {
  const hoje = new Date();
  const [tipo, setTipo] = useState<TipoFiltro>("todos");
  const [inicio, setInicio] = useState(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return toDate(d);
  });
  const [fim, setFim] = useState(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return toDate(d);
  });

  const { data, isLoading } = useQuery({
    queryKey: ["planejamento-executivo", tipo, inicio, fim],
    queryFn: async () => {
      const db = supabase as any;
      const [lojas, planejamentos] = await Promise.all([
        db
          .from("lojas")
          .select("id,codigo,nome,canal,cidade,uf")
          .eq("ativo", true)
          .eq("canal", "loja_propria")
          .order("nome"),
        (() => {
          let q = db
            .from("operacao_planejamentos")
            .select("id,loja_id,tipo,titulo,periodo_inicio,periodo_fim,status,objetivo,fato,causa,plano_acao,recado,indicadores,updated_at")
            .lte("periodo_inicio", fim)
            .gte("periodo_fim", inicio)
            .order("updated_at", { ascending: false });
          if (tipo !== "todos") q = q.eq("tipo", tipo);
          return q;
        })(),
      ]);

      if (lojas.error) throw lojas.error;
      if (planejamentos.error) throw planejamentos.error;

      return {
        lojas: (lojas.data ?? []) as LojaRow[],
        planejamentos: (planejamentos.data ?? []) as PlanejamentoRow[],
      };
    },
  });

  const rows = useMemo(() => buildRows(data?.lojas ?? [], data?.planejamentos ?? [], fim), [data, fim]);
  const resumo = useMemo(() => {
    const total = rows.length;
    const fizeram = rows.filter((r) => r.status_exec !== "nao_fez" && r.status_exec !== "atrasado").length;
    const concluidas = rows.filter((r) => r.status_exec === "feito").length;
    const abertas = rows.filter((r) => r.status_exec === "em_andamento").length;
    const naoFizeram = rows.filter((r) => r.status_exec === "nao_fez" || r.status_exec === "atrasado").length;
    const atrasadas = rows.filter((r) => r.status_exec === "atrasado").length;
    return { total, fizeram, concluidas, abertas, naoFizeram, atrasadas, aderencia: total ? fizeram / total : 0 };
  }, [rows]);

  const exportRows = rows.map((r) => ({
    Codigo: r.codigo,
    Loja: r.loja,
    Cidade: r.cidade,
    UF: r.uf,
    Status: r.status_label,
    Tipo: r.tipo,
    Planejamento: r.planejamento,
    Periodo: r.periodo,
    Indicadores: r.indicadores,
    Objetivo: r.objetivo,
    "Plano de acao": r.plano_acao,
    "Ultima atualizacao": r.ultima_atualizacao,
  }));

  const filename = `planejamento-executivo-${inicio}_a_${fim}`;

  return (
    <div>
      <PageHeader
        title="Planejamento Executivo"
        description="Visao do Head Nacional: quais lojas proprias fizeram FCA/planejamento, quais estao abertas e quais nao fizeram."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCSV(filename, exportRows)}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportExcel(filename, exportRows)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadPDF(filename, exportRows, {
              title: "Planejamento Executivo - Lojas Proprias",
              subtitle: `Periodo ${fmtDate(inicio)} ate ${fmtDate(fim)} - tipo ${tipo}`,
              headers: ["Codigo", "Loja", "Status", "Tipo", "Planejamento", "Periodo", "Indicadores", "Ultima atualizacao"],
            })}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-[180px_180px_180px_1fr] gap-3 items-end">
            <Field label="Tipo">
              <Select value={tipo} onValueChange={(v: TipoFiltro) => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">FCA ou planejamento</SelectItem>
                  <SelectItem value="semanal">Somente semanal</SelectItem>
                  <SelectItem value="mensal">Somente mensal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Inicio">
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </Field>
            <div className="text-xs text-muted-foreground pb-2">
              Regra: loja propria ativa precisa ter ao menos um planejamento no periodo filtrado. Sem registro aparece como "Nao fez".
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Mini label="Aderencia" value={`${(resumo.aderencia * 100).toFixed(0)}%`} tone={resumo.aderencia >= 0.9 ? "healthy" : resumo.aderencia >= 0.7 ? "attention" : "critical"} />
        <Mini label="Lojas" value={resumo.total.toLocaleString("pt-BR")} />
        <Mini label="Fizeram" value={resumo.fizeram.toLocaleString("pt-BR")} tone="healthy" />
        <Mini label="Nao fizeram" value={resumo.naoFizeram.toLocaleString("pt-BR")} tone={resumo.naoFizeram ? "critical" : "healthy"} />
        <Mini label="Atrasadas" value={resumo.atrasadas.toLocaleString("pt-BR")} tone={resumo.atrasadas ? "attention" : "healthy"} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Aderencia por loja propria</div>
          </div>
          <Badge variant="outline">{resumo.abertas} em andamento</Badge>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Loja", "Status", "Tipo", "Planejamento", "Periodo", "Indicadores", "Ultima atualizacao", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando consolidado...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma loja propria ativa encontrada.</td></tr>}
              {rows.map((r) => (
                <tr key={r.loja_id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <div className="font-medium">{r.loja}</div>
                    <div className="text-xs text-muted-foreground">{r.codigo} - {r.cidade || "-"} {r.uf || ""}</div>
                  </td>
                  <td className="p-3"><StatusBadge status={r.status_exec} label={r.status_label} /></td>
                  <td className="p-3 capitalize">{r.tipo}</td>
                  <td className="p-3 max-w-[260px] truncate">{r.planejamento}</td>
                  <td className="p-3 whitespace-nowrap">{r.periodo}</td>
                  <td className="p-3">{r.indicadores}</td>
                  <td className="p-3 whitespace-nowrap">{r.ultima_atualizacao}</td>
                  <td className="p-3 text-right">
                    <Link to="/operacao/planejamento" className="text-primary text-xs hover:underline">
                      abrir
                    </Link>
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

function buildRows(lojas: LojaRow[], planejamentos: PlanejamentoRow[], fim: string): ExecRow[] {
  const byLoja = new Map<string, PlanejamentoRow[]>();
  for (const p of planejamentos) {
    if (!p.loja_id) continue;
    const arr = byLoja.get(p.loja_id) ?? [];
    arr.push(p);
    byLoja.set(p.loja_id, arr);
  }

  const fimDate = new Date(`${fim}T12:00:00`);
  const hoje = new Date();
  const periodoVencido = fimDate < new Date(hoje.toISOString().slice(0, 10) + "T12:00:00");

  return lojas.map((loja) => {
    const planos = (byLoja.get(loja.id) ?? []).sort((a, b) => {
      const da = a.updated_at ?? a.periodo_fim;
      const db = b.updated_at ?? b.periodo_fim;
      return db.localeCompare(da);
    });
    const p = planos[0];
    if (!p) {
      const status: StatusExec = periodoVencido ? "atrasado" : "nao_fez";
      return {
        loja_id: loja.id,
        codigo: loja.codigo ?? "-",
        loja: loja.nome,
        cidade: loja.cidade ?? "",
        uf: loja.uf ?? "",
        status_exec: status,
        status_label: status === "atrasado" ? "Atrasado" : "Nao fez",
        tipo: "-",
        planejamento: "Sem FCA/planejamento no periodo",
        periodo: `${fmtDate(fim)} limite`,
        indicadores: "0/9",
        objetivo: "",
        plano_acao: "",
        ultima_atualizacao: "-",
      };
    }

    const status = statusExec(p);
    return {
      loja_id: loja.id,
      codigo: loja.codigo ?? "-",
      loja: loja.nome,
      cidade: loja.cidade ?? "",
      uf: loja.uf ?? "",
      status_exec: status,
      status_label: labelStatus(status),
      tipo: p.tipo,
      planejamento: p.titulo,
      periodo: `${fmtDate(p.periodo_inicio)} ate ${fmtDate(p.periodo_fim)}`,
      indicadores: `${countIndicadores(p.indicadores)}/9`,
      objetivo: p.objetivo ?? "",
      plano_acao: p.plano_acao ?? "",
      ultima_atualizacao: fmtDateTime(p.updated_at),
    };
  }).sort((a, b) => statusOrder(a.status_exec) - statusOrder(b.status_exec) || a.loja.localeCompare(b.loja));
}

function statusExec(p: PlanejamentoRow): StatusExec {
  if (p.status === "concluido") return "feito";
  if (p.status === "cancelado") return "cancelado";
  const fim = new Date(`${p.periodo_fim}T23:59:59`);
  if (fim < new Date()) return "atrasado";
  return "em_andamento";
}

function countIndicadores(indicadores: Record<string, any> | null) {
  if (!indicadores) return 0;
  return Object.values(indicadores).filter((v: any) => v?.previsto || v?.realizado).length;
}

function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Planejamento Executivo");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function StatusBadge({ status, label }: { status: StatusExec; label: string }) {
  return (
    <Badge variant="outline" className={cn(
      status === "feito" && "border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)] text-[var(--status-healthy)]",
      status === "em_andamento" && "border-primary/30 bg-primary/10 text-primary",
      status === "nao_fez" && "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]",
      status === "atrasado" && "border-[var(--status-attention)]/40 bg-[var(--status-attention-soft)] text-[var(--status-attention)]",
    )}>
      {status === "nao_fez" || status === "atrasado" ? <TriangleAlert className="h-3 w-3 mr-1" /> : <CalendarCheck2 className="h-3 w-3 mr-1" />}
      {label}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function statusOrder(status: StatusExec) {
  const order: Record<StatusExec, number> = { atrasado: 0, nao_fez: 1, em_andamento: 2, cancelado: 3, feito: 4 };
  return order[status] ?? 9;
}

function labelStatus(status: StatusExec) {
  const labels: Record<StatusExec, string> = {
    feito: "Feito",
    em_andamento: "Em andamento",
    nao_fez: "Nao fez",
    atrasado: "Atrasado",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}
