import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/importacao/ar")({
  component: ImportarAr,
});

type ArRow = {
  numero: string;
  numero_pedido: string;
  cliente: string;
  valor_pago: number;
  data_pagamento: string | null;
  status: "pendente" | "parcial" | "pago" | "divergente";
};

function norm(v: unknown) {
  return String(v ?? "").trim();
}

function normMoney(v: unknown) {
  const s = norm(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normDate(v: unknown) {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = norm(v);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0].slice(0, 10) : null;
}

function pick(r: Record<string, unknown>, keys: string[]) {
  const found = Object.entries(r).find(([k]) => keys.includes(k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  return found?.[1];
}

function mapRow(r: Record<string, unknown>): ArRow {
  const statusRaw = norm(pick(r, ["status", "situacao"])).toLowerCase();
  const status = statusRaw.includes("diverg") ? "divergente"
    : statusRaw.includes("parc") ? "parcial"
      : statusRaw.includes("pend") ? "pendente"
        : "pago";
  return {
    numero: norm(pick(r, ["numero", "orcamento", "n orcamento", "num_orcamento"])),
    numero_pedido: norm(pick(r, ["pedido", "numero pedido", "numero_pedido", "n pedido"])),
    cliente: norm(pick(r, ["cliente", "nome cliente"])),
    valor_pago: normMoney(pick(r, ["valor pago", "valor_pago", "valor", "ar"])),
    data_pagamento: normDate(pick(r, ["data pagamento", "data_pagamento", "pagamento", "data"])),
    status,
  };
}

function ImportarAr() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ArRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ processados: number; atualizados: number } | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setResult(null);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const mapped = json.map(mapRow).filter((r) => r.numero || r.numero_pedido);
    setRows(mapped);
    if (mapped.length === 0) toast.warning("Nenhuma linha com número de orçamento ou pedido foi encontrada.");
    else toast.success(`${mapped.length.toLocaleString("pt-BR")} linha(s) prontas para importar.`);
  }

  async function importar() {
    if (!file || rows.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data: log, error: logError } = await supabase
        .from("import_logs")
        .insert({ arquivo: file.name, tipo: "ar_pagamentos", total_linhas: rows.length, user_id: auth.user?.id ?? null } as any)
        .select("id")
        .single();
      if (logError) throw logError;

      let atualizados = 0;
      for (const row of rows) {
        const { data: orc, error: findError } = await (supabase as any)
          .from("orcamentos")
          .select("id,loja_id,vendedor_id")
          .or([
            row.numero ? `numero.eq.${row.numero}` : "",
            row.numero_pedido ? `numero_pedido.eq.${row.numero_pedido}` : "",
          ].filter(Boolean).join(","))
          .limit(1)
          .maybeSingle();
        if (findError) throw findError;

        await (supabase as any).from("orcamentos_ar_pagamentos").insert({
          numero: row.numero || null,
          numero_pedido: row.numero_pedido || null,
          loja_id: orc?.loja_id ?? null,
          vendedor_id: orc?.vendedor_id ?? null,
          cliente: row.cliente || null,
          valor_pago: row.valor_pago,
          data_pagamento: row.data_pagamento,
          status: row.status,
          arquivo: file.name,
          import_log_id: log.id,
          created_by: auth.user?.id ?? null,
        });

        if (orc?.id) {
          const { error: updError } = await (supabase as any).from("orcamentos").update({
            ar_status: row.status,
            ar_pago_em: row.data_pagamento,
            ar_valor_pago: row.valor_pago,
            ar_observacao: `Atualizado pela importação ${file.name}`,
          }).eq("id", orc.id);
          if (updError) throw updError;
          atualizados += 1;
        }
      }

      const { error: logUpdateError } = await supabase
        .from("import_logs")
        .update({ total_sucesso: rows.length, total_erro: rows.length - atualizados } as any)
        .eq("id", log.id);
      if (logUpdateError) console.warn("Importação concluída, mas o usuário não pode atualizar o log:", logUpdateError.message);
      setResult({ processados: rows.length, atualizados });
      toast.success(`${atualizados.toLocaleString("pt-BR")} orçamento(s) atualizados com AR.`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao importar AR.");
    } finally {
      setLoading(false);
    }
  }

  function baixarModelo() {
    const ws = XLSX.utils.json_to_sheet([
      { Orcamento: "ORC-001", Pedido: "PED-001", Cliente: "Cliente ABC", "Valor Pago": 2500, "Data Pagamento": "04/07/2026", Status: "pago" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AR");
    XLSX.writeFile(wb, "modelo-ar-pagamentos.xlsx");
  }

  return (
    <div>
      <PageHeader
        title="Importar AR Pago"
        description="Atualize a carteira do vendedor com pagamento de AR por orçamento ou pedido."
        action={<Button variant="outline" onClick={baixarModelo}><Download className="h-4 w-4 mr-2" /> Modelo</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Planilha de AR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">{rows.length.toLocaleString("pt-BR")} linha(s) reconhecidas.</div>
                <Button onClick={importar} disabled={loading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {loading ? "Importando..." : "Importar AR"}
                </Button>
              </div>
              <div className="border rounded-md max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>{["Orçamento", "Pedido", "Cliente", "Valor", "Pagamento", "Status"].map((h) => <th key={h} className="text-left p-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 80).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{r.numero || "-"}</td>
                        <td className="p-2 font-mono">{r.numero_pedido || "-"}</td>
                        <td className="p-2">{r.cliente || "-"}</td>
                        <td className="p-2 tabular-nums">{r.valor_pago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="p-2">{r.data_pagamento ?? "-"}</td>
                        <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {result && (
            <div className="rounded-md border bg-emerald-500/5 border-emerald-500/25 p-3 text-sm">
              {result.processados.toLocaleString("pt-BR")} linha(s) processadas · {result.atualizados.toLocaleString("pt-BR")} orçamento(s) encontrados e atualizados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
