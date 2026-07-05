import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrcamentoDetalhe } from "@/lib/orcamentos.functions";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

type Search = { loja_id?: string };

export const Route = createFileRoute("/_authenticated/orcamentos/$numero")({
  validateSearch: (s: Record<string, unknown>): Search => ({ loja_id: s.loja_id as string | undefined }),
  component: OrcamentoDetalhe,
});

const fmtBRL = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function OrcamentoDetalhe() {
  const { numero } = Route.useParams();
  const { loja_id } = useSearch({ from: "/_authenticated/orcamentos/$numero" });
  const fetcher = useServerFn(getOrcamentoDetalhe);
  const { data, isLoading } = useQuery({
    queryKey: ["orcamento", numero, loja_id],
    queryFn: () => fetcher({ data: { numero, loja_id } }),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!data?.orcamento) {
    return (
      <div>
        <PageHeader title={`Orçamento ${numero}`} description="Não encontrado." />
        <Link to="/orcamentos/carteira" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar para carteira
        </Link>
      </div>
    );
  }

  const o = data.orcamento as Record<string, unknown> & {
    status: string; valor_orcado: number; valor_vendido: number; data_orcamento: string;
    lojas?: { nome: string } | null; vendedores?: { nome: string } | null;
    especificadores?: { nome: string } | null; clientes?: { nome: string } | null;
    observacao: string | null; numero_pedido: string | null;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Orçamento ${numero}`}
        description={`${o.lojas?.nome ?? "—"} · ${fmtDate(o.data_orcamento)}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPI label="Status" value={<Badge variant="secondary">{o.status}</Badge>} />
        <KPI label="Valor orçado" value={fmtBRL(o.valor_orcado)} />
        <KPI label="Valor vendido" value={fmtBRL(o.valor_vendido)} />
        <KPI label="Pedido" value={o.numero_pedido || "—"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InfoCard title="Vendedor" value={o.vendedores?.nome ?? "—"} />
        <InfoCard title="Especificador" value={o.especificadores?.nome ?? "—"} />
        <InfoCard title="Cliente" value={o.clientes?.nome ?? "—"} />
      </div>

      {o.observacao && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">{o.observacao}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Histórico de versões ({data.versoes.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.versoes.length === 0 && <p className="text-sm text-muted-foreground">Sem versões registradas.</p>}
          {data.versoes.map((v) => {
            const vv = v as unknown as {
              id: string; created_at: string; arquivo: string | null;
              status_anterior: string | null; status_novo: string | null;
              valor_anterior: number | null; valor_novo: number | null;
              campos_alterados: Array<{ campo: string; antes: unknown; depois: unknown }>;
              observacao: string | null;
            };
            return (
              <div key={vv.id} className="border-l-2 border-primary/40 pl-3">
                <div className="text-xs text-muted-foreground">{fmtDate(vv.created_at)} · {vv.arquivo ?? "—"}</div>
                <div className="text-sm">
                  {vv.status_anterior ? (
                    <>Status: <span className="font-mono">{vv.status_anterior}</span> → <span className="font-mono font-semibold">{vv.status_novo}</span></>
                  ) : (
                    <>Criado com status <span className="font-mono font-semibold">{vv.status_novo}</span></>
                  )}
                </div>
                {vv.valor_anterior !== vv.valor_novo && (
                  <div className="text-xs text-muted-foreground">
                    Valor: {fmtBRL(vv.valor_anterior)} → <span className="font-semibold">{fmtBRL(vv.valor_novo)}</span>
                  </div>
                )}
                {Array.isArray(vv.campos_alterados) && vv.campos_alterados.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Campos: {vv.campos_alterados.map((c) => c.campo).join(", ")}
                  </div>
                )}
                {vv.observacao && (
                  <div className="text-xs mt-1 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" /> {vv.observacao}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Follow-ups ({data.tasks.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum follow-up.</p>}
          {data.tasks.map((t) => {
            const tt = t as { id: string; titulo: string; status: string; due_at: string; descricao: string | null };
            return (
              <div key={tt.id} className="flex items-start justify-between border rounded-md p-2">
                <div>
                  <div className="text-sm font-medium">{tt.titulo}</div>
                  {tt.descricao && <div className="text-xs text-muted-foreground">{tt.descricao}</div>}
                </div>
                <div className="text-right">
                  <Badge variant={tt.status === "pendente" ? "default" : "secondary"}>{tt.status}</Badge>
                  <div className="text-[11px] text-muted-foreground mt-1">{fmtDate(tt.due_at)}</div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-1">{value}</div>
    </CardContent></Card>
  );
}
function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-sm mt-1">{value}</div>
    </CardContent></Card>
  );
}
