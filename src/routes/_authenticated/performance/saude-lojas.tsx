import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";
import { useGlobalFilters } from "@/lib/global-filters";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Store, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/saude-lojas")({
  component: SaudeLojas,
});

type Loja = { id: string; codigo: string | null; nome: string; canal: string | null; cidade: string | null; uf: string | null };
type Orcamento = {
  loja_id: string | null;
  data_orcamento: string;
  data_venda: string | null;
  valor_orcado: number | null;
  valor_vendido: number | null;
  status: string | null;
  previsao_fechamento?: string | null;
  ar_status?: string | null;
  motivo_perda?: string | null;
};
type Task = { loja_id: string | null; due_at: string; status: string | null };
type Planejamento = { loja_id: string | null; status: string | null; periodo_inicio: string; periodo_fim: string };
type Rotina = { loja_id: string | null; prazo: string | null; status: string | null; prioridade: string | null };
type Compra = { loja_id: string | null; status: string | null; created_at: string; fornecedor_cadastrado: boolean | null };
type Material = { loja_id: string | null; estoque_atual: number | null; estoque_minimo: number | null };
type Manutencao = { loja_id: string | null; proxima_execucao: string | null; status: string | null };
type AmostraMov = { loja_id: string | null; previsao_devolucao: string | null; data_devolucao: string | null };
type PesoSaude = { loja_id: string | null; indicador: string; peso: number | null };

type HealthRow = {
  loja_id: string;
  codigo: string;
  loja: string;
  cidade: string;
  uf: string;
  nota: number;
  status: "saudavel" | "atencao" | "critica";
  entradas: number;
  vendido: number;
  orcado: number;
  conversao: number;
  tempo_medio_conversao: number | null;
  followups_vencidos: number;
  carteira_risco: number;
  ar_pendente: number;
  planejamentos_pendentes: number;
  manutencoes_vencidas: number;
  estoque_critico: number;
  compras_abertas: number;
  amostras_atrasadas: number;
  rotinas_atrasadas: number;
  principal_gap: string;
};

