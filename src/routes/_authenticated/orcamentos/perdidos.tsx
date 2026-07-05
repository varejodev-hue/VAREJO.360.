import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, XCircle, AlertTriangle } from "lucide-react";
import { useGlobalFilters } from "@/lib/global-filters";
import { EmptyState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/orcamentos/perdidos")({
  component: Perdidos,
});

type Row = {
  id: string; numero: string; data_orcamento: string;
  valor_orcado: number; observacao: string | null;
  lojas: { nome: string } | null;
  vendedores: { nome: string } | null;
  especificadores: { nome: string } | null;
  clientes: { nome: string } | null;
};

function fmtMoney(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtDate(s: string) { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; }

function inferMotivo(obs: string | null): string {
  if (!obs) return "Sem motivo informado";
  const o = obs.toLowerCase();
  if (o.includes("preço") || o.includes("preco") || o.includes("valor")) return "Preço";
  if (o.includes("prazo")) return "Prazo";
  if (o.includes("concorr")) return "Concorrência";
  if (o.includes("estoque") || o.includes("indispon")) return "Sem estoque";
  if (o.includes("desist")) return "Desistência do cliente";
  if (o.includes("projeto") || o.includes("obra")) return "Projeto cancelado";
  return "Outros";
}

function Perdidos() {
  const { periodo, inicioISO, lojaId } = useGlobalFilters();
  const [busca, setBusca] = useState("");
  const [motivo, setMotivo] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["perdidos", inicioISO, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamentos")
        .select("id,numero,data_orcamento,valor_orcado,observacao,lojas(nome),vendedores(nome),especificadores(nome),clientes(nome)")
        .eq("status", "perdido" as never)
        .gte("data_orcamento", inicioISO)
        .order("data_orcamento", { ascending: false });
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const enriched = useMemo(() => (data ?? []).map((r) => ({ ...r, motivo: inferMotivo(r.observacao) })), [data]);

  const motivos = useMemo(() => {
    const m = new Map<string, { qtd: number; valor: number }>();
    enriched.forEach((r) => {
      const cur = m.get(r.motivo) ?? { qtd: 0, valor: 0 };
      cur.qtd++; cur.valor += Number(r.valor_orcado);
      m.set(r.motivo, cur);
    });
    return [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor);
  }, [enriched]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (motivo) r = r.filter((x) => x.motivo === motivo);
    if (busca) {
      const t = busca.toLowerCase();
      r = r.filter((x) =>
        x.numero?.toLowerCase().includes(t) ||
        x.clientes?.nome.toLowerCase().includes(t) ||
        x.especificadores?.nome.toLowerCase().includes(t) ||
        x.vendedores?.nome.toLowerCase().includes(t),
      );
    }
    return r;
  }, [enriched, motivo, busca]);

  const total = useMemo(() => filtered.reduce((s, r) => s + Number(r.valor_orcado), 0), [filtered]);

  return (
    <div>
      <PageHeader
        title="Orçamentos Perdidos"
        description={`${filtered.length} perdidos · ${fmtMoney(total)} em oportunidades nos últimos ${periodo} dias`}
      />

      {motivos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {motivos.slice(0, 6).map((m) => {
            const active = motivo === m.nome;
            return (
              <button key={m.nome} onClick={() => setMotivo(active ? null : m.nome)} className="text-left">
                <Card className={`transition ${active ? "ring-2 ring-primary border-primary" : "hover:border-primary/40"}`}>
                  <CardContent className="p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{m.nome}</div>
                    <div className="text-lg font-semibold tabular-nums">{m.qtd}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtMoney(m.valor)}</div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por número, cliente, especificador, vendedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Número", "Data", "Cliente", "Especificador", "Vendedor", "Loja", "Valor", "Motivo"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState icon={XCircle} title="Sem orçamentos perdidos" description="Nenhum orçamento perdido encontrado para os filtros atuais." />
                </td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-medium">{r.numero}</td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(r.data_orcamento)}</td>
                  <td className="p-3">{r.clientes?.nome ?? "—"}</td>
                  <td className="p-3">{r.especificadores?.nome ?? "—"}</td>
                  <td className="p-3">{r.vendedores?.nome ?? "—"}</td>
                  <td className="p-3">{r.lojas?.nome ?? "—"}</td>
                  <td className="p-3 tabular-nums">{fmtMoney(Number(r.valor_orcado))}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> {r.motivo}
                    </Badge>
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
