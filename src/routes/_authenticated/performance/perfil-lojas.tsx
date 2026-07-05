import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGlobalFilters } from "@/lib/global-filters";
import { ChevronDown, Store, Sparkles } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/performance/perfil-lojas")({
  component: PerfilLojas,
});

type Loja = { id: string; nome: string; canal: string | null };

type FaixaKey = "ate25" | "25a50" | "50a100" | "100a250" | "acima250";
const FAIXA_LABEL: Record<FaixaKey, string> = {
  ate25: "Até R$ 25 mil",
  "25a50": "R$ 25 a 50 mil",
  "50a100": "R$ 50 a 100 mil",
  "100a250": "R$ 100 a 250 mil",
  acima250: "Acima de R$ 250 mil",
};
const FAIXA_ORDER: FaixaKey[] = ["ate25", "25a50", "50a100", "100a250", "acima250"];

type FaixaData = {
  qtd: number; qtd_vendas: number;
  valor_orcado: number; valor_vendido: number;
  conversao_qtd: number; conversao_valor: number;
};

type PerfilRow = {
  loja_id: string;
  loja_nome: string;
  canal: string | null;
  qtd_orcamentos: number;
  qtd_vendas: number;
  valor_orcado: number;
  valor_vendido: number;
  conversao_qtd: number;
  conversao_valor: number;
  ticket_medio_vendido: number;
  ticket_medio_orcado: number;
  especificadores_ativos: number;
  vendedores_ativos: number;
  clientes_unicos: number;
  faixas: Partial<Record<FaixaKey, FaixaData>>;
};

