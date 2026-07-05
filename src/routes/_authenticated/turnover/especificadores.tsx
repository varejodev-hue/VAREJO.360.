import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Download,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Target,
  Info,
} from "lucide-react";
import {
  TurnoverFiltersBar,
  useTurnoverFilters,
} from "@/lib/turnover-filters";
import { downloadCSV } from "@/lib/csv-export";
import { downloadPDF } from "@/lib/pdf-export";

export const Route = createFileRoute(
  "/_authenticated/turnover/especificadores",
)({
  component: EspecificadoresPage,
});

type Row = {
  especificador_id: string;
  especificador_nome: string;
  loja_origem_id: string | null;
  loja_origem_nome: string | null;
  loja_origem_canal: string | null;
  loja_atual_id: string | null;
  loja_atual_nome: string | null;
  loja_atual_canal: string | null;
  vendedor_origem_id: string | null;
  vendedor_origem_nome: string | null;
  vendedor_atual_id: string | null;
  vendedor_atual_nome: string | null;
  valor_antes: number;
  valor_depois: number;
  delta_pct: number;
  migrou: boolean;
  trocou_vendedor: boolean;
  mudou_canal: boolean;
};

const normalizaCanal = (c: string | null | undefined) => {
  if (c === "nao_classificado") return "loja_propria";
  return c;
};

const canalLabel = (c: string | null | undefined) =>
  normalizaCanal(c) === "loja_propria"
    ? "Própria"
    : normalizaCanal(c) === "franquia"
      ? "Franquia"
      : "—";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

const fmtBRLCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return `${n < 0 ? "-" : ""}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}R$ ${(abs / 1_000).toFixed(1)}k`;
  return fmtBRL(n);
};

const deltaRs = (r: Row) => Number(r.valor_depois) - Number(r.valor_antes);

type AcaoTipo = "recuperar" | "acompanhar" | "manter" | "investigar";
const acaoRecomendada = (r: Row): AcaoTipo => {
  const delta = Number(r.delta_pct);
  if (r.migrou || r.mudou_canal) return "recuperar";
  if (delta <= -30) return "recuperar";
  if (r.trocou_vendedor) return "investigar";
  if (delta < 0) return "acompanhar";
  return "manter";
};

const ACAO_META: Record<AcaoTipo, { label: string; className: string }> = {
  recuperar: {
    label: "Recuperar",
    className: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400",
  },
  investigar: {
    label: "Investigar",
    className:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  },
  acompanhar: {
    label: "Acompanhar",
    className:
      "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400",
  },
  manter: {
    label: "Manter",
    className:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  },
};

type DrawerState =
  | { kind: "loja"; key: string; label: string }
  | { kind: "canal"; key: string; label: string }
  | { kind: "especificador"; row: Row }
  | null;

