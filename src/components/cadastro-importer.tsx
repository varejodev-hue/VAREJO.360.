import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";

type Row = Record<string, string | number | null | undefined>;
type Result = { sucesso: number; erros: { linha: number; erro: string }[]; criados: number; atualizados: number };

export function CadastroImporter({
  titulo,
  colunas,
  modeloNome,
  modeloRows,
  onImport,
}: {
  titulo: string;
  colunas: string[];
  modeloNome: string;
  modeloRows: Record<string, string | number>[];
  onImport: (args: { data: { arquivo: string; rows: Row[] } }) => Promise<Result>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleFile(f: File) {
    setFile(f); setResult(null);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const json = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    setPreview(json);
  }

  async function doImport() {
    if (!file || preview.length === 0) return;
    setLoading(true);
    const BATCH_SIZE = 250;
    const CONCURRENCY = 6;
    const GROUP_SIZE = 10_000;
    const BATCH_TIMEOUT_MS = 90_000;
    const total = preview.length;
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    const totalGroups = Math.ceil(total / GROUP_SIZE);
    const t0 = Date.now();
    const loadingId = toast.loading(`Importando 0/${total}...`);
    const agg: Result = { sucesso: 0, criados: 0, atualizados: 0, erros: [] };
    let completed = 0;
    const runBatch = async (i: number) => {
      const start = i * BATCH_SIZE;
      const batch = preview.slice(start, start + BATCH_SIZE);
      const bt0 = Date.now();
      try {
        const res = await Promise.race([
          onImport({ data: { arquivo: `${file.name} [lote ${i + 1}/${totalBatches}]`, rows: batch } }),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error(`Servidor não respondeu em ${BATCH_TIMEOUT_MS / 1000}s (lote travado)`)), BATCH_TIMEOUT_MS),
          ),
        ]);
        agg.sucesso += res.sucesso;
        agg.criados += res.criados;
        agg.atualizados += res.atualizados;
        agg.erros.push(...res.erros.map((e) => ({ ...e, linha: e.linha + start })));
      } catch (e) {
        const secs = Math.round((Date.now() - bt0) / 1000);
        const msg = e instanceof Error ? e.message : String(e);
        agg.erros.push({ linha: start + 1, erro: `Lote ${i + 1} falhou após ${secs}s: ${msg}` });
        toast.error(`Lote ${i + 1}/${totalBatches} ${msg.includes("travado") ? "travou" : "falhou"} após ${secs}s — linhas ${start + 1}-${start + batch.length}`);
      } finally {
        completed += 1;
        const done = Math.min(completed * BATCH_SIZE, total);
        const elapsed = (Date.now() - t0) / 1000;
        const rate = done / Math.max(elapsed, 1);
        const eta = rate > 0 ? Math.round((total - done) / rate) : 0;
        toast.loading(`Importando ${done}/${total} · ${completed}/${totalBatches} lotes · ETA ~${eta}s`, { id: loadingId });
      }
    };
    try {
      for (let g = 0; g < totalGroups; g++) {
        const groupStartBatch = Math.floor((g * GROUP_SIZE) / BATCH_SIZE);
        const groupEndBatch = Math.min(Math.ceil(((g + 1) * GROUP_SIZE) / BATCH_SIZE), totalBatches);
        toast.loading(`Grupo ${g + 1}/${totalGroups} — processando lotes ${groupStartBatch + 1}-${groupEndBatch}...`, { id: loadingId });
        let nextIndex = groupStartBatch;
        const workers = Array.from({ length: Math.min(CONCURRENCY, groupEndBatch - groupStartBatch) }, async () => {
          while (true) {
            const i = nextIndex++;
            if (i >= groupEndBatch) return;
            await runBatch(i);
          }
        });
        await Promise.all(workers);
        await new Promise((r) => setTimeout(r, 250));
      }
      setResult(agg);
      toast.dismiss(loadingId);
      if (agg.erros.length === 0) toast.success(`✓ ${agg.sucesso} linha(s) processada(s) (${agg.criados} criados, ${agg.atualizados} atualizados).`);
      else if (agg.sucesso > 0) toast.warning(`Concluído: ${agg.sucesso} ok · ${agg.erros.length} erro(s).`);
      else toast.error(`Falha: 0 importados · ${agg.erros.length} erro(s).`);
    } catch (e) {
      toast.dismiss(loadingId);
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setLoading(false); }
  }

  function modelo() {
    const ws = XLSX.utils.json_to_sheet(modeloRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titulo);
    XLSX.writeFile(wb, modeloNome);
  }

  const previewCols = preview[0] ? Object.keys(preview[0]).slice(0, 8) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{titulo}</CardTitle>
        <Button variant="outline" size="sm" onClick={modelo}><Download className="h-4 w-4 mr-2" />Modelo</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <p className="text-xs text-muted-foreground">
          Colunas aceitas: <strong>{colunas.join(", ")}</strong>. Registros existentes (mesmo nome) são atualizados; novos são criados.
        </p>

        {preview.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Pré-visualização ({preview.length} linhas)</div>
            <div className="border rounded-md max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>{previewCols.map((c) => <th key={c} className="text-left p-2 font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">{previewCols.map((c) => <td key={c} className="p-2">{String(r[c] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="mt-4" disabled={loading} onClick={doImport}>
              <Upload className="h-4 w-4 mr-2" />{loading ? "Importando..." : `Importar ${preview.length} linhas`}
            </Button>
          </div>
        )}

        {result && (
          <div className="rounded-md border p-4 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {result.criados} criados · {result.atualizados} atualizados · {result.erros.length} erros
            </div>
            {result.erros.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto border rounded p-2 bg-background">
                {result.erros.slice(0, 100).map((e, i) => (
                  <div key={i} className="text-xs flex items-start gap-2 py-0.5">
                    <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                    <span>Linha {e.linha}: {e.erro}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
