import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useGlobalFilters } from "@/lib/global-filters";
import { fmtBRL, fmtDate, fmtInt } from "@/lib/carteira-utils";
import { DistribuirDialog } from "@/components/carteira/dialogs";
import { downloadCSV } from "@/lib/csv-export";
import { Users, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/sem-responsavel")({
  component: SemResponsavel,
});

type Row = {
  id: string; nome: string; cidade: string | null; uf: string | null;
  loja_id: string | null; loja_nome: string | null;
  ultimo_orcamento: string | null; ultima_venda: string | null;
  valor_potencial: number; dias_sem_contato: number | null; qtd_orcamentos: number;
};

function SemResponsavel() {
  const { lojaId } = useGlobalFilters();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["carteira", "sem-resp", lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("carteira_sem_responsavel", { p_loja: lojaId });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));

  function exportCsv() {
    downloadCSV("sem-responsavel", rows.map((r) => ({
      Especificador: r.nome, Cidade: r.cidade ?? "", UF: r.uf ?? "",
      Loja: r.loja_nome ?? "", "Último orçamento": fmtDate(r.ultimo_orcamento),
      "Dias sem contato": r.dias_sem_contato ?? "", "Valor potencial": r.valor_potencial,
    })));
  }

  return (
    <div className="space-y-3 px-1">
      <Card className="p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm">
          <strong>{fmtInt(rows.length)}</strong> especificadores sem responsável.
          {sel.size > 0 && <span className="ml-2 text-muted-foreground">{sel.size} selecionado(s).</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
          <Button size="sm" disabled={sel.size === 0} onClick={() => setOpen(true)}>
            <Users className="h-4 w-4" />Atribuir vendedor
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 w-8"><Checkbox checked={rows.length > 0 && sel.size === rows.length} onCheckedChange={toggleAll} /></th>
                {["Especificador","Loja","Cidade/UF","Último orçamento","Dias s/ contato","Orçamentos","Valor potencial"].map((h) => (
                  <th key={h} className="text-left p-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum especificador sem responsável.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2"><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                  <td className="p-2 font-medium">{r.nome}</td>
                  <td className="p-2">{r.loja_nome ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.cidade ?? "—"}{r.uf ? `/${r.uf}` : ""}</td>
                  <td className="p-2">{fmtDate(r.ultimo_orcamento)}</td>
                  <td className="p-2 tabular-nums">{r.dias_sem_contato ?? "—"}</td>
                  <td className="p-2 tabular-nums">{r.qtd_orcamentos}</td>
                  <td className="p-2 tabular-nums font-medium">{fmtBRL(r.valor_potencial)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DistribuirDialog open={open} onOpenChange={setOpen} espIds={[...sel]} onDone={() => setSel(new Set())} />
    </div>
  );
}
