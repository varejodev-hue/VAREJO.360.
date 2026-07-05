import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useGlobalFilters } from "@/lib/global-filters";
import { cn } from "@/lib/utils";
import { CheckCircle2, Download, FileSpreadsheet, FileText, Plus, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/plano-acao")({
  component: PlanoAcao,
});

type Loja = { id: string; nome: string };
type Plano = {
  id: string;
  loja_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_perfil: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  prazo: string | null;
  status: "aberto" | "em_execucao" | "concluido" | "cancelado";
  evidencia: string | null;
  created_at: string;
  lojas?: { nome: string } | null;
};

const empty = {
  titulo: "",
  descricao: "",
  responsavel_perfil: "gerente_loja",
  prioridade: "media",
  prazo: "",
};

function PlanoAcao() {
  const qc = useQueryClient();
  const { lojaId } = useGlobalFilters();
  const [draft, setDraft] = useState(empty);
  const [status, setStatus] = useState("ativos");

  const { data, isLoading } = useQuery({
    queryKey: ["planos-acao", lojaId, status],
    queryFn: async () => {
      const db = supabase as any;
      const [lojas, planos] = await Promise.all([
        db.from("lojas").select("id,nome").eq("ativo", true).order("nome"),
        (() => {
          let q = db.from("sgp_planos_acao").select("*,lojas(nome)").order("prazo", { ascending: true }).order("created_at", { ascending: false });
          if (lojaId) q = q.eq("loja_id", lojaId);
          if (status === "ativos") q = q.in("status", ["aberto", "em_execucao"]);
          else if (status !== "todos") q = q.eq("status", status);
          return q;
        })(),
      ]);
      if (lojas.error) throw lojas.error;
      if (planos.error) throw planos.error;
      return { lojas: (lojas.data ?? []) as Loja[], planos: (planos.data ?? []) as Plano[] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.titulo.trim()) throw new Error("Informe o titulo");
      const db = supabase as any;
      const { error } = await db.from("sgp_planos_acao").insert({
        loja_id: lojaId,
        origem: "manual",
        titulo: draft.titulo,
        descricao: draft.descricao,
        responsavel_perfil: draft.responsavel_perfil,
        prioridade: draft.prioridade,
        prazo: draft.prazo || null,
      });
      if (error) throw error;
      await db.from("sgp_auditoria").insert({
        loja_id: lojaId,
        entidade: "sgp_planos_acao",
        acao: "criar_plano",
        depois: draft,
      });
    },
    onSuccess: () => {
      toast.success("Plano de acao criado");
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["planos-acao"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar plano"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Plano> }) => {
      const db = supabase as any;
      const { error } = await db.from("sgp_planos_acao").update(patch).eq("id", id);
      if (error) throw error;
      await db.from("sgp_auditoria").insert({
        entidade: "sgp_planos_acao",
        entidade_id: id,
        acao: "atualizar_plano",
        depois: patch,
      });
    },
    onSuccess: () => {
      toast.success("Plano atualizado");
      qc.invalidateQueries({ queryKey: ["planos-acao"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const rows = data?.planos ?? [];
  const resumo = useMemo(() => ({
    abertos: rows.filter((r) => r.status === "aberto").length,
    execucao: rows.filter((r) => r.status === "em_execucao").length,
    concluidos: rows.filter((r) => r.status === "concluido").length,
    criticos: rows.filter((r) => r.prioridade === "critica").length,
  }), [rows]);

  const exportRows = rows.map((r) => ({
    Loja: r.lojas?.nome ?? "-",
    Titulo: r.titulo,
    Responsavel: r.responsavel_perfil ?? "-",
    Prioridade: r.prioridade,
    Prazo: r.prazo ?? "-",
    Status: r.status,
    Evidencia: r.evidencia ?? "",
  }));
  const filename = "planos-acao-sgp";

  return (
    <div>
      <PageHeader
        title="Plano de Acao"
        description="Transforma gaps da Saude da Loja em responsavel, prazo, status e evidencia."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCSV(filename, exportRows)}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportExcel(filename, exportRows)}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadPDF(filename, exportRows, {
              title: "Plano de Acao SGP",
              headers: ["Loja", "Titulo", "Responsavel", "Prioridade", "Prazo", "Status"],
            })}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Mini label="Abertos" value={resumo.abertos} tone={resumo.abertos ? "attention" : "healthy"} />
        <Mini label="Em execucao" value={resumo.execucao} />
        <Mini label="Concluidos" value={resumo.concluidos} tone="healthy" />
        <Mini label="Criticos" value={resumo.criticos} tone={resumo.criticos ? "critical" : "healthy"} />
      </div>

      <Card className="mb-5">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-[1fr_160px_160px_140px_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Novo plano</Label>
            <Input placeholder="Ex.: Reduzir follow-ups vencidos da loja" value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} />
          </div>
          <Select value={draft.responsavel_perfil} onValueChange={(v) => setDraft({ ...draft, responsavel_perfil: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gerente_loja">Gerente</SelectItem>
              <SelectItem value="assistente_venda">Assistente</SelectItem>
              <SelectItem value="vendedor">Vendedor</SelectItem>
              <SelectItem value="projetista">Projetista</SelectItem>
            </SelectContent>
          </Select>
          <Select value={draft.prioridade} onValueChange={(v) => setDraft({ ...draft, prioridade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="critica">Critica</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={draft.prazo} onChange={(e) => setDraft({ ...draft, prazo: e.target.value })} />
          <Button onClick={() => create.mutate()} disabled={create.isPending}><Plus className="h-4 w-4" /> Criar</Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4 max-w-xs">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="aberto">Abertos</SelectItem>
              <SelectItem value="em_execucao">Em execucao</SelectItem>
              <SelectItem value="concluido">Concluidos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Plano", "Loja", "Responsavel", "Prioridade", "Prazo", "Status", "Evidencia", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando planos...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum plano encontrado.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <div className="font-medium">{r.titulo}</div>
                    <div className="text-xs text-muted-foreground">{r.descricao ?? "Sem descricao"}</div>
                  </td>
                  <td className="p-3">{r.lojas?.nome ?? "-"}</td>
                  <td className="p-3">{r.responsavel_perfil ?? "-"}</td>
                  <td className="p-3"><Priority value={r.prioridade} /></td>
                  <td className="p-3">{r.prazo ? fmtDate(r.prazo) : "-"}</td>
                  <td className="p-3">
                    <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, patch: { status: v as Plano["status"] } })}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_execucao">Em execucao</SelectItem>
                        <SelectItem value="concluido">Concluido</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 min-w-[220px]">
                    <Input defaultValue={r.evidencia ?? ""} placeholder="link, observacao ou evidencia" onBlur={(e) => update.mutate({ id: r.id, patch: { evidencia: e.target.value } })} />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: r.id, patch: { status: "concluido" } })}>
                      <CheckCircle2 className="h-4 w-4" />
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

function Priority({ value }: { value: Plano["prioridade"] }) {
  return <Badge variant="outline" className={cn(value === "critica" && "text-[var(--status-critical)]", value === "alta" && "text-[var(--status-attention)]")}>{value}</Badge>;
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "healthy" | "attention" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone === "healthy" && "text-[var(--status-healthy)]", tone === "attention" && "text-[var(--status-attention)]", tone === "critical" && "text-[var(--status-critical)]")}>{value}</div>
    </CardContent></Card>
  );
}

function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Plano de Acao");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}