type PerfilClienteRow = {
  loja_id: string; loja_nome: string;
  clientes_unicos: number; clientes_recorrentes: number; recorrencia_pct: number;
  ticket_medio_cliente: number; ticket_mediano_cliente: number;
  dias_medio_ate_conversao: number; perfil_dominante: string;
  distribuicao: { alto: number; medio: number; entrada: number };
};
type TopEsp = { nome: string; qtd: number; vendido: number; orcado: number };
type PerfilEspRow = {
  loja_id: string; loja_nome: string;
  especificadores_ativos: number; especificadores_recorrentes: number;
  dependencia_top5_pct: number; ticket_medio_esp: number; conversao_esp_pct: number;
  top_especificadores: TopEsp[];
};
type TopVnd = { nome: string; qtd: number; vendido: number; orcado: number; conversao: number };
type PerfilVndRow = {
  loja_id: string; loja_nome: string;
  vendedores_ativos: number; produtividade_media: number;
  conversao_media_pct: number; ticket_medio_vendedor: number;
  dependencia_top3_pct: number; top_vendedores: TopVnd[];
};
type TopProd = { nome: string; valor: number; qtd: number };
type PerfilProdRow = {
  loja_id: string; loja_nome: string;
  cobertura_pct: number;
  top_categorias: TopProd[];
  top_linhas: TopProd[];
  top_formatos: TopProd[];
};
type EvolRow = {
  loja_id: string; loja_nome: string; mes: string;
  valor_orcado: number; valor_vendido: number;
  qtd_orcamentos: number; qtd_vendas: number;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => Number(n || 0).toLocaleString("pt-BR");
const fmtPct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function PerfilLojas() {
  const { inicioISO, fimISO } = useGlobalFilters();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: lojas } = useQuery({
    queryKey: ["perfil-lojas:lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id,nome,canal")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Loja[];
    },
  });

  const { data: rows, isFetching } = useQuery({
    queryKey: ["perfil-lojas:compare", inicioISO, fimISO, selected.join(",")],
    enabled: selected.length >= 2,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        rpc: (n: string, p: Record<string, unknown>) => Promise<{ data: PerfilRow[] | null; error: unknown }>;
      }).rpc("lojas_perfil_comparativo", {
        p_inicio: inicioISO,
        p_fim: fimISO,
        p_lojas: selected,
      });
      if (error) throw error as Error;
      return (data ?? []) as PerfilRow[];
    },
  });

  const rpcCall = async <T,>(name: string) => {
    const { data, error } = await (supabase as unknown as {
      rpc: (n: string, p: Record<string, unknown>) => Promise<{ data: T[] | null; error: unknown }>;
    }).rpc(name, { p_inicio: inicioISO, p_fim: fimISO, p_lojas: selected });
    if (error) throw error as Error;
    return (data ?? []) as T[];
  };

  const { data: clientes } = useQuery({
    queryKey: ["perfil-lojas:clientes", inicioISO, fimISO, selected.join(",")],
    enabled: selected.length >= 2,
    queryFn: () => rpcCall<PerfilClienteRow>("lojas_perfil_clientes"),
  });
  const { data: esps } = useQuery({
    queryKey: ["perfil-lojas:esps", inicioISO, fimISO, selected.join(",")],
    enabled: selected.length >= 2,
    queryFn: () => rpcCall<PerfilEspRow>("lojas_perfil_especificadores"),
  });
  const { data: vnds } = useQuery({
    queryKey: ["perfil-lojas:vnds", inicioISO, fimISO, selected.join(",")],
    enabled: selected.length >= 2,
    queryFn: () => rpcCall<PerfilVndRow>("lojas_perfil_vendedores"),
  });
  const { data: prods } = useQuery({
    queryKey: ["perfil-lojas:prods", inicioISO, fimISO, selected.join(",")],
    enabled: selected.length >= 2,
    queryFn: () => rpcCall<PerfilProdRow>("lojas_perfil_produtos"),
  });
  const { data: evol } = useQuery({
    queryKey: ["perfil-lojas:evol", inicioISO, fimISO, selected.join(",")],
    enabled: selected.length >= 2,
    queryFn: () => rpcCall<EvolRow>("lojas_perfil_evolucao"),
  });

  const insights = useMemo(
    () => geraInsights(rows ?? [], clientes ?? [], esps ?? [], vnds ?? [], prods ?? []),
    [rows, clientes, esps, vnds, prods],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" /> Lojas a comparar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <LojasPicker lojas={lojas ?? []} selected={selected} onChange={setSelected} />
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Limpar
              </Button>
            )}
            <div className="ml-auto text-xs text-muted-foreground">
              Selecione 2 ou mais lojas para comparar
            </div>
          </div>
        </CardContent>
      </Card>

      {selected.length < 2 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Escolha pelo menos duas lojas para gerar a comparação.
        </CardContent></Card>
      )}

      {selected.length >= 2 && isFetching && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Carregando comparação...
        </CardContent></Card>
      )}

      {selected.length >= 2 && rows && rows.length > 0 && (
        <>
          {/* VISÃO GERAL */}
          <Card>
            <CardHeader><CardTitle className="text-base">Visão geral</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Indicador</th>
                    {rows.map((r, i) => (
                      <th key={r.loja_id} className="py-2 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {r.loja_nome}
                          {r.canal && <Badge variant="outline" className="text-[10px]">{labelCanal(r.canal)}</Badge>}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Linha label="Valor Orçado" rows={rows} get={(r) => fmtBRL(r.valor_orcado)} />
                  <Linha label="Valor Vendido" rows={rows} get={(r) => fmtBRL(r.valor_vendido)} />
                  <Linha label="Qtd. Orçamentos" rows={rows} get={(r) => fmtInt(r.qtd_orcamentos)} />
                  <Linha label="Qtd. Vendas" rows={rows} get={(r) => fmtInt(r.qtd_vendas)} />
                  <Linha label="Conversão (qtd)" rows={rows} get={(r) => fmtPct(r.conversao_qtd)} />
                  <Linha label="Conversão (valor)" rows={rows} get={(r) => fmtPct(r.conversao_valor)} />
                  <Linha label="Ticket Médio (vendido)" rows={rows} get={(r) => fmtBRL(r.ticket_medio_vendido)} />
                  <Linha label="Ticket Médio (orçado)" rows={rows} get={(r) => fmtBRL(r.ticket_medio_orcado)} />
                  <Linha label="Especificadores ativos" rows={rows} get={(r) => fmtInt(r.especificadores_ativos)} />
                  <Linha label="Vendedores ativos" rows={rows} get={(r) => fmtInt(r.vendedores_ativos)} />
                  <Linha label="Clientes únicos" rows={rows} get={(r) => fmtInt(r.clientes_unicos)} />
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* CARTEIRA POR FAIXA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil da carteira de orçamentos por faixa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCarteira(rows)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {rows.map((r, i) => (
                      <Bar key={r.loja_id} dataKey={r.loja_nome} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Faixa</th>
                      {rows.map((r) => (
                        <th key={r.loja_id} className="py-2 px-3 text-right font-medium">{r.loja_nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FAIXA_ORDER.map((fk) => (
                      <tr key={fk} className="border-b last:border-0">
                        <td className="py-2 pr-4">{FAIXA_LABEL[fk]}</td>
                        {rows.map((r) => {
                          const f = r.faixas?.[fk];
                          const qtd = f?.qtd ?? 0;
                          const valor = f?.valor_orcado ?? 0;
                          const pct = r.qtd_orcamentos > 0 ? (qtd / r.qtd_orcamentos) * 100 : 0;
                          return (
                            <td key={r.loja_id} className="py-2 px-3 text-right">
                              <div>{fmtInt(qtd)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></div>
                              <div className="text-xs text-muted-foreground">{fmtBRL(valor)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* CONVERSÃO POR FAIXA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversão por faixa de valor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartConversao(rows)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {rows.map((r, i) => (
                      <Bar key={r.loja_id} dataKey={r.loja_nome} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Faixa</th>
                      {rows.map((r) => (
                        <th key={r.loja_id} className="py-2 px-3 text-right font-medium" colSpan={2}>{r.loja_nome}</th>
                      ))}
                    </tr>
                    <tr className="border-b text-left text-muted-foreground text-xs">
                      <th></th>
                      {rows.map((r) => (
                        <>
                          <th key={r.loja_id + "-q"} className="py-1 px-3 text-right font-normal">Conv. qtd</th>
                          <th key={r.loja_id + "-v"} className="py-1 px-3 text-right font-normal">Conv. valor</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FAIXA_ORDER.map((fk) => (
                      <tr key={fk} className="border-b last:border-0">
                        <td className="py-2 pr-4">{FAIXA_LABEL[fk]}</td>
                        {rows.map((r) => {
                          const f = r.faixas?.[fk];
                          return (
                            <>
                              <td key={r.loja_id + fk + "q"} className="py-2 px-3 text-right">{fmtPct(f?.conversao_qtd ?? 0)}</td>
                              <td key={r.loja_id + fk + "v"} className="py-2 px-3 text-right">{fmtPct(f?.conversao_valor ?? 0)}</td>
                            </>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* PERFIL DE CLIENTE */}
          {clientes && clientes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Perfil de cliente</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Indicador</th>
                      {clientes.map((r) => (
                        <th key={r.loja_id} className="py-2 px-3 text-right font-medium">{r.loja_nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <LinhaC label="Clientes únicos" rows={clientes} get={(r) => fmtInt(r.clientes_unicos)} />
                    <LinhaC label="Clientes recorrentes" rows={clientes} get={(r) => `${fmtInt(r.clientes_recorrentes)} (${fmtPct(r.recorrencia_pct)})`} />
                    <LinhaC label="Ticket médio por cliente" rows={clientes} get={(r) => fmtBRL(r.ticket_medio_cliente)} />
                    <LinhaC label="Ticket mediano por cliente" rows={clientes} get={(r) => fmtBRL(r.ticket_mediano_cliente)} />
                    <LinhaC label="Dias médios até conversão" rows={clientes} get={(r) => `${r.dias_medio_ate_conversao.toFixed(1)} dias`} />
                    <LinhaC label="Perfil dominante" rows={clientes} get={(r) => labelPerfil(r.perfil_dominante)} />
                    <LinhaC label="Distribuição (Alto/Médio/Entrada)" rows={clientes} get={(r) => `${r.distribuicao?.alto ?? 0} / ${r.distribuicao?.medio ?? 0} / ${r.distribuicao?.entrada ?? 0}`} />
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* PERFIL DE ESPECIFICADORES */}
          {esps && esps.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Perfil de especificadores</CardTitle></CardHeader>
              <CardContent className="space-y-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Indicador</th>
                      {esps.map((r) => (
                        <th key={r.loja_id} className="py-2 px-3 text-right font-medium">{r.loja_nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <LinhaE label="Especificadores ativos" rows={esps} get={(r) => fmtInt(r.especificadores_ativos)} />
                    <LinhaE label="Especificadores recorrentes" rows={esps} get={(r) => fmtInt(r.especificadores_recorrentes)} />
                    <LinhaE label="Dependência Top 5 (% vendas)" rows={esps} get={(r) => fmtPct(r.dependencia_top5_pct)} />
                    <LinhaE label="Ticket médio por especificador" rows={esps} get={(r) => fmtBRL(r.ticket_medio_esp)} />
                    <LinhaE label="Conversão (valor)" rows={esps} get={(r) => fmtPct(r.conversao_esp_pct)} />
                  </tbody>
                </table>
                <div className="grid gap-4 md:grid-cols-2">
                  {esps.map((r) => (
                    <div key={r.loja_id} className="border rounded-md p-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Top 5 especificadores — {r.loja_nome}</div>
                      <ul className="space-y-1 text-sm">
                        {r.top_especificadores?.length ? r.top_especificadores.map((t, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate">{i + 1}. {t.nome}</span>
                            <span className="text-muted-foreground whitespace-nowrap">{fmtBRL(t.vendido)}</span>
                          </li>
                        )) : <li className="text-muted-foreground text-xs">Sem dados.</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PERFIL DE VENDEDORES */}
          {vnds && vnds.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Perfil de vendedores</CardTitle></CardHeader>
              <CardContent className="space-y-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Indicador</th>
                      {vnds.map((r) => (
                        <th key={r.loja_id} className="py-2 px-3 text-right font-medium">{r.loja_nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <LinhaV label="Vendedores ativos" rows={vnds} get={(r) => fmtInt(r.vendedores_ativos)} />
                    <LinhaV label="Produtividade média (orç./vendedor)" rows={vnds} get={(r) => r.produtividade_media.toFixed(1)} />
                    <LinhaV label="Conversão média" rows={vnds} get={(r) => fmtPct(r.conversao_media_pct)} />
                    <LinhaV label="Ticket médio por vendedor" rows={vnds} get={(r) => fmtBRL(r.ticket_medio_vendedor)} />
                    <LinhaV label="Dependência Top 3 (% vendas)" rows={vnds} get={(r) => fmtPct(r.dependencia_top3_pct)} />
                  </tbody>
                </table>
                <div className="grid gap-4 md:grid-cols-2">
                  {vnds.map((r) => (
                    <div key={r.loja_id} className="border rounded-md p-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Top vendedores — {r.loja_nome}</div>
                      <ul className="space-y-1 text-sm">
                        {r.top_vendedores?.length ? r.top_vendedores.map((t, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate">{i + 1}. {t.nome}</span>
                            <span className="text-muted-foreground whitespace-nowrap">{fmtBRL(t.vendido)} · {fmtPct(t.conversao)}</span>
                          </li>
                        )) : <li className="text-muted-foreground text-xs">Sem dados.</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PERFIL DE PRODUTOS */}
          {prods && prods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perfil de produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  Inferido a partir das colunas da planilha (categoria, linha, formato). Cobertura mostra o % de orçamentos com pelo menos um desses campos preenchidos.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Indicador</th>
                        {prods.map((r) => (
                          <th key={r.loja_id} className="py-2 px-3 text-right font-medium">{r.loja_nome}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground">Cobertura de dados de produto</td>
                        {prods.map((r) => (
                          <td key={r.loja_id} className="py-2 px-3 text-right font-medium">{fmtPct(r.cobertura_pct)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {(["top_categorias","top_linhas","top_formatos"] as const).map((k) => (
                    <div key={k} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {k === "top_categorias" ? "Top categorias" : k === "top_linhas" ? "Top linhas" : "Top formatos"}
                      </div>
                      {prods.map((r) => (
                        <div key={r.loja_id} className="border rounded-md p-3">
                          <div className="text-xs font-medium mb-1">{r.loja_nome}</div>
                          <ul className="space-y-1 text-sm">
                            {(r[k] ?? []).length ? r[k].map((t, i) => (
                              <li key={i} className="flex justify-between gap-2">
                                <span className="truncate">{i + 1}. {t.nome}</span>
                                <span className="text-muted-foreground whitespace-nowrap">{fmtBRL(t.valor)}</span>
                              </li>
                            )) : <li className="text-muted-foreground text-xs">Sem dados.</li>}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* EVOLUÇÃO MENSAL */}
          {evol && evol.length > 0 && (() => {
            const meses = Array.from(new Set(evol.map(e => e.mes))).sort();
            const lojasMap = new Map<string, string>();
            evol.forEach(e => lojasMap.set(e.loja_id, e.loja_nome));
            const series = meses.map(m => {
              const row: Record<string, string | number> = {
                mes: new Date(m).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
              };
              lojasMap.forEach((nome, id) => {
                const item = evol.find(e => e.mes === m && e.loja_id === id);
                row[nome] = item ? Number(item.valor_vendido || 0) : 0;
              });
              return row;
            });
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução mensal de vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(Number(v)/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
                        <Legend />
                        {Array.from(lojasMap.values()).map((nome, i) => (
                          <Line key={nome} type="monotone" dataKey={nome} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* LEITURA EXECUTIVA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Leitura executiva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-relaxed">
                {insights.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{t}</span>
                  </li>
                ))}
                {insights.length === 0 && (
                  <li className="text-muted-foreground">Dados insuficientes para gerar leitura no período selecionado.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Linha({ label, rows, get }: { label: string; rows: PerfilRow[]; get: (r: PerfilRow) => string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-muted-foreground">{label}</td>
      {rows.map((r) => (
        <td key={r.loja_id} className="py-2 px-3 text-right font-medium">{get(r)}</td>
      ))}
    </tr>
  );
}

function LinhaC({ label, rows, get }: { label: string; rows: PerfilClienteRow[]; get: (r: PerfilClienteRow) => string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-muted-foreground">{label}</td>
      {rows.map((r) => <td key={r.loja_id} className="py-2 px-3 text-right font-medium">{get(r)}</td>)}
    </tr>
  );
}
function LinhaE({ label, rows, get }: { label: string; rows: PerfilEspRow[]; get: (r: PerfilEspRow) => string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-muted-foreground">{label}</td>
      {rows.map((r) => <td key={r.loja_id} className="py-2 px-3 text-right font-medium">{get(r)}</td>)}
    </tr>
  );
}
function LinhaV({ label, rows, get }: { label: string; rows: PerfilVndRow[]; get: (r: PerfilVndRow) => string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-muted-foreground">{label}</td>
      {rows.map((r) => <td key={r.loja_id} className="py-2 px-3 text-right font-medium">{get(r)}</td>)}
    </tr>
  );
}

function labelPerfil(p: string) {
  if (p === "alto") return "Alto padrão";
  if (p === "medio") return "Médio";
  if (p === "entrada") return "Entrada";
  return "—";
}

function labelCanal(c: string) {
  if (c === "loja_propria" || c === "nao_classificado") return "Própria";
  if (c === "franquia") return "Franquia";
  return c;
}

function chartCarteira(rows: PerfilRow[]) {
  return FAIXA_ORDER.map((fk) => {
    const o: Record<string, string | number> = { faixa: FAIXA_LABEL[fk].replace("R$ ", "") };
    rows.forEach((r) => {
      const total = r.qtd_orcamentos || 1;
      const qtd = r.faixas?.[fk]?.qtd ?? 0;
      o[r.loja_nome] = (qtd / total) * 100;
    });
    return o;
  });
}

function chartConversao(rows: PerfilRow[]) {
  return FAIXA_ORDER.map((fk) => {
    const o: Record<string, string | number> = { faixa: FAIXA_LABEL[fk].replace("R$ ", "") };
    rows.forEach((r) => {
      o[r.loja_nome] = r.faixas?.[fk]?.conversao_valor ?? 0;
    });
    return o;
  });
}

function geraInsights(
  rows: PerfilRow[],
  clis: PerfilClienteRow[] = [],
  esps: PerfilEspRow[] = [],
  vnds: PerfilVndRow[] = [],
  prods: PerfilProdRow[] = [],
): string[] {
  if (rows.length < 2) return [];
  const out: string[] = [];
  const byTicket = [...rows].sort((a, b) => b.ticket_medio_vendido - a.ticket_medio_vendido);
  if (byTicket[0].ticket_medio_vendido > 0) {
    out.push(`${byTicket[0].loja_nome} possui o maior ticket médio vendido (${fmtBRL(byTicket[0].ticket_medio_vendido)}), enquanto ${byTicket[byTicket.length - 1].loja_nome} opera com ticket de ${fmtBRL(byTicket[byTicket.length - 1].ticket_medio_vendido)}.`);
  }
  const byConv = [...rows].sort((a, b) => b.conversao_valor - a.conversao_valor);
  if (byConv[0].conversao_valor > 0) {
    out.push(`${byConv[0].loja_nome} converte ${fmtPct(byConv[0].conversao_valor)} do valor orçado, melhor desempenho de conversão da comparação.`);
  }
  rows.forEach((r) => {
    const alto = (r.faixas?.["100a250"]?.qtd ?? 0) + (r.faixas?.["acima250"]?.qtd ?? 0);
    const baixo = (r.faixas?.["ate25"]?.qtd ?? 0) + (r.faixas?.["25a50"]?.qtd ?? 0);
    if (r.qtd_orcamentos === 0) return;
    const pctAlto = (alto / r.qtd_orcamentos) * 100;
    const pctBaixo = (baixo / r.qtd_orcamentos) * 100;
    if (pctAlto >= 40) {
      out.push(`${r.loja_nome} concentra ${pctAlto.toFixed(0)}% dos orçamentos em projetos acima de R$ 100 mil, indicando atuação em projetos de maior porte.`);
    } else if (pctBaixo >= 60) {
      out.push(`${r.loja_nome} concentra ${pctBaixo.toFixed(0)}% dos orçamentos em projetos de até R$ 50 mil, perfil de maior giro e menor ticket.`);
    }
  });
  const byEsp = [...rows].sort((a, b) => b.especificadores_ativos - a.especificadores_ativos);
  if (byEsp[0].especificadores_ativos > 0 && byEsp[0].especificadores_ativos >= byEsp[byEsp.length - 1].especificadores_ativos * 1.5) {
    out.push(`${byEsp[0].loja_nome} depende mais de especificadores (${byEsp[0].especificadores_ativos} ativos) do que ${byEsp[byEsp.length - 1].loja_nome} (${byEsp[byEsp.length - 1].especificadores_ativos}).`);
  }

  if (clis.length >= 2) {
    const top = [...clis].sort((a, b) => b.recorrencia_pct - a.recorrencia_pct)[0];
    if (top && top.recorrencia_pct > 0) {
      out.push(`${top.loja_nome} tem a maior taxa de recompra de clientes (${fmtPct(top.recorrencia_pct)}), sinal de carteira fidelizada.`);
    }
  }

  if (esps.length >= 2) {
    const dep = [...esps].sort((a, b) => b.dependencia_top5_pct - a.dependencia_top5_pct)[0];
    if (dep && dep.dependencia_top5_pct >= 60) {
      out.push(`${dep.loja_nome} concentra ${fmtPct(dep.dependencia_top5_pct)} do faturamento nos 5 maiores especificadores — risco de dependência.`);
    }
  }

  if (vnds.length >= 2) {
    const dep = [...vnds].sort((a, b) => b.dependencia_top3_pct - a.dependencia_top3_pct)[0];
    if (dep && dep.dependencia_top3_pct >= 70) {
      out.push(`${dep.loja_nome} depende fortemente dos 3 principais vendedores (${fmtPct(dep.dependencia_top3_pct)} do total vendido).`);
    }
  }

  if (prods.length >= 2) {
    const baixa = prods.filter(p => p.cobertura_pct < 30);
    if (baixa.length > 0) {
      out.push(`${baixa.map(p => p.loja_nome).join(", ")} possui baixa cobertura de dados de produto (<30%) — recomenda-se padronizar o preenchimento.`);
    }
  }

  return out;
}

function LojasPicker({
  lojas, selected, onChange,
}: { lojas: Loja[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => lojas.filter((l) => l.nome.toLowerCase().includes(query.toLowerCase())),
    [lojas, query],
  );
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const labels = lojas.filter((l) => selected.includes(l.id)).map((l) => l.nome);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {labels.length === 0 ? "Selecionar lojas" : `${labels.length} loja${labels.length > 1 ? "s" : ""} selecionada${labels.length > 1 ? "s" : ""}`}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <input
          className="w-full mb-2 px-3 py-1.5 text-sm border rounded-md bg-background"
          placeholder="Buscar loja..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ScrollArea className="h-72">
          <div className="space-y-1">
            {filtered.map((l) => (
              <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                <Checkbox checked={selected.includes(l.id)} onCheckedChange={() => toggle(l.id)} />
                <span className="flex-1 truncate">{l.nome}</span>
                <span className="text-xs text-muted-foreground">{labelCanal(l.canal || "")}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">Nenhuma loja</div>
            )}
          </div>
        </ScrollArea>
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
            {labels.map((n) => (
              <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
