import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/lib/global-filters";
import { Ruler, Layers, TrendingDown, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inteligencia/mix")({
  component: MixInteligencia,
});

function fmtMoney(n: number) { return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

type ItemRow = {
  valor_total: number;
  tamanho: string | null;
  linha: string | null;
  orcamentos: { status: string; data_orcamento: string } | null;
};

function MixInteligencia() {
  const { inicioISO, lojaId } = useGlobalFilters();

  const itens = useQuery({
    queryKey: ["mix-itens", inicioISO, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("orcamento_itens")
        .select("valor_total,tamanho,linha,orcamentos!inner(status,data_orcamento,loja_id)")
        .gte("orcamentos.data_orcamento", inicioISO)
        .limit(20000);
      if (lojaId) q = q.eq("orcamentos.loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ItemRow[];
    },
  });

  const topCampanhas = useQuery({
    queryKey: ["mix-top-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("campanha_id,economia,campanhas(nome)")
        .eq("status", "nova");
      if (error) throw error;
      const map = new Map<string, { nome: string; total: number; count: number }>();
      for (const r of data ?? []) {
        const nome = (r as any).campanhas?.nome ?? "—";
        const cur = map.get(r.campanha_id) ?? { nome, total: 0, count: 0 };
        cur.total += Number(r.economia || 0);
        cur.count += 1;
        map.set(r.campanha_id, cur);
      }
      return Array.from(map.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
    },
  });

  const rankingVendedores = useQuery({
    queryKey: ["mix-rank-vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("vendedor_id,economia,status,vendedores(nome)")
        .in("status", ["nova", "em_andamento", "convertida"]);
      if (error) throw error;
      const map = new Map<string, { nome: string; potencial: number; convertido: number }>();
      for (const r of data ?? []) {
        if (!r.vendedor_id) continue;
        const nome = (r as any).vendedores?.nome ?? "—";
        const cur = map.get(r.vendedor_id) ?? { nome, potencial: 0, convertido: 0 };
        const v = Number(r.economia || 0);
        cur.potencial += v;
        if (r.status === "convertida") cur.convertido += v;
        map.set(r.vendedor_id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.convertido - a.convertido || b.potencial - a.potencial).slice(0, 10);
    },
  });

  type Bucket = { key: string; orcado: number; vendido: number; count: number };
  const { porTamanho, porLinha } = useMemo(() => {
    const tam = new Map<string, Bucket>();
    const lin = new Map<string, Bucket>();
    for (const it of itens.data ?? []) {
      const val = Number(it.valor_total || 0);
      const status = it.orcamentos?.status ?? "";
      const vendido = status === "vendido" || status === "parcial" ? val : 0;

      const tKey = it.tamanho || "(sem tamanho)";
      const t = tam.get(tKey) ?? { key: tKey, orcado: 0, vendido: 0, count: 0 };
      t.orcado += val; t.vendido += vendido; t.count += 1;
      tam.set(tKey, t);

      const lKey = it.linha || "(sem linha)";
      const l = lin.get(lKey) ?? { key: lKey, orcado: 0, vendido: 0, count: 0 };
      l.orcado += val; l.vendido += vendido; l.count += 1;
      lin.set(lKey, l);
    }
    const sort = (m: Map<string, Bucket>) => Array.from(m.values()).sort((a, b) => b.orcado - a.orcado).slice(0, 10);
    return { porTamanho: sort(tam), porLinha: sort(lin) };
  }, [itens.data]);

  return (
    <div>
      <PageHeader
        title="Inteligência Comercial — Mix"
        description="Análise de mix de produtos e potencial de recuperação via campanhas"
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <RankCard title="Conversão por tamanho" icon={Ruler} rows={porTamanho} loading={itens.isLoading} />
        <RankCard title="Conversão por linha" icon={Layers} rows={porLinha} loading={itens.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <div className="font-semibold text-sm">Top campanhas — potencial de recuperação</div>
            </div>
            {topCampanhas.isLoading && <div className="text-xs text-muted-foreground">Carregando…</div>}
            {!topCampanhas.isLoading && (topCampanhas.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">Nenhuma campanha com oportunidades em aberto.</div>
            )}
            <div className="divide-y">
              {(topCampanhas.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{c.nome}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{c.count} orç.</Badge>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(c.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <div className="font-semibold text-sm">Ranking — vendedores que reativam mais</div>
            </div>
            {rankingVendedores.isLoading && <div className="text-xs text-muted-foreground">Carregando…</div>}
            {!rankingVendedores.isLoading && (rankingVendedores.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">Sem dados de reativação ainda.</div>
            )}
            <div className="divide-y">
              {(rankingVendedores.data ?? []).map((r, i) => (
                <div key={r.nome + i} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                    <span className="truncate">{r.nome}</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-muted-foreground tabular-nums">Pot.: {fmtMoney(r.potencial)}</span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">Conv.: {fmtMoney(r.convertido)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RankCard({ title, icon: Icon, rows, loading }: { title: string; icon: React.ComponentType<{ className?: string }>; rows: { key: string; orcado: number; vendido: number; count: number }[]; loading: boolean }) {
  const maxOrcado = Math.max(1, ...rows.map((r) => r.orcado));
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="font-semibold text-sm">{title}</div>
        </div>
        {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
        {!loading && rows.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem dados no período selecionado.</div>
        )}
        <div className="space-y-2.5">
          {rows.map((r) => {
            const conv = r.orcado > 0 ? (r.vendido / r.orcado) * 100 : 0;
            const pct = (r.orcado / maxOrcado) * 100;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{r.key}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground tabular-nums">{fmtMoney(r.orcado)}</span>
                    <Badge variant={conv >= 30 ? "default" : "outline"} className="text-[10px] tabular-nums">{fmtPct(conv)}</Badge>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
