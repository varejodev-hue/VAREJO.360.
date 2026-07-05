import { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Loader2, Clock, Database } from "lucide-react";

export type ImportMode = "orcamento" | "venda";

type ImportRow = {
  numero?: string | number;
  numero_pedido?: string | number;
  data?: string | number;
  loja?: string;
  canal?: string;
  vendedor?: string;
  especificador?: string;
  cliente?: string;
  valor_orcado?: string | number;
  valor_vendido?: string | number;
  data_venda?: string | number;
  status?: string;
  observacao?: string;
  categoria?: string;
  linha_produto?: string;
  formato?: string;
  tamanho?: string;
  codigo_produto?: string;
  descricao_produto?: string;
};

type PhaseStatus = "pending" | "running" | "done" | "error";
type PhaseProgress = {
  index: number;
  label: string;
  status: PhaseStatus;
  done: number;
  total: number;
  elapsedMs: number;
  detail?: string;
};

type ImportResult = {
  sucesso: number;
  inseridos: number;
  atualizados: number;
  lojas_criadas: number;
  vendedores_criados: number;
  especificadores_criados: number;
  clientes_criados: number;
  lojas_sem_canal: number;
  total_staging: number;
};

const HEADER_MAP: Record<string, keyof ImportRow> = {
  "numero": "numero", "número": "numero", "n orcamento": "numero", "nº orçamento": "numero", "n° orçamento": "numero",
  "n orçamento": "numero", "no orcamento": "numero",
  "nr_orcamento": "numero", "nr orcamento": "numero",
  "nr_quote": "numero", "nr quote": "numero",
  "nr_pedido": "numero_pedido", "nr pedido": "numero_pedido", "numero pedido": "numero_pedido", "número pedido": "numero_pedido",
  "data": "data", "data orçamento": "data", "data orcamento": "data",
  "dt_evento": "data", "dt evento": "data",
  "dt_created": "data", "dt created": "data", "dt_create": "data", "dt create": "data", "data criacao": "data", "data criação": "data",
  "dt. criacao": "data", "dt. criação": "data", "dt criacao": "data", "dt criação": "data",
  "loja": "loja", "nome_loja": "loja", "nome loja": "loja", "nome da loja": "loja",
  "nome_praca": "loja", "nome praca": "loja", "nome praça": "loja", "praca": "loja", "praça": "loja",
  "canal": "canal", "tipo loja": "canal", "tipo_loja": "canal",
  "franquia_propria": "canal", "franquia propria": "canal", "franquia/própria": "canal",
  "vendedor": "vendedor", "operacao_atual": "vendedor", "operacao atual": "vendedor",
  "consultor_atual": "vendedor", "consultor atual": "vendedor",
  "vend_nome": "vendedor", "vend nome": "vendedor", "nome vendedor": "vendedor", "nome do vendedor": "vendedor",
  "especificador": "especificador", "arquiteto": "especificador",
  "nome especificador": "especificador", "nome_especificador": "especificador",
  "nm_especificador": "especificador", "nm especificador": "especificador",
  "cliente": "cliente", "nome cliente": "cliente", "nome do cliente": "cliente",
  "nm_cliente": "cliente", "nm cliente": "cliente",
  "valor orcado": "valor_orcado", "valor orçado": "valor_orcado", "vlr orçado": "valor_orcado",
  "valor_item": "valor_orcado", "valor item": "valor_orcado",
  "valor liquido orcamento": "valor_orcado", "valor líquido orçamento": "valor_orcado",
  "valor liquido": "valor_orcado", "valor líquido": "valor_orcado",
  "valor vendido": "valor_vendido", "vlr vendido": "valor_vendido", "valor venda": "valor_vendido",
  "data venda": "data_venda", "data da venda": "data_venda",
  "data da previsao de fechamento": "data_venda", "data da previsão de fechamento": "data_venda",
  "dt_prev_fechamento": "data_venda", "dt prev fechamento": "data_venda",
  "status": "status", "situação": "status", "situacao": "status",
  "ds_status": "status", "ds status": "status",
  "status orc.": "status", "status orç.": "status", "status orc": "status", "status orç": "status",
  "status oportunidade": "status", "status da oportunidade": "status",
  "ds_status_oportunidade": "status", "ds status oportunidade": "status",
  "observação": "observacao", "observacao": "observacao", "obs": "observacao",
  "comentarios do regional": "observacao", "comentários do regional": "observacao",

  "categoria": "categoria", "categoria produto": "categoria", "categoria do produto": "categoria",
  "ds_categoria": "categoria", "ds categoria": "categoria", "grupo": "categoria", "grupo produto": "categoria",
  "linha": "linha_produto", "linha produto": "linha_produto", "linha do produto": "linha_produto", "familia": "linha_produto", "família": "linha_produto",
  "formato": "formato", "tipo formato": "formato", "ds_formato": "formato",
  "tamanho": "tamanho", "tamanho produto": "tamanho", "medida": "tamanho", "dimensao": "tamanho", "dimensão": "tamanho",
  "codigo produto": "codigo_produto", "código produto": "codigo_produto", "cod. produto": "codigo_produto",
  "cód. produto": "codigo_produto", "cod produto": "codigo_produto", "sku": "codigo_produto",
  "cd_produto": "codigo_produto", "cd produto": "codigo_produto",
  "descricao produto": "descricao_produto", "descrição produto": "descricao_produto",
  "descricao do produto": "descricao_produto", "descrição do produto": "descricao_produto",
  "descricao": "descricao_produto", "descrição": "descricao_produto",
  "ds_produto": "descricao_produto", "ds produto": "descricao_produto",
};