function SaudeLojas() {
  const { inicioISO, fimISO, lojaId } = useGlobalFilters();
  const hoje = todayISO();
  const em15 = addDays(15);

  const { data, isLoading } = useQuery({
    queryKey: ["saude-lojas", inicioISO, fimISO, lojaId],
    queryFn: async () => {
      const db = supabase as any;
      const [lojas, orcamentos, tasks, planejamentos, rotinas, compras, materiais, manutencoes, amostras, pesos] = await Promise.all([
        (() => {
          let q = db.from("lojas").select("id,codigo,nome,canal,cidade,uf").eq("ativo", true).eq("canal", "loja_propria").order("nome");
          if (lojaId) q = q.eq("id", lojaId);
          return q;
        })(),
        (() => {
          let q = db
            .from("orcamentos")
            .select("loja_id,data_orcamento,data_venda,valor_orcado,valor_vendido,status,previsao_fechamento,ar_status,motivo_perda")
            .gte("data_orcamento", inicioISO)
            .lte("data_orcamento", fimISO);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("tasks").select("loja_id,due_at,status").eq("status", "pendente").lte("due_at", `${hoje}T23:59:59`);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_planejamentos").select("loja_id,status,periodo_inicio,periodo_fim").lte("periodo_inicio", fimISO).gte("periodo_fim", inicioISO);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_rotinas").select("loja_id,prazo,status,prioridade").neq("status", "concluido").lte("prazo", hoje);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_compras").select("loja_id,status,created_at,fornecedor_cadastrado").neq("status", "encerrado").neq("status", "cancelado");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_materiais").select("loja_id,estoque_atual,estoque_minimo");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_manutencoes_preventivas").select("loja_id,proxima_execucao,status").lte("proxima_execucao", em15);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_amostra_movimentacoes").select("loja_id,previsao_devolucao,data_devolucao").is("data_devolucao", null).lt("previsao_devolucao", hoje);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("sgp_pesos_saude_loja").select("loja_id,indicador,peso").eq("ativo", true);
          if (lojaId) q = q.or(`loja_id.is.null,loja_id.eq.${lojaId}`);
          return q;
        })(),
      ]);

      const errors = [lojas, orcamentos, tasks, planejamentos, rotinas, compras, materiais, manutencoes, amostras, pesos].map((r: any) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];

      return {
        lojas: (lojas.data ?? []) as Loja[],
        orcamentos: (orcamentos.data ?? []) as Orcamento[],
        tasks: (tasks.data ?? []) as Task[],
        planejamentos: (planejamentos.data ?? []) as Planejamento[],
        rotinas: (rotinas.data ?? []) as Rotina[],
        compras: (compras.data ?? []) as Compra[],
        materiais: (materiais.data ?? []) as Material[],
        manutencoes: (manutencoes.data ?? []) as Manutencao[],
        amostras: (amostras.data ?? []) as AmostraMov[],
        pesos: (pesos.data ?? []) as PesoSaude[],
      };
    },
  });

  const rows = useMemo(() => buildRows(data, hoje), [data, hoje]);
  const resumo = useMemo(() => {
    const total = rows.length;
    const saudaveis = rows.filter((r) => r.status === "saudavel").length;
    const atencao = rows.filter((r) => r.status === "atencao").length;
    const criticas = rows.filter((r) => r.status === "critica").length;
    const notaMedia = total ? rows.reduce((s, r) => s + r.nota, 0) / total : 0;
    return { total, saudaveis, atencao, criticas, notaMedia };
  }, [rows]);

  const exportRows = rows.map((r) => ({
    Codigo: r.codigo,
    Loja: r.loja,
    Cidade: r.cidade,
    UF: r.uf,
    Nota: r.nota,
    Status: labelStatus(r.status),
    Entradas: r.entradas,
    Conversao: fmtPct(r.conversao),
    Orcado: r.orcado,
    Vendido: r.vendido,
    "Tempo medio conversao": r.tempo_medio_conversao ?? "",
    "Follow-ups vencidos": r.followups_vencidos,
    "Carteira em risco": r.carteira_risco,
    "AR pendente": r.ar_pendente,
    "Planejamento pendente": r.planejamentos_pendentes,
    "Manutencao vencida": r.manutencoes_vencidas,
    "Estoque critico": r.estoque_critico,
    "Compras abertas": r.compras_abertas,
    "Amostras atrasadas": r.amostras_atrasadas,
    "Rotinas atrasadas": r.rotinas_atrasadas,
    "Principal gap": r.principal_gap,
  }));
  const filename = `saude-lojas-${inicioISO}_a_${fimISO}`;

  return (
    <div>
      <PageHeader
        title="Saude da Loja"
        description="Painel executivo com nota por loja, cruzando comercial, carteira, planejamento e pendencias operacionais."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCSV(filename, exportRows)}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportExcel(filename, exportRows)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadPDF(filename, exportRows, {
              title: "Saude da Loja - Painel Executivo",
              subtitle: `Periodo ${fmtDate(inicioISO)} ate ${fmtDate(fimISO)}`,
              headers: ["Codigo", "Loja", "Nota", "Status", "Entradas", "Conversao", "Follow-ups vencidos", "Carteira em risco", "Planejamento pendente", "Principal gap"],
            })}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Mini label="Nota media" value={resumo.notaMedia.toFixed(0)} tone={resumo.notaMedia >= 80 ? "healthy" : resumo.notaMedia >= 60 ? "attention" : "critical"} />
        <Mini label="Lojas" value={resumo.total.toLocaleString("pt-BR")} />
        <Mini label="Saudaveis" value={resumo.saudaveis.toLocaleString("pt-BR")} tone="healthy" />
        <Mini label="Atencao" value={resumo.atencao.toLocaleString("pt-BR")} tone={resumo.atencao ? "attention" : "healthy"} />
        <Mini label="Criticas" value={resumo.criticas.toLocaleString("pt-BR")} tone={resumo.criticas ? "critical" : "healthy"} />
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-healthy)]" /> Saudavel: nota 80+</div>
          <div className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-[var(--status-attention)]" /> Atencao: nota 60 a 79</div>
          <div className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-[var(--status-critical)]" /> Critica: abaixo de 60</div>
          <div className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> A nota combina vendas, conversao, follow-up, planejamento, manutencao, compras, estoque e amostras.</div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Mapa de saude por loja propria</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Loja", "Nota", "Status", "Comercial", "Carteira", "Operacao", "Principal gap", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Calculando saude das lojas...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma loja propria ativa encontrada.</td></tr>}
              {rows.map((r) => (
                <tr key={r.loja_id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <div className="font-medium">{r.loja}</div>
                    <div className="text-xs text-muted-foreground">{r.codigo} - {r.cidade || "-"} {r.uf || ""}</div>
                  </td>
                  <td className="p-3 min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <span className="w-9 font-semibold tabular-nums">{r.nota}</span>
                      <Progress value={r.nota} className="h-2" />
                    </div>
                  </td>
                  <td className="p-3"><HealthBadge status={r.status} /></td>
                  <td className="p-3">
                    <div className="font-medium">{r.entradas} entradas</div>
                    <div className="text-xs text-muted-foreground">{fmtPct(r.conversao)} conv. - {fmtMoney(r.vendido)} vendido</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{r.followups_vencidos} follow-ups vencidos</div>
                    <div className="text-xs text-muted-foreground">{r.carteira_risco} em risco - {r.ar_pendente} AR pendente</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{r.manutencoes_vencidas + r.estoque_critico + r.compras_abertas + r.amostras_atrasadas + r.rotinas_atrasadas} pendencias</div>
                    <div className="text-xs text-muted-foreground">{r.planejamentos_pendentes} planejamento pendente</div>
                  </td>
                  <td className="p-3 max-w-[260px]">{r.principal_gap}</td>
                  <td className="p-3 text-right">
                    <Link to="/operacao/alertas" className="text-primary text-xs hover:underline">alertas</Link>
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

function buildRows(data: Awaited<ReturnType<typeof emptyData>> | undefined, hoje: string): HealthRow[] {
  const base = data ?? emptyData();
  const orcByLoja = group(base.orcamentos, (r) => r.loja_id);
  const tasksByLoja = group(base.tasks, (r) => r.loja_id);
  const planByLoja = group(base.planejamentos, (r) => r.loja_id);
  const rotinaByLoja = group(base.rotinas, (r) => r.loja_id);
  const compraByLoja = group(base.compras, (r) => r.loja_id);
  const materialByLoja = group(base.materiais, (r) => r.loja_id);
  const manutByLoja = group(base.manutencoes, (r) => r.loja_id);
  const amostraByLoja = group(base.amostras, (r) => r.loja_id);
  const pesoMap = buildPesoMap(base.pesos);

  return base.lojas.map((loja) => {
    const orcs = orcByLoja.get(loja.id) ?? [];
    const entradas = orcs.length;
    const vendas = orcs.filter((o) => money(o.valor_vendido) > 0 || o.status === "vendido").length;
    const vendido = orcs.reduce((s, o) => s + money(o.valor_vendido), 0);
    const orcado = orcs.reduce((s, o) => s + money(o.valor_orcado), 0);
    const conversao = entradas ? vendas / entradas : 0;
    const tempoMedio = avg(orcs
      .filter((o) => o.data_venda)
      .map((o) => diffDays(o.data_orcamento, o.data_venda!)));
    const carteiraRisco = orcs.filter((o) => {
      if (!["orcado", "parcial"].includes(String(o.status))) return false;
      const previsaoVencida = o.previsao_fechamento && o.previsao_fechamento < hoje;
      const abertoLongo = diffDays(o.data_orcamento, hoje) >= 30;
      return previsaoVencida || abertoLongo;
    }).length;
    const arPendente = orcs.filter((o) => ["pendente", "divergente"].includes(String(o.ar_status))).length;
    const followups = tasksByLoja.get(loja.id)?.length ?? 0;
    const planejamentos = planByLoja.get(loja.id) ?? [];
    const planejamentoPendente = planejamentos.some((p) => p.status !== "concluido") || planejamentos.length === 0 ? 1 : 0;
    const rotinasAtrasadas = rotinaByLoja.get(loja.id)?.length ?? 0;
    const comprasAbertas = (compraByLoja.get(loja.id) ?? []).filter((c) => diffDays(c.created_at.slice(0, 10), hoje) >= 3 || !c.fornecedor_cadastrado).length;
    const estoqueCritico = (materialByLoja.get(loja.id) ?? []).filter((m) => money(m.estoque_atual) < money(m.estoque_minimo)).length;
    const manutencoesVencidas = (manutByLoja.get(loja.id) ?? []).filter((m) => !m.proxima_execucao || m.proxima_execucao <= hoje || m.status === "vencida").length;
    const amostrasAtrasadas = amostraByLoja.get(loja.id)?.length ?? 0;

    const w = (indicador: string, fallback: number) => getPeso(pesoMap, loja.id, indicador, fallback);
    const gaps = [
      { label: "Sem entrada de orcamentos", peso: entradas === 0 ? w("sem_entrada_orcamentos", 15) : 0 },
      { label: "Conversao baixa", peso: entradas > 0 && conversao < 0.2 ? w("conversao_baixa", 12) : 0 },
      { label: "Follow-ups vencidos", peso: Math.min(w("followups_vencidos", 15), followups * 3) },
      { label: "Carteira em risco", peso: Math.min(w("carteira_risco", 15), carteiraRisco * 3) },
      { label: "AR pendente/divergente", peso: Math.min(w("ar_pendente", 10), arPendente * 2) },
      { label: "Planejamento/FCA pendente", peso: planejamentoPendente ? w("planejamento_pendente", 12) : 0 },
      { label: "Manutencao preventiva vencida", peso: Math.min(w("manutencao_vencida", 10), manutencoesVencidas * 4) },
      { label: "Estoque critico", peso: Math.min(w("estoque_critico", 10), estoqueCritico * 3) },
      { label: "Compra aberta fora do processo", peso: Math.min(w("compra_aberta", 8), comprasAbertas * 2) },
      { label: "Amostras atrasadas", peso: Math.min(w("amostra_atrasada", 8), amostrasAtrasadas * 2) },
      { label: "Rotinas atrasadas", peso: Math.min(w("rotina_atrasada", 8), rotinasAtrasadas * 2) },
    ].sort((a, b) => b.peso - a.peso);
    const penalidade = Math.min(90, gaps.reduce((s, g) => s + g.peso, 0));
    const nota = Math.max(0, Math.round(100 - penalidade));
    const status = nota >= 80 ? "saudavel" : nota >= 60 ? "atencao" : "critica";

    return {
      loja_id: loja.id,
      codigo: loja.codigo ?? "-",
      loja: loja.nome,
      cidade: loja.cidade ?? "",
      uf: loja.uf ?? "",
      nota,
      status,
      entradas,
      vendido,
      orcado,
      conversao,
      tempo_medio_conversao: tempoMedio,
      followups_vencidos: followups,
      carteira_risco: carteiraRisco,
      ar_pendente: arPendente,
      planejamentos_pendentes: planejamentoPendente,
      manutencoes_vencidas: manutencoesVencidas,
      estoque_critico: estoqueCritico,
      compras_abertas: comprasAbertas,
      amostras_atrasadas: amostrasAtrasadas,
      rotinas_atrasadas: rotinasAtrasadas,
      principal_gap: gaps.find((g) => g.peso > 0)?.label ?? "Operacao saudavel no periodo",
    };
  }).sort((a, b) => a.nota - b.nota || a.loja.localeCompare(b.loja));
}

function emptyData() {
  return {
    lojas: [] as Loja[],
    orcamentos: [] as Orcamento[],
    tasks: [] as Task[],
    planejamentos: [] as Planejamento[],
    rotinas: [] as Rotina[],
    compras: [] as Compra[],
    materiais: [] as Material[],
    manutencoes: [] as Manutencao[],
    amostras: [] as AmostraMov[],
    pesos: [] as PesoSaude[],
  };
}

function group<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function buildPesoMap(rows: PesoSaude[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.loja_id ?? "global"}:${r.indicador}`;
    map.set(key, Number(r.peso) || 0);
  }
  return map;
}

function getPeso(map: Map<string, number>, lojaId: string, indicador: string, fallback: number) {
  return map.get(`${lojaId}:${indicador}`) ?? map.get(`global:${indicador}`) ?? fallback;
}

function HealthBadge({ status }: { status: HealthRow["status"] }) {
  return (
    <Badge variant="outline" className={cn(
      status === "saudavel" && "border-[var(--status-healthy)]/40 bg-[var(--status-healthy-soft)] text-[var(--status-healthy)]",
      status === "atencao" && "border-[var(--status-attention)]/40 bg-[var(--status-attention-soft)] text-[var(--status-attention)]",
      status === "critica" && "border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)] text-[var(--status-critical)]",
    )}>
      {status === "saudavel" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
      {labelStatus(status)}
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
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Saude das Lojas");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function labelStatus(status: HealthRow["status"]) {
  if (status === "saudavel") return "Saudavel";
  if (status === "atencao") return "Atencao";
  return "Critica";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string) {
  const a = new Date(`${start.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${end.slice(0, 10)}T12:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

function avg(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function money(n: number | null | undefined) {
  return Number(n) || 0;
}

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}
