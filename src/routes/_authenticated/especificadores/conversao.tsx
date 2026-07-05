import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, TrendingDown, TrendingUp, Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/especificadores/conversao")({
  component: ConversaoPage,
});

type Row = {
  especificador_id: string;
  nome: string;
  loja_nome: string | null;
  vendedor_atual_nome: string | null;
  vendedor_anterior_nome: string | null;
  trocou_vendedor: boolean;
  qtd_orcamentos: number;
  qtd_vendas: number;
  valor_orcado: number;
  valor_vendido: number;
  conversao_valor_pct: number;
  conversao_qtd_pct: number;
  ticket_medio: number;
  ultima_mov_data: string | null;
  ultima_mov_tipo: "orcamento" | "venda" | null;
  ultima_mov_valor: number;
  dias_sem_mov: number | null;
  tempo_medio_orc_venda: number;
  delta_valor_pct: number;
  classificacao: string;
  alerta_baixa_conversao: boolean;
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const CLASSIF_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  alto_potencial: { label: "Alto Potencial", variant: "default" },
  potencial_nao_explorado: { label: "Potencial não explorado", variant: "secondary" },
  baixa_atividade: { label: "Baixa Atividade", variant: "outline" },
  em_risco: { label: "Em Risco", variant: "destructive" },
  inativo: { label: "Inativo", variant: "outline" },
  estavel: { label: "Estável", variant: "secondary" },
};

