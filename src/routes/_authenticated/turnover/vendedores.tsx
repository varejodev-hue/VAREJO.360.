import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { TurnoverFiltersBar, useTurnoverFilters } from "@/lib/turnover-filters";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/_authenticated/turnover/vendedores")({
  component: VendedoresPage,
});

type VendedorRow = {
  vendedor_id: string;
  nome: string;
  ativo: boolean;
  loja_id: string | null;
  loja_nome: string | null;
  ultima_atividade: string | null;
  meses_inativo: number | null;
  carteira_especificadores: number;
  total_orcado: number;
  total_vendido: number;
  conversao_pct: number;
  status:
    | "ativo"
    | "afastamento_temporario"
    | "saida_confirmada"
    | "sem_atividade";
  evento_data: string | null;
};

const STATUS_META: Record<
  VendedorRow["status"],
  { label: string; className: string }
> = {
  ativo: {
    label: "Ativo",
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  },
  afastamento_temporario: {
    label: "Afastamento temporário",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  saida_confirmada: {
    label: "Saída confirmada",
    className: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  },
  sem_atividade: {
    label: "Sem atividade",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);

function VendedoresPage() {
  const { dataInicio, dataFim, lojaId } = useTurnoverFilters();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const { data, isLoading, error } = useQuery({
    queryKey: ["turnover", "vendedores", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "turnover_vendedores_resumo",
        {
          p_inicio: dataInicio,
          p_fim: dataFim,
          p_loja: lojaId,
        },
      );
      if (error) throw error;
      return (data ?? []) as VendedorRow[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data ?? []).filter((v) => {
      if (statusFiltro !== "todos" && v.status !== statusFiltro) return false;
      if (termo && !v.nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [data, busca, statusFiltro]);

  const resumo = useMemo(() => {
    const r = {
      total: 0,
      ativo: 0,
      afastamento_temporario: 0,
      saida_confirmada: 0,
      sem_atividade: 0,
    };
    (data ?? []).forEach((v) => {
      r.total += 1;
      r[v.status] += 1;
    });
    return r;
  }, [data]);

  return (
    <div className="space-y-4">
      <TurnoverFiltersBar />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumoCard label="Vendedores" value={resumo.total} />
        <ResumoCard
          label="Ativos"
          value={resumo.ativo}
          tone="text-emerald-600"
        />
        <ResumoCard
          label="Afastamento temp."
          value={resumo.afastamento_temporario}
          tone="text-amber-600"
        />
        <ResumoCard
          label="Saída confirmada"
          value={resumo.saida_confirmada}
          tone="text-rose-600"
        />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Vendedores</CardTitle>
              <CardDescription>
                Classificação automática usando o parâmetro de meses de pausa.
                Carteira e conversão dentro do período selecionado.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por nome…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-[220px]"
              />
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastamento_temporario">
                    Afastamento temporário
                  </SelectItem>
                  <SelectItem value="saida_confirmada">
                    Saída confirmada
                  </SelectItem>
                  <SelectItem value="sem_atividade">Sem atividade</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!filtrados.length}
                onClick={() =>
                  downloadCSV(
                    `turnover-vendedores-${dataInicio}_a_${dataFim}`,
                    filtrados.map((v) => ({
                      Vendedor: v.nome,
                      Loja: v.loja_nome ?? "",
                      Status: STATUS_META[v.status].label,
                      "Última atividade": v.ultima_atividade ?? "",
                      "Meses inativo": v.meses_inativo ?? "",
                      Carteira: v.carteira_especificadores,
                      Orçado: Number(v.total_orcado).toFixed(2),
                      Vendido: Number(v.total_vendido).toFixed(2),
                      "Conversão %": Number(v.conversao_pct).toFixed(2),
                    })),
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!filtrados.length}
                onClick={() =>
                  downloadPDF(
                    `turnover-vendedores-${dataInicio}_a_${dataFim}`,
                    filtrados.map((v) => ({
                      Vendedor: v.nome,
                      Loja: v.loja_nome ?? "",
                      Status: STATUS_META[v.status].label,
                      "Última ativ.": v.ultima_atividade ?? "",
                      "Meses inat.": v.meses_inativo ?? "",
                      Carteira: v.carteira_especificadores,
                      Orçado: Number(v.total_orcado).toFixed(2),
                      Vendido: Number(v.total_vendido).toFixed(2),
                      "Conv. %": Number(v.conversao_pct).toFixed(1),
                    })),
                    {
                      title: "Turnover · Vendedores",
                      subtitle: `Período: ${dataInicio} a ${dataFim}`,
                    },
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : error ? (
            <div className="text-sm text-destructive py-6">
              Erro ao carregar: {(error as Error).message}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Nenhum vendedor encontrado para os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead className="text-right">Carteira</TableHead>
                    <TableHead className="text-right">Orçado</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((v) => {
                    const meta = STATUS_META[v.status];
                    return (
                      <TableRow key={v.vendedor_id}>
                        <TableCell className="font-medium">{v.nome}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {v.loja_nome ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.className}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {v.ultima_atividade
                            ? new Date(
                                v.ultima_atividade,
                              ).toLocaleDateString("pt-BR")
                            : "—"}
                          {v.meses_inativo != null && v.meses_inativo > 0 ? (
                            <span className="ml-1 text-xs">
                              ({v.meses_inativo}m)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.carteira_especificadores}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtBRL(Number(v.total_orcado))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtBRL(Number(v.total_vendido))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(v.conversao_pct).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResumoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
