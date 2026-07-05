import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowLeftRight, TrendingUp, TrendingDown, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export { RastreabilidadePage };

type Status = "mantido" | "migrado" | "compartilhado" | "perdido" | "recuperado" | "novo";
const statusMeta: Record<Status, { label: string; cls: string }> = {
  mantido: { label: "Mantido", cls: "bg-green-100 text-green-800" },
  migrado: { label: "Migrado", cls: "bg-red-100 text-red-800" },
  compartilhado: { label: "Compartilhado", cls: "bg-amber-100 text-amber-800" },
  perdido: { label: "Perdido", cls: "bg-gray-200 text-gray-800" },
  recuperado: { label: "Recuperado", cls: "bg-purple-100 text-purple-800" },
  novo: { label: "Novo", cls: "bg-blue-100 text-blue-800" },
};
function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

type Row = {
  id: string; nome: string;
  lojaOrigem: string; lojaAtual: string;
  valorBase: number; valorComp: number;
  impacto: number;
  status: Status;
};

function RastreabilidadePage() {
  const now = new Date().getFullYear();
  const [anoBase, setAnoBase] = useState<number>(now - 1);
  const [anoComp, setAnoComp] = useState<number>(now);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["rastreabilidade", anoBase, anoComp],
    queryFn: async () => {
      const PAGE = 1000;
      const all: Array<Record<string, unknown>> = [];
      for (let from = 0; ; from += PAGE) {
        const { data: chunk, error } = await supabase
          .rpc("rastreabilidade_especificadores", { _ano_base: anoBase, _ano_comp: anoComp })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const arr = (chunk ?? []) as Array<Record<string, unknown>>;
        all.push(...arr);
        if (arr.length < PAGE) break;
      }
      const rows: Row[] = all.map((raw) => {
        const r = raw as {
          especificador_id: string; nome: string;
          loja_origem: string; loja_atual: string;
          valor_base: number | string; valor_comp: number | string; valor_antes: number | string;
          lojas_base_count: number; lojas_comp_count: number;
          origem_in_comp: boolean; atual_in_base: boolean;
        };
        const vBase = Number(r.valor_base) || 0;
        const vComp = Number(r.valor_comp) || 0;
        const vAntes = Number(r.valor_antes) || 0;
        const origem = r.loja_origem ?? "—";
        const atual = r.loja_atual ?? "—";
        let status: Status;
        if (vBase === 0 && vComp === 0) status = "perdido";
        else if (vBase === 0 && vComp > 0) status = vAntes > 0 ? "recuperado" : "novo";
        else if (vBase > 0 && vComp === 0) status = "perdido";
        else if (origem === atual) status = "mantido";
        else if (r.lojas_comp_count > 1 && !r.atual_in_base && r.origem_in_comp) status = "compartilhado";
        else status = "migrado";
        const impacto = status === "migrado" ? vComp : status === "perdido" ? -vBase : vComp - vBase;
        return { id: r.especificador_id, nome: r.nome, lojaOrigem: origem, lojaAtual: atual, valorBase: vBase, valorComp: vComp, impacto, status };
      });
      return rows;
    },
  });

  const totals = useMemo(() => {
    const rows = data ?? [];
    const transf = rows.filter((r) => r.status === "migrado").reduce((s, r) => s + r.valorComp, 0);
    const perdido = rows.filter((r) => r.status === "perdido").reduce((s, r) => s + r.valorBase, 0);
    const recuperado = rows.filter((r) => r.status === "recuperado").reduce((s, r) => s + r.valorComp, 0);
    const counts: Record<Status, number> = { mantido: 0, migrado: 0, compartilhado: 0, perdido: 0, recuperado: 0, novo: 0 };
    rows.forEach((r) => counts[r.status]++);
    return { transf, perdido, recuperado, counts };
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (filtro !== "todos") rows = rows.filter((r) => r.status === filtro);
    if (busca) {
      const t = busca.toLowerCase();
      rows = rows.filter((r) => r.nome.toLowerCase().includes(t) || r.lojaOrigem.toLowerCase().includes(t) || r.lojaAtual.toLowerCase().includes(t));
    }
    return rows.sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto));
  }, [data, busca, filtro]);

  const anos = Array.from({ length: 5 }, (_, i) => now - 4 + i);

  return (
    <div>
      <PageHeader
        title="Rastreabilidade Comercial"
        description="Movimentação de especificadores entre lojas — Índice de Transferência de Relacionamento."
        action={
          <div className="flex items-center gap-2 text-sm">
            <Select value={String(anoBase)} onValueChange={(v) => setAnoBase(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <Select value={String(anoComp)} onValueChange={(v) => setAnoComp(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              disabled={isLoading || !filtered.length}
              onClick={() => exportarPDF({ rows: filtered, totals, anoBase, anoComp, filtro })}
            >
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Índice de Transferência</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{fmtMoney(totals.transf)}</div>
              <div className="text-xs text-muted-foreground mt-1">valor migrado entre lojas em {anoComp}</div>
            </div>
            <div className="h-10 w-10 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center"><ArrowLeftRight className="h-5 w-5" /></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Recuperado</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums text-green-700">{fmtMoney(totals.recuperado)}</div>
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Perdido</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums text-red-700">{fmtMoney(totals.perdido)}</div>
            </div>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {(Object.keys(statusMeta) as Status[]).map((s) => {
          const active = filtro === s;
          return (
            <Card key={s} onClick={() => setFiltro(active ? "todos" : s)}
              className={`p-3 cursor-pointer ${active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{statusMeta[s].label}</div>
              <div className="text-xl font-semibold">{totals.counts[s]}</div>
            </Card>
          );
        })}
      </div>

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar especificador ou loja..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(statusMeta) as Status[]).map((s) => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Especificador",`Loja Origem (${anoBase})`,`Loja Atual (${anoComp})`,`Valor ${anoBase}`,`Valor ${anoComp}`,"Impacto","Status"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem movimentação no período comparado.</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-medium">{r.nome}</td>
                  <td className="p-3">{r.lojaOrigem}</td>
                  <td className="p-3">
                    <span className={r.lojaOrigem !== r.lojaAtual && r.lojaAtual !== "—" ? "text-amber-700 font-medium" : ""}>{r.lojaAtual}</span>
                  </td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.valorBase)}</td>
                  <td className="p-3 tabular-nums">{fmtMoney(r.valorComp)}</td>
                  <td className={`p-3 tabular-nums font-medium ${r.impacto > 0 ? "text-green-700" : r.impacto < 0 ? "text-red-700" : ""}`}>
                    {r.impacto > 0 ? "+" : ""}{fmtMoney(r.impacto)}
                  </td>
                  <td className="p-3"><Badge className={statusMeta[r.status].cls}>{statusMeta[r.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type Totals = { transf: number; perdido: number; recuperado: number; counts: Record<Status, number> };

function exportarPDF({ rows, totals, anoBase, anoComp, filtro }: { rows: Row[]; totals: Totals; anoBase: number; anoComp: number; filtro: string }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dataStr = now.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Rastreabilidade Comercial", 40, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Movimentação de especificadores entre lojas — ${anoBase} vs ${anoComp}`, 40, 48);
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 220);
  doc.text(`Gerado em ${dataStr}`, pageW - 40, 30, { align: "right" });
  if (filtro !== "todos") doc.text(`Filtro: ${filtro}`, pageW - 40, 48, { align: "right" });

  doc.setTextColor(15, 23, 42);
  const kpis = [
    { label: "Índice de Transferência", value: fmtMoney(totals.transf), color: [251, 191, 36] as [number, number, number] },
    { label: "Recuperado", value: fmtMoney(totals.recuperado), color: [34, 197, 94] as [number, number, number] },
    { label: "Perdido", value: fmtMoney(totals.perdido), color: [239, 68, 68] as [number, number, number] },
  ];
  const cardW = (pageW - 80 - 24) / 3;
  kpis.forEach((k, i) => {
    const x = 40 + i * (cardW + 12);
    const y = 84;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardW, 56, 6, 6, "FD");
    doc.setFillColor(...k.color);
    doc.rect(x, y, 4, 56, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label.toUpperCase(), x + 14, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(k.value, x + 14, y + 40);
  });

  const statusLine = (Object.keys(statusMeta) as Status[])
    .map((s) => `${statusMeta[s].label}: ${totals.counts[s]}`)
    .join("   •   ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(statusLine, 40, 160);

  autoTable(doc, {
    startY: 175,
    head: [["Especificador", `Loja Origem (${anoBase})`, `Loja Atual (${anoComp})`, `Valor ${anoBase}`, `Valor ${anoComp}`, "Impacto", "Status"]],
    body: rows.map((r) => [
      r.nome,
      r.lojaOrigem,
      r.lojaAtual,
      fmtMoney(r.valorBase),
      fmtMoney(r.valorComp),
      `${r.impacto > 0 ? "+" : ""}${fmtMoney(r.impacto)}`,
      statusMeta[r.status].label,
    ]),
    styles: { fontSize: 8, cellPadding: 5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const r = rows[data.row.index];
      if (data.column.index === 5) {
        if (r.impacto > 0) data.cell.styles.textColor = [21, 128, 61];
        else if (r.impacto < 0) data.cell.styles.textColor = [185, 28, 28];
      }
      if (data.column.index === 6) {
        const palette: Record<Status, [number, number, number]> = {
          mantido: [220, 252, 231], migrado: [254, 226, 226], compartilhado: [254, 243, 199],
          perdido: [226, 232, 240], recuperado: [243, 232, 255], novo: [219, 234, 254],
        };
        data.cell.styles.fillColor = palette[r.status];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      }
    },
    didDrawPage: () => {
      const pageStr = `Página ${doc.getCurrentPageInfo().pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(pageStr, pageW - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      doc.text("Varejo 360 — Rastreabilidade Comercial", 40, doc.internal.pageSize.getHeight() - 20);
    },
  });

  doc.save(`rastreabilidade-${anoBase}-vs-${anoComp}.pdf`);
}