function ConversaoPage() {
  const { inicioISO, fimISO, lojaId } = useGlobalFilters();
  const [tipoMov, setTipoMov] = useState<"todos" | "orcamento" | "venda" | "conversao">("todos");
  const [classif, setClassif] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [ranking, setRanking] = useState<string>("orcam");

  const { data, isLoading } = useQuery({
    queryKey: ["esp-conversao", inicioISO, fimISO, lojaId, tipoMov],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("especificadores_conversao_analise", {
        p_inicio: inicioISO,
        p_fim: fimISO,
        p_loja: lojaId ?? undefined,
        p_tipo_mov: tipoMov,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = useMemo(() => {
    let r = data ?? [];
    if (classif !== "all") r = r.filter((x) => x.classificacao === classif);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      r = r.filter((x) => (x.nome ?? "").toLowerCase().includes(q) || (x.vendedor_atual_nome ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [data, classif, busca]);

  const kpis = useMemo(() => {
    const r = data ?? [];
    const tot = (k: keyof Row) => r.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const count = (cl: string) => r.filter((x) => x.classificacao === cl).length;
    return {
      total: r.length,
      alto: count("alto_potencial"),
      potencial: count("potencial_nao_explorado"),
      risco: count("em_risco") + count("inativo"),
      orcado: tot("valor_orcado"),
      vendido: tot("valor_vendido"),
      alertas: r.filter((x) => x.alerta_baixa_conversao).length,
    };
  }, [data]);

  const rankings = useMemo(() => {
    const r = (data ?? []).slice();
    const sortBy = (fn: (a: Row, b: Row) => number) => r.slice().sort(fn).slice(0, 10);
    return {
      orcam: sortBy((a, b) => b.valor_orcado - a.valor_orcado),
      vendem: sortBy((a, b) => b.valor_vendido - a.valor_vendido),
      maior_conv: sortBy((a, b) => b.conversao_valor_pct - a.conversao_valor_pct).filter((x) => x.valor_orcado > 0),
      menor_conv: sortBy((a, b) => a.conversao_valor_pct - b.conversao_valor_pct).filter((x) => x.valor_orcado > 50000),
      risco: r.filter((x) => x.classificacao === "em_risco").sort((a, b) => a.delta_valor_pct - b.delta_valor_pct).slice(0, 10),
      recuperados: r.filter((x) => x.delta_valor_pct >= 30).sort((a, b) => b.delta_valor_pct - a.delta_valor_pct).slice(0, 10),
    };
  }, [data]);

  const rankingAtual = rankings[ranking as keyof typeof rankings] ?? [];

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard icon={<Users className="size-4" />} label="Especificadores" value={kpis.total} />
        <KpiCard icon={<TrendingUp className="size-4 text-emerald-500" />} label="Alto Potencial" value={kpis.alto} />
        <KpiCard icon={<AlertTriangle className="size-4 text-amber-500" />} label="Potencial p/ explorar" value={kpis.potencial} />
        <KpiCard icon={<TrendingDown className="size-4 text-rose-500" />} label="Risco/Inativos" value={kpis.risco} />
        <KpiCard label="Valor orçado" value={fmtBRL(kpis.orcado)} small />
        <KpiCard label="Valor vendido" value={fmtBRL(kpis.vendido)} small />
        <KpiCard icon={<AlertTriangle className="size-4 text-rose-500" />} label="Alertas baixa conv." value={kpis.alertas} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            <Tabs value={tipoMov} onValueChange={(v) => setTipoMov(v as typeof tipoMov)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="orcamento">Orçamentos</TabsTrigger>
                <TabsTrigger value="venda">Vendas</TabsTrigger>
                <TabsTrigger value="conversao">Conversões</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={classif} onValueChange={setClassif}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Classificação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as classificações</SelectItem>
                {Object.entries(CLASSIF_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Buscar especificador / vendedor..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[280px]" />
            <Button
              variant="outline"
              className="ml-auto"
              disabled={rows.length === 0}
              onClick={() => {
                const data = rows.map((r: any) => ({
                  especificador: r.nome,
                  loja: r.loja_nome ?? "",
                  vendedor_atual: r.vendedor_atual_nome ?? "",
                  vendedor_anterior: r.vendedor_anterior_nome ?? "",
                  trocou_vendedor: r.trocou_vendedor ? "sim" : "nao",
                  qtd_orcamentos: r.qtd_orcamentos,
                  qtd_vendas: r.qtd_vendas,
                  valor_orcado: r.valor_orcado,
                  valor_vendido: r.valor_vendido,
                  conversao_valor_pct: r.conversao_valor_pct,
                  conversao_qtd_pct: r.conversao_qtd_pct,
                  ticket_medio: r.ticket_medio,
                  ultima_mov_data: r.ultima_mov_data ?? "",
                  dias_sem_mov: r.dias_sem_mov ?? "",
                  tempo_medio_orc_venda: r.tempo_medio_orc_venda,
                  delta_valor_pct: r.delta_valor_pct ?? "",
                  classificacao: r.classificacao,
                }));
                downloadCSV(`conversao-360-${new Date().toISOString().slice(0, 10)}`, data);
              }}
            >
              <Download className="h-4 w-4 mr-2" />Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Especificadores 360° — Conversão</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Vendido</TableHead>
                <TableHead className="text-right">Conv. (R$)</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
                <TableHead className="text-right">Δ vs ant.</TableHead>
                <TableHead>Última mov.</TableHead>
                <TableHead className="text-right">Dias s/ mov.</TableHead>
                <TableHead>Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum especificador no período.</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const cl = CLASSIF_LABEL[r.classificacao] ?? { label: r.classificacao, variant: "outline" as const };
                return (
                  <TableRow key={r.especificador_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.nome}
                        {r.alerta_baixa_conversao && <Badge variant="destructive" className="text-[10px]">baixa conv.</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.loja_nome ?? "—"}</TableCell>
                    <TableCell>
                      {r.vendedor_atual_nome ?? "—"}
                      {r.trocou_vendedor && (
                        <div className="text-[11px] text-muted-foreground">antes: {r.vendedor_anterior_nome}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(r.valor_orcado)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.valor_vendido)}</TableCell>
                    <TableCell className="text-right">{r.conversao_valor_pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.ticket_medio)}</TableCell>
                    <TableCell className={`text-right ${r.delta_valor_pct < 0 ? "text-rose-500" : r.delta_valor_pct > 0 ? "text-emerald-500" : ""}`}>
                      {r.delta_valor_pct > 0 ? "+" : ""}{r.delta_valor_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {r.ultima_mov_data ? (
                        <div>
                          <div className="text-xs">{new Date(r.ultima_mov_data).toLocaleDateString("pt-BR")}</div>
                          <Badge variant="outline" className="text-[10px]">{r.ultima_mov_tipo}</Badge>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.dias_sem_mov ?? "—"}</TableCell>
                    <TableCell><Badge variant={cl.variant}>{cl.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Rankings</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={ranking} onValueChange={setRanking}>
            <TabsList className="mb-3 flex-wrap h-auto">
              <TabsTrigger value="orcam">Mais orçam</TabsTrigger>
              <TabsTrigger value="vendem">Mais compram</TabsTrigger>
              <TabsTrigger value="maior_conv">Maior conversão</TabsTrigger>
              <TabsTrigger value="menor_conv">Menor conversão</TabsTrigger>
              <TabsTrigger value="risco">Maior risco</TabsTrigger>
              <TabsTrigger value="recuperados">Recuperados</TabsTrigger>
            </TabsList>
          </Tabs>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Vendido</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingAtual.map((r, i) => (
                <TableRow key={r.especificador_id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.vendedor_atual_nome ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.valor_orcado)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.valor_vendido)}</TableCell>
                  <TableCell className="text-right">{r.conversao_valor_pct.toFixed(1)}%</TableCell>
                  <TableCell className={`text-right ${r.delta_valor_pct < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                    {r.delta_valor_pct > 0 ? "+" : ""}{r.delta_valor_pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {rankingAtual.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, small }: { icon?: React.ReactNode; label: string; value: string | number; small?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}{label}
        </div>
        <div className={small ? "text-lg font-semibold" : "text-2xl font-bold"}>{value}</div>
      </CardContent>
    </Card>
  );
}