function normalizeHeader(h: string) {
  return h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

// Pre-normalize all HEADER_MAP keys so accented aliases match the normalized input.
const NORMALIZED_HEADER_MAP: Record<string, keyof ImportRow> = Object.fromEntries(
  Object.entries(HEADER_MAP).map(([k, v]) => [normalizeHeader(k), v])
);

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

function mapOne(r: Record<string, unknown>, mode: ImportMode): ImportRow {
  const out: ImportRow = {};
  let sellout: unknown = undefined;
  for (const [k, v] of Object.entries(r)) {
    const key0 = normalizeHeader(k);
    if (key0 === "tp_registro" || key0 === "tp registro") continue;
    if (key0 === "sellout") { sellout = v; continue; }
    const key = NORMALIZED_HEADER_MAP[key0];
    if (key) (out as Record<string, unknown>)[key] = v;
  }
  if (sellout !== undefined) {
    if (mode === "venda") {
      out.valor_vendido = sellout as string | number;
      if (!out.data_venda) out.data_venda = out.data;
    } else {
      out.valor_orcado = sellout as string | number;
    }
  }
  if (mode === "venda") {
    if (!out.valor_vendido && out.valor_orcado) {
      out.valor_vendido = out.valor_orcado;
      out.valor_orcado = undefined;
    }
    if (!out.data_venda) out.data_venda = out.data;
    if (!out.status) out.status = "vendido";
  }
  return out;
}

function mapRows(raw: Record<string, unknown>[], mode: ImportMode): ImportRow[] {
  return raw.map((r) => mapOne(r, mode));
}

function rowToStaging(r: ImportRow, logId: string, linha: number) {
  return {
    log_id: logId,
    linha,
    numero: norm(r.numero) || norm(r.numero_pedido) || null,
    numero_pedido: norm(r.numero_pedido) || null,
    data_orcamento: toDate(r.data) ?? toDate(r.data_venda),
    loja: norm(r.loja) || null,
    canal: norm(r.canal) || null,
    vendedor: (() => {
      const v = norm(r.vendedor);
      if (!v) return null;
      // Ignora "vendedor" genérico oriundo da coluna canal (ex.: PRÓPRIA, FRANQUIA)
      const lower = v.toLowerCase().replace(/[^a-z]/g, "");
      if (["propria", "própria", "franquia", "own", "franchise"].includes(lower)) return null;
      return v;
    })(),
    especificador: norm(r.especificador) || null,
    cliente: norm(r.cliente) || null,
    valor_orcado: toNumber(r.valor_orcado),
    valor_vendido: toNumber(r.valor_vendido),
    data_venda: toDate(r.data_venda),
    status: norm(r.status) || null,
    observacao: norm(r.observacao) || null,
    categoria: norm(r.categoria) || null,
    linha_produto: norm(r.linha_produto) || null,
    formato: norm(r.formato) || null,
    tamanho: norm(r.tamanho) || null,
    codigo_produto: norm(r.codigo_produto) || null,
    descricao_produto: norm(r.descricao_produto) || null,
  };
}

type Props = { mode: ImportMode };

export function ImportacaoForm({ mode }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [streamMode, setStreamMode] = useState(false);
  const [estimatedRows, setEstimatedRows] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [phases, setPhases] = useState<PhaseProgress[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  function resetForm() {
    setFile(null);
    setPreview([]);
    setEstimatedRows(0);
    setStreamMode(false);
    setResult(null);
    setPhases([]);
    setFileInputKey((k) => k + 1);
  }

  const isVenda = mode === "venda";
  const titulo = isVenda ? "Importar Vendas" : "Importar Orçamentos";
  const descricao = isVenda
    ? "Carregue uma planilha de vendas (.xlsx, .xls ou .csv). Importação direta no banco (staging + processamento set-based)."
    : "Carregue uma planilha de orçamentos (.xlsx, .xls ou .csv). Importação direta no banco (staging + processamento set-based).";

  async function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setPreview([]);
    setEstimatedRows(0);
    setStreamMode(false);
    const isCsv = /\.csv$/i.test(f.name);
    try {
      if (isCsv) {
        // CSV streaming: collect only first 50 mapped rows for preview, count total without buffering.
        setStreamMode(true);
        const sample: ImportRow[] = [];
        let rawFirst: Record<string, unknown> | null = null;
        let count = 0;
        await new Promise<void>((resolve, reject) => {
          Papa.parse<Record<string, unknown>>(f, {
            header: true,
            skipEmptyLines: true,
            worker: false,
            step: (results, parser) => {
              count++;
              if (!rawFirst) rawFirst = results.data;
              if (sample.length < 50) {
                sample.push(mapOne(results.data, mode));
              }
              if (count % 50000 === 0) {
                parser.pause();
                setEstimatedRows(count);
                setTimeout(() => parser.resume(), 0);
              }
            },
            complete: () => resolve(),
            error: (err) => reject(err),
          });
        });
        setPreview(sample);
        setEstimatedRows(count);
        const mappedOk = sample.some((r) => norm(r.numero) || norm(r.loja) || norm(r.cliente));
        if (count === 0) toast.warning("Nenhuma linha reconhecida no CSV.");
        else if (!mappedOk && rawFirst) {
          console.warn("[Importação] Headers do CSV não mapeados. Cabeçalhos encontrados:", Object.keys(rawFirst));
          toast.warning(`Headers do CSV não reconhecidos: ${Object.keys(rawFirst).slice(0, 6).join(", ")}… (ver console)`);
        }
        else toast.success(`${count.toLocaleString("pt-BR")} linha(s) detectadas (CSV streaming).`);
      } else {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
        const rows = mapRows(json, mode);
        setPreview(rows);
        setEstimatedRows(rows.length);
        const mappedOk = rows.some((r) => norm(r.numero) || norm(r.loja) || norm(r.cliente));
        if (rows.length === 0) toast.warning("Nenhuma linha reconhecida na planilha.");
        else if (!mappedOk && json[0]) {
          console.warn("[Importação] Headers da planilha não mapeados. Cabeçalhos encontrados:", Object.keys(json[0]));
          toast.warning(`Headers da planilha não reconhecidos: ${Object.keys(json[0]).slice(0, 6).join(", ")}… (ver console)`);
        }
        else toast.success(`${rows.length.toLocaleString("pt-BR")} linha(s) prontas para importação.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler arquivo");
      setPreview([]);
      setEstimatedRows(0);
      setStreamMode(false);
    }
  }

  function updatePhase(idx: number, patch: Partial<PhaseProgress>) {
    setPhases((prev) => prev.map((p) => (p.index === idx ? { ...p, ...patch } : p)));
  }

  async function handleImport() {
    if (!file || estimatedRows === 0) {
      toast.error("Selecione um arquivo válido antes de importar.");
      return;
    }
    setLoading(true);
    setResult(null);

    const CHUNK = 2000;
    const total = estimatedRows;

    // Single rolling phase for streaming; deterministic phases for in-memory.
    const initial: PhaseProgress[] = streamMode
      ? [
          { index: 0, label: "Abrindo sessão de importação", status: "pending", done: 0, total: 1, elapsedMs: 0 },
          { index: 1, label: `Streaming CSV → staging (${total.toLocaleString("pt-BR")} linhas)`, status: "pending", done: 0, total, elapsedMs: 0 },
          { index: 2, label: "Processando no banco (set-based UPSERT)", status: "pending", done: 0, total, elapsedMs: 0 },
        ]
      : (() => {
          const totalChunks = Math.ceil(total / CHUNK);
          return [
            { index: 0, label: "Abrindo sessão de importação", status: "pending", done: 0, total: 1, elapsedMs: 0 },
            ...Array.from({ length: totalChunks }, (_, i) => ({
              index: i + 1,
              label: `Enviando lote ${i + 1}/${totalChunks} ao banco (linhas ${i * CHUNK + 1}–${Math.min((i + 1) * CHUNK, total)})`,
              status: "pending" as PhaseStatus,
              done: 0,
              total: Math.min(CHUNK, total - i * CHUNK),
              elapsedMs: 0,
            })),
            { index: totalChunks + 1, label: "Processando no banco (set-based UPSERT)", status: "pending", done: 0, total, elapsedMs: 0 },
          ];
        })();
    setPhases(initial);
    setProgressOpen(true);

    const tid = toast.loading(`Importando 0/${total.toLocaleString("pt-BR")}...`);
    let createdLogId: string | null = null;
    try {
      // Fase 0 — criar log
      const t0 = Date.now();
      updatePhase(0, { status: "running" });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: log, error: logErr } = await supabase
        .from("import_logs")
        .insert({ arquivo: file.name, tipo: isVenda ? "vendas" : "orcamentos", total_linhas: total, user_id: user.id })
        .select("id").single();
      if (logErr) throw new Error(`Falha ao criar log: ${logErr.message}`);
      createdLogId = log.id;
      updatePhase(0, { status: "done", done: 1, elapsedMs: Date.now() - t0, detail: `Log ${log.id.slice(0, 8)}…` });

      let uploadedRows = 0;

      if (streamMode) {
        // CSV streaming → staging em lotes, com backpressure (pause/resume).
        const streamStart = Date.now();
        updatePhase(1, { status: "running" });
        let buffer: ImportRow[] = [];
        let lineCounter = 0;
        let inflight: Promise<void> = Promise.resolve();

        const flush = async (batch: ImportRow[], startLinha: number) => {
          const rows = batch.map((r, j) => rowToStaging(r, log.id, startLinha + j));
          // Timeout + retry: requisição pode "pendurar" em rede ruim e travar o upload todo.
          const MAX_ATTEMPTS = 5;
          let lastErr: unknown = null;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              const insertPromise = supabase.from("orcamentos_staging").insert(rows);
              const result = await Promise.race([
                insertPromise,
                new Promise<{ error: { message: string } }>((_, rej) =>
                  setTimeout(() => rej(new Error("timeout (60s) ao enviar lote")), 60_000),
                ),
              ]);
              const { error } = result as { error: { message: string } | null };
              if (error) throw new Error(error.message);
              lastErr = null;
              break;
            } catch (e) {
              lastErr = e;
              if (attempt < MAX_ATTEMPTS) {
                const backoff = 1000 * attempt;
                toast.loading(`Lote linha ~${startLinha} falhou (tentativa ${attempt}/${MAX_ATTEMPTS}). Re-tentando em ${backoff / 1000}s...`, { id: tid });
                await new Promise((r) => setTimeout(r, backoff));
              }
            }
          }
          if (lastErr) throw new Error(`Lote (linha ~${startLinha}) após ${MAX_ATTEMPTS} tentativas: ${(lastErr as Error).message}`);
          uploadedRows += batch.length;
          updatePhase(1, { status: "running", done: uploadedRows, elapsedMs: Date.now() - streamStart });
          toast.loading(`Enviando ao banco ${uploadedRows.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")}...`, { id: tid });
        };

        await new Promise<void>((resolve, reject) => {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            worker: false,
            step: (results, parser) => {
              lineCounter++;
              buffer.push(mapOne(results.data, mode));
              if (buffer.length >= CHUNK) {
                const batch = buffer;
                const startLinha = lineCounter - batch.length + 2; // +2 for header + 1-based
                buffer = [];
                parser.pause();
                inflight = inflight
                  .then(() => flush(batch, startLinha))
                  .then(() => parser.resume())
                  .catch((err) => {
                    parser.abort();
                    reject(err);
                  });
              }
            },
            complete: () => {
              const tail = buffer;
              const startLinha = lineCounter - tail.length + 2;
              buffer = [];
              inflight
                .then(() => (tail.length > 0 ? flush(tail, startLinha) : Promise.resolve()))
                .then(() => resolve())
                .catch(reject);
            },
            error: (err) => reject(err),
          });
        });
        updatePhase(1, { status: "done", done: uploadedRows, elapsedMs: Date.now() - streamStart });
      } else {
        // Caminho em memória (XLSX): mantém upload paralelo.
        const totalChunks = Math.ceil(total / CHUNK);
        const CONCURRENCY = 4;
        let nextChunk = 0;
        const uploadOne = async (i: number) => {
          const phaseIdx = i + 1;
          const start = i * CHUNK;
          const slice = preview.slice(start, start + CHUNK);
          const ct0 = Date.now();
          updatePhase(phaseIdx, { status: "running" });
          const rows = slice.map((r, j) => rowToStaging(r, log.id, start + j + 2));
          const { error } = await supabase.from("orcamentos_staging").insert(rows);
          if (error) {
            updatePhase(phaseIdx, { status: "error", elapsedMs: Date.now() - ct0, detail: error.message });
            throw new Error(`Lote ${i + 1}: ${error.message}`);
          }
          uploadedRows += slice.length;
          updatePhase(phaseIdx, { status: "done", done: slice.length, elapsedMs: Date.now() - ct0 });
          toast.loading(`Enviando ao banco ${uploadedRows.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")}...`, { id: tid });
        };
        const workers = Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, async () => {
          while (true) {
            const i = nextChunk++;
            if (i >= totalChunks) return;
            await uploadOne(i);
          }
        });
        await Promise.all(workers);
      }

      // Fase final — processar no banco em pedaços (evita timeout do proxy HTTP)
      const procIdx = streamMode ? 2 : Math.ceil(total / CHUNK) + 1;
      const pt0 = Date.now();
      updatePhase(procIdx, { status: "running", total });
      const CHUNK_ROWS = 20000;
      const agg: ImportResult = {
        sucesso: 0, inseridos: 0, atualizados: 0,
        lojas_criadas: 0, vendedores_criados: 0, especificadores_criados: 0,
        clientes_criados: 0, lojas_sem_canal: 0, total_staging: total,
      };
      let remaining = total;
      let iter = 0;
      while (remaining > 0) {
        iter += 1;
        toast.loading(`Processando no banco... ${(total - remaining).toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")} (lote ${iter})`, { id: tid });
        const { data: res, error: rpcErr } = await supabase.rpc(
          "process_orcamentos_staging_chunk",
          { _log_id: log.id, _limit: CHUNK_ROWS },
        );
        if (rpcErr) {
          updatePhase(procIdx, { status: "error", elapsedMs: Date.now() - pt0, detail: rpcErr.message, done: total - remaining });
          throw new Error(`Processamento falhou no lote ${iter}: ${rpcErr.message}`);
        }
        const r = res as unknown as {
          processed: number; inseridos: number; atualizados: number;
          lojas_criadas: number; vendedores_criados: number; especificadores_criados: number;
          clientes_criados: number; lojas_sem_canal: number; remaining: number; done: boolean;
        };
        agg.inseridos += r.inseridos;
        agg.atualizados += r.atualizados;
        agg.sucesso += r.inseridos + r.atualizados;
        agg.lojas_criadas += r.lojas_criadas;
        agg.vendedores_criados += r.vendedores_criados;
        agg.especificadores_criados += r.especificadores_criados;
        agg.clientes_criados += r.clientes_criados;
        agg.lojas_sem_canal = Math.max(agg.lojas_sem_canal, r.lojas_sem_canal);
        remaining = r.remaining;
        updatePhase(procIdx, { status: "running", done: total - remaining, total, elapsedMs: Date.now() - pt0 });
        if (r.processed === 0) break; // safety
      }
      updatePhase(procIdx, { status: "done", done: agg.sucesso, total, elapsedMs: Date.now() - pt0, detail: `${agg.inseridos} novos · ${agg.atualizados} atualizados` });
      setResult(agg);
      toast.dismiss(tid);
      toast.success(`✓ ${agg.sucesso.toLocaleString("pt-BR")} ${isVenda ? "venda(s)" : "orçamento(s)"} processados (${agg.inseridos} novos, ${agg.atualizados} atualizados).`);
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e instanceof Error ? e.message : "Falha na importação");
      // Auto-cleanup: remove linhas órfãs do staging + log incompleto quando a importação falha.
      if (createdLogId) {
        try {
          await supabase.from("orcamentos_staging").delete().eq("log_id", createdLogId);
          await supabase.from("import_logs").delete().eq("id", createdLogId);
          toast.info("Tentativa incompleta limpa automaticamente. Pode reimportar.");
        } catch (cleanupErr) {
          console.error("Falha ao limpar staging órfão:", cleanupErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function downloadModelo() {
    const ws = isVenda
      ? XLSX.utils.json_to_sheet([
          { Numero: "VEN-001", Data: "10/06/2026", Loja: "Loja Centro", Vendedor: "João Silva", Especificador: "Maria Arquiteta", Cliente: "Construtora ABC", "Valor Vendido": 8200, "Data Venda": "10/06/2026", Status: "vendido", Observação: "" },
        ])
      : XLSX.utils.json_to_sheet([
          { Numero: "ORC-001", Data: "01/06/2026", Loja: "Loja Centro", Vendedor: "João Silva", Especificador: "Maria Arquiteta", Cliente: "Construtora ABC", "Valor Orçado": 12500.5, Status: "orcado", Observação: "" },
        ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isVenda ? "Vendas" : "Orçamentos");
    XLSX.writeFile(wb, isVenda ? "modelo-vendas.xlsx" : "modelo-orcamentos.xlsx");
  }

  return (
    <div>
      <PageHeader
        title={titulo}
        description={descricao}
        action={
          <Button variant="outline" onClick={downloadModelo}>
            <Download className="h-4 w-4 mr-2" /> Modelo
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input key={fileInputKey} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {estimatedRows > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">
                Pré-visualização ({estimatedRows.toLocaleString("pt-BR")} linhas{streamMode ? " · CSV streaming, amostra de 50" : ""})
              </div>
              <div className="border rounded-md max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      {["Numero","Data","Loja","Vendedor","Especificador","Cliente", isVenda ? "V.Vendido" : "V.Orçado","Status"].map((h) => (
                        <th key={h} className="text-left p-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{String(r.numero ?? "")}</td>
                        <td className="p-2">{String(r.data ?? "")}</td>
                        <td className="p-2">{r.loja}</td>
                        <td className="p-2">{r.vendedor}</td>
                        <td className="p-2">{r.especificador}</td>
                        <td className="p-2">{r.cliente}</td>
                        <td className="p-2">{String((isVenda ? r.valor_vendido : r.valor_orcado) ?? "")}</td>
                        <td className="p-2">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={loading} onClick={handleImport}>
                  <Database className="h-4 w-4 mr-2" />
                  {loading ? "Importando..." : `Importar via banco (${estimatedRows.toLocaleString("pt-BR")} linhas)`}
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-4 space-y-3 bg-green-50 dark:bg-green-950/20 border-green-300">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {result.sucesso.toLocaleString("pt-BR")} processados · {result.inseridos.toLocaleString("pt-BR")} novos · {result.atualizados.toLocaleString("pt-BR")} atualizados
              </div>
              <div className="text-xs text-muted-foreground">
                Cadastros criados: {result.lojas_criadas} lojas, {result.vendedores_criados} vendedores, {result.especificadores_criados} especificadores, {result.clientes_criados} clientes.
              </div>
              {result.lojas_sem_canal > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                  <span><strong>{result.lojas_sem_canal}</strong> loja(s) sem classificação de canal. Edite em <em>Cadastros → Lojas</em>.</span>
                </div>
              )}
              <div className="pt-1">
                <Button size="sm" variant="outline" onClick={resetForm}>
                  Importar outra planilha
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={progressOpen} onOpenChange={(o) => { if (loading) return; setProgressOpen(o); if (!o && result) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              Importação via banco
            </DialogTitle>
            <DialogDescription>
              {estimatedRows.toLocaleString("pt-BR")} linha(s) — upload em staging + processamento set-based.
            </DialogDescription>
          </DialogHeader>
          {result && !loading && (
            <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/20 p-3 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <div className="font-medium text-green-900 dark:text-green-200">Importação concluída com sucesso</div>
                <div className="text-xs text-muted-foreground">
                  {result.sucesso.toLocaleString("pt-BR")} processados · {result.inseridos.toLocaleString("pt-BR")} novos · {result.atualizados.toLocaleString("pt-BR")} atualizados
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {phases.map((p) => {
              const pct = p.status === "done" ? 100 : (p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0);
              const icon = p.status === "done" ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : p.status === "error" ? <AlertCircle className="h-4 w-4 text-destructive" />
                : p.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                : <Clock className="h-4 w-4 text-muted-foreground" />;
              return (
                <div key={p.index} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      {icon}
                      <span>{p.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.elapsedMs > 0 && `${(p.elapsedMs / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  {p.detail && <div className="text-xs text-muted-foreground">{p.detail}</div>}
                </div>
              );
            })}
          </div>

          {!loading && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => { setProgressOpen(false); if (result) resetForm(); }}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