function EspecificadoresPage() {
  const { dataInicio, dataFim, lojaId } = useTurnoverFilters();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todos");
  const [ordenar, setOrdenar] = useState<"delta" | "valor" | "nome">("delta");
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["turnover", "especificadores", dataInicio, dataFim, lojaId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "turnover_especificadores_migracao",
        { p_inicio: dataInicio, p_fim: dataFim, p_loja: lojaId },
      );
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const arr = (data ?? []).filter((r) => {
      const d = deltaRs(r);
      const canalOrigem = normalizaCanal(r.loja_origem_canal);
      const canalAtual = normalizaCanal(r.loja_atual_canal);
      if (filtro === "perdas" && d >= 0) return false;
      if (filtro === "ganhos" && d <= 0) return false;
      if (filtro === "migraram" && !r.migrou) return false;
      if (filtro === "trocaram_vendedor" && !r.trocou_vendedor) return false;
      if (
        filtro === "franquia_para_propria" &&
        !(canalOrigem === "franquia" && canalAtual === "loja_propria")
      )
        return false;
      if (
        filtro === "propria_para_franquia" &&
        !(canalOrigem === "loja_propria" && canalAtual === "franquia")
      )
        return false;
      if (termo && !r.especificador_nome?.toLowerCase().includes(termo))
        return false;
      return true;
    });

    arr.sort((a, b) => {
      if (ordenar === "valor")
        return (
          Math.max(Number(b.valor_antes), Number(b.valor_depois)) -
          Math.max(Number(a.valor_antes), Number(a.valor_depois))
        );
      if (ordenar === "nome")
        return (a.especificador_nome || "").localeCompare(
          b.especificador_nome || "",
        );
      const da = deltaRs(a);
      const db = deltaRs(b);
      // top_perdas: mais negativo primeiro; top_ganhos: mais positivo primeiro
      if (filtro === "top_perdas") return da - db;
      if (filtro === "top_ganhos") return db - da;
      return Math.abs(db) - Math.abs(da);
    });
    return arr;
  }, [data, busca, filtro, ordenar]);

  // ===== Insights =====
  const insights = useMemo(() => {
    const arr = data ?? [];
    const comDelta = arr.map((r) => ({
      r,
      deltaRs: deltaRs(r),
      deltaPct: Number(r.delta_pct),
    }));
    const perdas = [...comDelta]
      .filter((x) => x.deltaRs < 0)
      .sort((a, b) => a.deltaRs - b.deltaRs);
    const ganhos = [...comDelta]
      .filter((x) => x.deltaRs > 0)
      .sort((a, b) => b.deltaRs - a.deltaRs);
    const criticos = arr.filter(
      (r) => r.migrou || r.mudou_canal || Number(r.delta_pct) <= -30,
    );
    const oportunidades = arr.filter(
      (r) => Number(r.delta_pct) >= 30 && !r.migrou,
    );

    const somaPerdas = perdas.reduce((s, x) => s + x.deltaRs, 0);
    const somaGanhos = ganhos.reduce((s, x) => s + x.deltaRs, 0);

    return {
      maiorPerda: perdas[0],
      maiorGanho: ganhos[0],
      somaPerdas,
      somaGanhos,
      qtdPerdas: perdas.length,
      qtdGanhos: ganhos.length,
      criticosQtd: criticos.length,
      oportunidadesQtd: oportunidades.length,
      saldo: somaGanhos + somaPerdas,
    };
  }, [data]);

  type Agg = {
    key: string;
    label: string;
    antes: number;
    depois: number;
    qtd: number;
  };
  const resumoPorLoja = useMemo(() => {
    const map = new Map<string, Agg>();
    (data ?? []).forEach((x) => {
      const ko = x.loja_origem_id ?? "—";
      const lo = x.loja_origem_nome ?? "—";
      if (!map.has(ko))
        map.set(ko, { key: ko, label: lo, antes: 0, depois: 0, qtd: 0 });
      map.get(ko)!.antes += Number(x.valor_antes) || 0;
      const kd = x.loja_atual_id ?? "—";
      const ld = x.loja_atual_nome ?? "—";
      if (!map.has(kd))
        map.set(kd, { key: kd, label: ld, antes: 0, depois: 0, qtd: 0 });
      map.get(kd)!.depois += Number(x.valor_depois) || 0;
      map.get(kd)!.qtd += 1;
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, delta: r.depois - r.antes }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [data]);

  const resumoPorCanal = useMemo(() => {
    const map = new Map<string, Agg>();
    const ensure = (k: string, label: string) => {
      if (!map.has(k))
        map.set(k, { key: k, label, antes: 0, depois: 0, qtd: 0 });
      return map.get(k)!;
    };
    (data ?? []).forEach((x) => {
      const co = normalizaCanal(x.loja_origem_canal) ?? "—";
      const cd = normalizaCanal(x.loja_atual_canal) ?? "—";
      ensure(co, canalLabel(x.loja_origem_canal)).antes +=
        Number(x.valor_antes) || 0;
      const d = ensure(cd, canalLabel(x.loja_atual_canal));
      d.depois += Number(x.valor_depois) || 0;
      d.qtd += 1;
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      delta: r.depois - r.antes,
    }));
  }, [data]);

  // ===== Diagnósticos automáticos =====
  const diagnosticos = useMemo(() => {
    const arr = data ?? [];
    const frases: { tom: "rose" | "emerald" | "amber" | "sky"; texto: string }[] = [];

    // Maiores perdas/ganhos por loja
    const lojasPerda = resumoPorLoja.filter((l) => l.delta < 0).slice(0, 2);
    const lojasGanho = [...resumoPorLoja]
      .filter((l) => l.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2);

    lojasPerda.forEach((l) => {
      const migrados = arr.filter((r) => r.loja_origem_id === l.key && r.migrou);
      const destinosPropria = migrados.filter(
        (r) => normalizaCanal(r.loja_atual_canal) === "loja_propria",
      ).length;
      const destinosFranquia = migrados.filter(
        (r) => normalizaCanal(r.loja_atual_canal) === "franquia",
      ).length;
      let dest = "outras lojas";
      if (destinosPropria > destinosFranquia) dest = "lojas próprias";
      else if (destinosFranquia > destinosPropria) dest = "franquias";
      frases.push({
        tom: "rose",
        texto: `${l.label} perdeu ${fmtBRLCompact(Math.abs(l.delta))} para ${dest} em ${migrados.length} especificadores.`,
      });
    });

    lojasGanho.forEach((l) => {
      const recebidos = arr.filter((r) => r.loja_atual_id === l.key && r.migrou);
      const origensPropria = recebidos.filter(
        (r) => normalizaCanal(r.loja_origem_canal) === "loja_propria",
      ).length;
      const origensFranquia = recebidos.filter(
        (r) => normalizaCanal(r.loja_origem_canal) === "franquia",
      ).length;
      let orig = "outras lojas";
      if (origensPropria > origensFranquia) orig = "lojas próprias";
      else if (origensFranquia > origensPropria) orig = "franquias";
      frases.push({
        tom: "emerald",
        texto: `${l.label} ganhou ${fmtBRLCompact(l.delta)} vindo de ${orig} (${recebidos.length} especificadores).`,
      });
    });

    // Fluxo entre canais
    const fp = arr.filter(
      (r) =>
        r.migrou &&
        normalizaCanal(r.loja_origem_canal) === "franquia" &&
        normalizaCanal(r.loja_atual_canal) === "loja_propria",
    );
    const pf = arr.filter(
      (r) =>
        r.migrou &&
        normalizaCanal(r.loja_origem_canal) === "loja_propria" &&
        normalizaCanal(r.loja_atual_canal) === "franquia",
    );
    if (fp.length > 0) {
      const valor = fp.reduce((s, r) => s + Number(r.valor_depois), 0);
      frases.push({
        tom: "sky",
        texto: `${fp.length} especificadores migraram de franquia para loja própria, movimentando ${fmtBRLCompact(valor)}.`,
      });
    }
    if (pf.length > 0) {
      const valor = pf.reduce((s, r) => s + Number(r.valor_depois), 0);
      frases.push({
        tom: "amber",
        texto: `${pf.length} especificadores migraram de loja própria para franquia (${fmtBRLCompact(valor)}). Avaliar causa.`,
      });
    }

    return frases.slice(0, 4);
  }, [data, resumoPorLoja]);

  // ===== Detalhe do drawer =====
  const detalheDrawer = useMemo(() => {
    if (!drawer || drawer.kind === "especificador") return null;
    const arr = data ?? [];
    let envolvidos: Row[] = [];
    if (drawer.kind === "loja") {
      envolvidos = arr.filter(
        (r) => r.loja_origem_id === drawer.key || r.loja_atual_id === drawer.key,
      );
    } else {
      envolvidos = arr.filter(
        (r) =>
          normalizaCanal(r.loja_origem_canal) === drawer.key ||
          normalizaCanal(r.loja_atual_canal) === drawer.key,
      );
    }
    const perdidos = envolvidos.filter((r) =>
      drawer.kind === "loja"
        ? r.loja_origem_id === drawer.key && r.loja_atual_id !== drawer.key
        : normalizaCanal(r.loja_origem_canal) === drawer.key &&
          normalizaCanal(r.loja_atual_canal) !== drawer.key,
    );
    const ganhos = envolvidos.filter((r) =>
      drawer.kind === "loja"
        ? r.loja_atual_id === drawer.key && r.loja_origem_id !== drawer.key
        : normalizaCanal(r.loja_atual_canal) === drawer.key &&
          normalizaCanal(r.loja_origem_canal) !== drawer.key,
    );
    const mantidos = envolvidos.filter((r) =>
      drawer.kind === "loja"
        ? r.loja_origem_id === drawer.key && r.loja_atual_id === drawer.key
        : normalizaCanal(r.loja_origem_canal) === drawer.key &&
          normalizaCanal(r.loja_atual_canal) === drawer.key,
    );
    const totalAntes = envolvidos.reduce(
      (s, r) =>
        s +
        (drawer.kind === "loja"
          ? r.loja_origem_id === drawer.key
            ? Number(r.valor_antes)
            : 0
          : normalizaCanal(r.loja_origem_canal) === drawer.key
            ? Number(r.valor_antes)
            : 0),
      0,
    );
    const totalDepois = envolvidos.reduce(
      (s, r) =>
        s +
        (drawer.kind === "loja"
          ? r.loja_atual_id === drawer.key
            ? Number(r.valor_depois)
            : 0
          : normalizaCanal(r.loja_atual_canal) === drawer.key
            ? Number(r.valor_depois)
            : 0),
      0,
    );
    return {
      envolvidos,
      perdidos,
      ganhos,
      mantidos,
      totalAntes,
      totalDepois,
      delta: totalDepois - totalAntes,
    };
  }, [drawer, data]);

  return (
    <div className="w-full space-y-4 text-[13px]">
      <TurnoverFiltersBar />

      {/* Texto explicativo */}
      <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <div>
          <span className="font-medium">Como ler esta tela:</span> a análise
          compara a <b>primeira metade</b> do período selecionado (antes) com a{" "}
          <b>segunda metade</b> (depois). Mostramos quem migrou de loja ou canal
          (própria × franquia), quanto cada loja perdeu/ganhou em carteira e
          qual ação comercial tomar.
        </div>
      </div>

      {/* Faixa de Insights Executivos */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          tone="rose"
          icon={<TrendingDown className="h-4 w-4" />}
          title="Maior perda"
          headline={
            insights.maiorPerda
              ? insights.maiorPerda.r.especificador_nome
              : "—"
          }
          value={
            insights.maiorPerda
              ? fmtBRLCompact(insights.maiorPerda.deltaRs)
              : "—"
          }
          sub={
            insights.maiorPerda
              ? `${insights.maiorPerda.deltaPct.toFixed(1)}% • ${
                  insights.maiorPerda.r.loja_atual_nome ?? "—"
                }`
              : "Sem perdas no período"
          }
          footer={`${insights.qtdPerdas} em queda · total ${fmtBRLCompact(insights.somaPerdas)}`}
        />
        <InsightCard
          tone="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Maior ganho"
          headline={
            insights.maiorGanho
              ? insights.maiorGanho.r.especificador_nome
              : "—"
          }
          value={
            insights.maiorGanho
              ? `+${fmtBRLCompact(insights.maiorGanho.deltaRs)}`
              : "—"
          }
          sub={
            insights.maiorGanho
              ? `+${insights.maiorGanho.deltaPct.toFixed(1)}% • ${
                  insights.maiorGanho.r.loja_atual_nome ?? "—"
                }`
              : "Sem ganhos no período"
          }
          footer={`${insights.qtdGanhos} em alta · total +${fmtBRLCompact(insights.somaGanhos)}`}
        />
        <InsightCard
          tone="amber"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Mudanças críticas"
          headline={`${insights.criticosQtd} casos`}
          value="Atenção"
          sub="Migraram, mudaram canal ou caíram ≥ 30%"
          footer="Priorize contato comercial"
        />
        <InsightCard
          tone="sky"
          icon={<Target className="h-4 w-4" />}
          title="Oportunidades"
          headline={`${insights.oportunidadesQtd} casos`}
          value={insights.saldo >= 0 ? `+${fmtBRLCompact(insights.saldo)}` : fmtBRLCompact(insights.saldo)}
          sub="Crescimento ≥ 30% sem migração"
          footer="Saldo líquido do período"
        />
      </div>

      {/* Cards de diagnóstico narrativo */}
      {diagnosticos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnóstico do período</CardTitle>
            <CardDescription>
              Leitura automática das maiores movimentações de carteira.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {diagnosticos.map((d, i) => (
                <DiagnosticoLinha key={i} tom={d.tom} texto={d.texto} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumos por Loja / Canal (clicáveis) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ResumoTabela
          titulo="Ganho/Perda por Loja"
          descricao="Clique em uma loja para ver origens, destinos, especificadores e vendedores envolvidos."
          colLabel="Loja"
          rows={resumoPorLoja}
          onRowClick={(r) =>
            setDrawer({ kind: "loja", key: r.key, label: r.label })
          }
          onExport={() =>
            downloadCSV(
              `turnover-resumo-lojas-${dataInicio}_a_${dataFim}`,
              resumoPorLoja.map((r) => ({
                Loja: r.label,
                "Especificadores (depois)": r.qtd,
                "Valor antes": r.antes.toFixed(2),
                "Valor depois": r.depois.toFixed(2),
                "Δ R$": r.delta.toFixed(2),
              })),
            )
          }
        />
        <ResumoTabela
          titulo="Ganho/Perda por Modelo de Negócio"
          descricao="Própria × Franquia. Clique para ver o fluxo de migração entre canais."
          colLabel="Canal"
          rows={resumoPorCanal}
          onRowClick={(r) =>
            setDrawer({ kind: "canal", key: r.key, label: r.label })
          }
          onExport={() =>
            downloadCSV(
              `turnover-resumo-canais-${dataInicio}_a_${dataFim}`,
              resumoPorCanal.map((r) => ({
                Canal: r.label,
                "Especificadores (depois)": r.qtd,
                "Valor antes": r.antes.toFixed(2),
                "Valor depois": r.depois.toFixed(2),
                "Δ R$": r.delta.toFixed(2),
              })),
            )
          }
        />
      </div>

      {/* Tabela executiva */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Carteira de especificadores
              </CardTitle>
              <CardDescription>
                Clique em uma linha para abrir o detalhe do especificador.
                Ordenado por impacto financeiro.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por nome…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-[220px]"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!filtradas.length}
                onClick={() => {
                  const rows = filtradas.map((r) => ({
                    Especificador: r.especificador_nome,
                    "Loja antes": r.loja_origem_nome ?? "",
                    "Canal antes": canalLabel(r.loja_origem_canal),
                    "Loja depois": r.loja_atual_nome ?? "",
                    "Canal depois": canalLabel(r.loja_atual_canal),
                    "Vendedor antes": r.vendedor_origem_nome ?? "",
                    "Vendedor depois": r.vendedor_atual_nome ?? "",
                    "Valor antes": Number(r.valor_antes).toFixed(2),
                    "Valor depois": Number(r.valor_depois).toFixed(2),
                    "Δ R$": deltaRs(r).toFixed(2),
                    "Δ %": Number(r.delta_pct).toFixed(2),
                    "Ação recomendada": ACAO_META[acaoRecomendada(r)].label,
                  }));
                  downloadCSV(
                    `turnover-especificadores-${dataInicio}_a_${dataFim}`,
                    rows,
                  );
                }}
              >
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!filtradas.length}
                onClick={() => {
                  const rows = filtradas.map((r) => ({
                    Especificador: r.especificador_nome,
                    "Loja antes": r.loja_origem_nome ?? "",
                    "Loja depois": r.loja_atual_nome ?? "",
                    "Vend. antes": r.vendedor_origem_nome ?? "",
                    "Vend. depois": r.vendedor_atual_nome ?? "",
                    Antes: Number(r.valor_antes).toFixed(2),
                    Depois: Number(r.valor_depois).toFixed(2),
                    "Δ R$": deltaRs(r).toFixed(2),
                    "Δ %": Number(r.delta_pct).toFixed(1) + "%",
                    Ação: ACAO_META[acaoRecomendada(r)].label,
                  }));
                  downloadPDF(
                    `turnover-especificadores-${dataInicio}_a_${dataFim}`,
                    rows,
                    {
                      title: "Turnover · Carteira de especificadores",
                      subtitle: `Período: ${dataInicio} a ${dataFim}`,
                    },
                  );
                }}
              >
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>

          {/* Filtros rápidos */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(v) => v && setFiltro(v)}
              size="sm"
              className="flex-wrap"
            >
              <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
              <ToggleGroupItem value="perdas">Só perdas</ToggleGroupItem>
              <ToggleGroupItem value="ganhos">Só ganhos</ToggleGroupItem>
              <ToggleGroupItem value="migraram">Mudou de loja</ToggleGroupItem>
              <ToggleGroupItem value="trocaram_vendedor">
                Mudou de vendedor
              </ToggleGroupItem>
              <ToggleGroupItem value="franquia_para_propria">
                Franquia → Própria
              </ToggleGroupItem>
              <ToggleGroupItem value="propria_para_franquia">
                Própria → Franquia
              </ToggleGroupItem>
              <ToggleGroupItem value="top_perdas">Top perdas</ToggleGroupItem>
              <ToggleGroupItem value="top_ganhos">Top ganhos</ToggleGroupItem>
            </ToggleGroup>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              Ordenar por:
              <ToggleGroup
                type="single"
                value={ordenar}
                onValueChange={(v) => v && setOrdenar(v as typeof ordenar)}
                size="sm"
              >
                <ToggleGroupItem value="delta">Δ R$</ToggleGroupItem>
                <ToggleGroupItem value="valor">Valor</ToggleGroupItem>
                <ToggleGroupItem value="nome">Nome</ToggleGroupItem>
              </ToggleGroup>
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
          ) : filtradas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Nenhum especificador para os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky left-0 bg-muted/40 min-w-[200px]">
                      Especificador
                    </TableHead>
                    <TableHead className="min-w-[260px]">
                      Origem → Destino
                    </TableHead>
                    <TableHead className="min-w-[220px]">
                      Vendedor antes → depois
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      Valor antes
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      Valor depois
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      Δ R$
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.slice(0, 200).map((r) => {
                    const dRs = deltaRs(r);
                    const acao = acaoRecomendada(r);
                    const positivo = dRs > 0;
                    const negativo = dRs < 0;
                    return (
                      <TableRow
                        key={r.especificador_id}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() =>
                          setDrawer({ kind: "especificador", row: r })
                        }
                      >
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {r.especificador_nome}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="text-foreground">
                              {r.loja_origem_nome ?? "—"}
                            </span>
                            <span className="text-[11px]">
                              ({canalLabel(r.loja_origem_canal)})
                            </span>
                            <ArrowRight className="h-3 w-3" />
                            <span
                              className={
                                r.migrou
                                  ? "text-rose-600 font-medium dark:text-rose-400"
                                  : "text-foreground"
                              }
                            >
                              {r.loja_atual_nome ?? "—"}
                            </span>
                            <span className="text-[11px]">
                              ({canalLabel(r.loja_atual_canal)})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="text-foreground">
                              {r.vendedor_origem_nome ?? "—"}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                            <span
                              className={
                                r.trocou_vendedor
                                  ? "text-amber-700 font-medium dark:text-amber-400"
                                  : "text-foreground"
                              }
                            >
                              {r.vendedor_atual_nome ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmtBRL(Number(r.valor_antes))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtBRL(Number(r.valor_depois))}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            negativo
                              ? "text-rose-600 dark:text-rose-400"
                              : positivo
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            {positivo && <ArrowUpRight className="h-3 w-3" />}
                            {negativo && <ArrowDownRight className="h-3 w-3" />}
                            {positivo ? "+" : ""}
                            {fmtBRLCompact(dRs)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={ACAO_META[acao].className}
                          >
                            {ACAO_META[acao].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtradas.length > 200 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Exibindo as 200 primeiras de {filtradas.length}. Use busca e
                  filtros para refinar.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer detalhe */}
      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {drawer?.kind === "especificador" && (
            <EspecificadorDetalhe row={drawer.row} />
          )}
          {drawer && drawer.kind !== "especificador" && detalheDrawer && (
            <AgrupadorDetalhe
              titulo={drawer.label}
              tipo={drawer.kind}
              chaveAtual={drawer.key}
              dados={detalheDrawer}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ===================== Subcomponentes =====================

function InsightCard({
  tone,
  icon,
  title,
  headline,
  value,
  sub,
  footer,
}: {
  tone: "rose" | "emerald" | "amber" | "sky";
  icon: React.ReactNode;
  title: string;
  headline: string;
  value: string;
  sub: string;
  footer?: string;
}) {
  const toneMap = {
    rose: "border-l-rose-500 [&_.tone-icon]:text-rose-600 [&_.tone-value]:text-rose-600 dark:[&_.tone-icon]:text-rose-400 dark:[&_.tone-value]:text-rose-400",
    emerald:
      "border-l-emerald-500 [&_.tone-icon]:text-emerald-600 [&_.tone-value]:text-emerald-600 dark:[&_.tone-icon]:text-emerald-400 dark:[&_.tone-value]:text-emerald-400",
    amber:
      "border-l-amber-500 [&_.tone-icon]:text-amber-600 [&_.tone-value]:text-amber-700 dark:[&_.tone-icon]:text-amber-400 dark:[&_.tone-value]:text-amber-400",
    sky: "border-l-sky-500 [&_.tone-icon]:text-sky-600 [&_.tone-value]:text-sky-700 dark:[&_.tone-icon]:text-sky-400 dark:[&_.tone-value]:text-sky-400",
  } as const;
  return (
    <Card className={`border-l-4 ${toneMap[tone]}`}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wide">
          <span>{title}</span>
          <span className="tone-icon">{icon}</span>
        </div>
        <div className="text-sm font-medium truncate" title={headline}>
          {headline}
        </div>
        <div className="tone-value text-xl font-semibold tabular-nums">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{sub}</div>
        {footer && (
          <div className="text-[11px] text-muted-foreground/80 pt-1 border-t mt-2">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiagnosticoLinha({
  tom,
  texto,
}: {
  tom: "rose" | "emerald" | "amber" | "sky";
  texto: string;
}) {
  const tomMap = {
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
    emerald:
      "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber:
      "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
  } as const;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${tomMap[tom]}`}>
      {texto}
    </div>
  );
}

function ResumoTabela({
  titulo,
  descricao,
  colLabel,
  rows,
  onExport,
  onRowClick,
}: {
  titulo: string;
  descricao: string;
  colLabel: string;
  rows: Array<{
    key: string;
    label: string;
    antes: number;
    depois: number;
    qtd: number;
    delta: number;
  }>;
  onExport: () => void;
  onRowClick?: (r: { key: string; label: string }) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{titulo}</CardTitle>
            <CardDescription>{descricao}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!rows.length}
            onClick={onExport}
          >
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Sem dados.
          </div>
        ) : (
          <div className="overflow-auto max-h-[360px]">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>{colLabel}</TableHead>
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Depois</TableHead>
                  <TableHead className="text-right">Δ R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r) => (
                  <TableRow
                    key={r.key}
                    className={`hover:bg-muted/30 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.({ key: r.key, label: r.label })}
                  >
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtBRL(r.antes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtBRL(r.depois)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        r.delta < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : r.delta > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {r.delta >= 0 ? "+" : ""}
                      {fmtBRL(r.delta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgrupadorDetalhe({
  titulo,
  tipo,
  chaveAtual,
  dados,
}: {
  titulo: string;
  tipo: "loja" | "canal";
  chaveAtual: string;
  dados: {
    envolvidos: Row[];
    perdidos: Row[];
    ganhos: Row[];
    mantidos: Row[];
    totalAntes: number;
    totalDepois: number;
    delta: number;
  };
}) {
  const acao =
    dados.delta < 0
      ? "Recuperar carteira: contatar especificadores perdidos e revisar atendimento."
      : dados.delta > 0
        ? "Manter ritmo: reforçar relacionamento com a carteira ganha."
        : "Acompanhar movimentações sem ação imediata.";

  const origens = new Map<string, { label: string; valor: number; qtd: number }>();
  dados.perdidos.forEach((r) => {
    const k =
      tipo === "loja"
        ? r.loja_atual_id ?? "—"
        : normalizaCanal(r.loja_atual_canal) ?? "—";
    const label =
      tipo === "loja"
        ? r.loja_atual_nome ?? "—"
        : canalLabel(r.loja_atual_canal);
    if (!origens.has(k)) origens.set(k, { label, valor: 0, qtd: 0 });
    origens.get(k)!.valor += Number(r.valor_depois);
    origens.get(k)!.qtd += 1;
  });

  const destinosFonte = new Map<
    string,
    { label: string; valor: number; qtd: number }
  >();
  dados.ganhos.forEach((r) => {
    const k =
      tipo === "loja"
        ? r.loja_origem_id ?? "—"
        : normalizaCanal(r.loja_origem_canal) ?? "—";
    const label =
      tipo === "loja"
        ? r.loja_origem_nome ?? "—"
        : canalLabel(r.loja_origem_canal);
    if (!destinosFonte.has(k))
      destinosFonte.set(k, { label, valor: 0, qtd: 0 });
    destinosFonte.get(k)!.valor += Number(r.valor_depois);
    destinosFonte.get(k)!.qtd += 1;
  });

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>{titulo}</SheetTitle>
        <SheetDescription>
          {tipo === "loja" ? "Detalhe da loja" : "Detalhe do canal"} — comparativo
          entre a primeira e a segunda metade do período.
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Antes" value={fmtBRLCompact(dados.totalAntes)} />
        <MiniStat label="Depois" value={fmtBRLCompact(dados.totalDepois)} />
        <MiniStat
          label="Δ R$"
          value={`${dados.delta >= 0 ? "+" : ""}${fmtBRLCompact(dados.delta)}`}
          tone={dados.delta < 0 ? "rose" : dados.delta > 0 ? "emerald" : "muted"}
        />
      </div>

      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
        <span className="font-medium">Ação recomendada:</span> {acao}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BlocoFluxo
          titulo="Para onde foi (perdas)"
          vazio="Nenhuma saída no período."
          tom="rose"
          rows={Array.from(origens.values()).sort((a, b) => b.valor - a.valor)}
        />
        <BlocoFluxo
          titulo="De onde veio (ganhos)"
          vazio="Nenhuma entrada no período."
          tom="emerald"
          rows={Array.from(destinosFonte.values()).sort(
            (a, b) => b.valor - a.valor,
          )}
        />
      </div>

      <div>
        <div className="text-sm font-medium mb-2">
          Especificadores envolvidos ({dados.envolvidos.length})
        </div>
        <div className="rounded-md border overflow-auto max-h-[320px]">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Especificador</TableHead>
                <TableHead>Vendedor antes → depois</TableHead>
                <TableHead className="text-right">Δ R$</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.envolvidos
                .slice()
                .sort((a, b) => deltaRs(a) - deltaRs(b))
                .slice(0, 80)
                .map((r) => {
                  const d = deltaRs(r);
                  return (
                    <TableRow key={r.especificador_id}>
                      <TableCell className="font-medium">
                        {r.especificador_nome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.vendedor_origem_nome ?? "—"}{" "}
                        <ArrowRight className="inline h-3 w-3" />{" "}
                        <span
                          className={
                            r.trocou_vendedor
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-foreground"
                          }
                        >
                          {r.vendedor_atual_nome ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          d < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : d > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {d >= 0 ? "+" : ""}
                        {fmtBRLCompact(d)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Chave: {chaveAtual.slice(0, 8)}
      </p>
    </div>
  );
}

function BlocoFluxo({
  titulo,
  vazio,
  tom,
  rows,
}: {
  titulo: string;
  vazio: string;
  tom: "rose" | "emerald";
  rows: { label: string; valor: number; qtd: number }[];
}) {
  const cor =
    tom === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="rounded-md border p-3">
      <div className="text-sm font-medium mb-2">{titulo}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">{vazio}</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">{r.label}</span>
              <span className={`tabular-nums font-medium ${cor}`}>
                {fmtBRLCompact(r.valor)}
                <span className="text-[11px] text-muted-foreground ml-1">
                  ({r.qtd})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "rose" | "emerald" | "muted";
}) {
  const cor =
    tone === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : tone === "emerald"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${cor}`}>{value}</div>
    </div>
  );
}

function EspecificadorDetalhe({ row }: { row: Row }) {
  const d = deltaRs(row);
  const acao = acaoRecomendada(row);
  const recomendacao = (() => {
    if (acao === "recuperar")
      return "Acionar gestor da loja de origem, agendar visita do vendedor anterior e ofertar condição comercial para retomar o relacionamento.";
    if (acao === "investigar")
      return "Houve troca de vendedor sem perda relevante. Confirmar com o novo vendedor a continuidade do relacionamento e mapear riscos.";
    if (acao === "acompanhar")
      return "Queda moderada sem migração. Aumentar frequência de contato e acompanhar próximos orçamentos.";
    return "Carteira saudável. Reforçar pós-venda e oportunidades de upsell.";
  })();

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>{row.especificador_nome}</SheetTitle>
        <SheetDescription>
          Comparativo entre a primeira e a segunda metade do período.
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Antes" value={fmtBRLCompact(Number(row.valor_antes))} />
        <MiniStat
          label="Depois"
          value={fmtBRLCompact(Number(row.valor_depois))}
        />
        <MiniStat
          label="Δ R$"
          value={`${d >= 0 ? "+" : ""}${fmtBRLCompact(d)}`}
          tone={d < 0 ? "rose" : d > 0 ? "emerald" : "muted"}
        />
      </div>

      <div className="rounded-md border p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24">Loja</span>
          <span className="font-medium">{row.loja_origem_nome ?? "—"}</span>
          <span className="text-[11px] text-muted-foreground">
            ({canalLabel(row.loja_origem_canal)})
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span
            className={`font-medium ${
              row.migrou ? "text-rose-600 dark:text-rose-400" : ""
            }`}
          >
            {row.loja_atual_nome ?? "—"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({canalLabel(row.loja_atual_canal)})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24">Vendedor</span>
          <span className="font-medium">{row.vendedor_origem_nome ?? "—"}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span
            className={`font-medium ${
              row.trocou_vendedor ? "text-amber-700 dark:text-amber-400" : ""
            }`}
          >
            {row.vendedor_atual_nome ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-muted-foreground w-24">Variação</span>
          <span className="font-medium">{Number(row.delta_pct).toFixed(1)}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ação:</span>
        <Badge variant="outline" className={ACAO_META[acao].className}>
          {ACAO_META[acao].label}
        </Badge>
      </div>

      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
        <div className="font-medium mb-1">Recomendação comercial</div>
        {recomendacao}
      </div>

      <div className="text-[11px] text-muted-foreground">
        Movimentações detectadas: {row.migrou ? "mudou de loja" : "mesma loja"} •{" "}
        {row.mudou_canal ? "mudou de canal" : "mesmo canal"} •{" "}
        {row.trocou_vendedor ? "trocou de vendedor" : "mesmo vendedor"}.
      </div>
    </div>
  );
}
