import { supabase } from "@/integrations/supabase/client";

export type EspecificadorRow = {
  id: string;
  nome: string;
  ultimo_orcamento: string | null;
  qtd_orcamentos: number;
  qtd_vendas: number;
  valor_orcado: number;
  valor_vendido: number;
  conversao: number;
  ticket_medio: number;
  dias_sem_mov: number;
};

export type Segmento = "ativos" | "em-risco" | "inativos" | "recuperados";

const SEG_RANGES: Record<Segmento, [number, number]> = {
  "ativos": [0, 60],          // mov nos últimos 60 dias
  "em-risco": [60, 180],      // mov 60-180d atrás
  "inativos": [180, 99999],   // > 180 dias
  "recuperados": [0, 60],     // ativos agora + tinham gap >180d antes (heurística no cliente)
};

export async function fetchEspecificadoresSegmentados(segmento: Segmento, lojaId: string | null) {
  let q = supabase
    .from("orcamentos")
    .select("especificador_id,data_orcamento,valor_orcado,valor_vendido,loja_id,especificadores(id,nome)")
    .not("especificador_id", "is", null)
    .order("data_orcamento", { ascending: false })
    .limit(20000);
  if (lojaId) q = q.eq("loja_id", lojaId);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = { especificador_id: string; data_orcamento: string; valor_orcado: number; valor_vendido: number; especificadores: { id: string; nome: string } | null };
  const rows = (data ?? []) as unknown as Raw[];

  const agg = new Map<string, EspecificadorRow & { historico: string[] }>();
  rows.forEach((r) => {
    const id = r.especificador_id;
    const nome = r.especificadores?.nome ?? "—";
    const cur = agg.get(id) ?? {
      id, nome,
      ultimo_orcamento: null,
      qtd_orcamentos: 0, qtd_vendas: 0,
      valor_orcado: 0, valor_vendido: 0,
      conversao: 0, ticket_medio: 0, dias_sem_mov: 99999,
      historico: [],
    };
    cur.qtd_orcamentos++;
    cur.valor_orcado += Number(r.valor_orcado);
    cur.valor_vendido += Number(r.valor_vendido);
    if (Number(r.valor_vendido) > 0) cur.qtd_vendas++;
    if (!cur.ultimo_orcamento || r.data_orcamento > cur.ultimo_orcamento) cur.ultimo_orcamento = r.data_orcamento;
    cur.historico.push(r.data_orcamento);
    agg.set(id, cur);
  });

  const hoje = Date.now();
  const list = [...agg.values()].map((e) => {
    const dias = e.ultimo_orcamento ? Math.floor((hoje - new Date(e.ultimo_orcamento).getTime()) / 86400000) : 99999;
    const conv = e.qtd_orcamentos ? e.qtd_vendas / e.qtd_orcamentos : 0;
    const ticket = e.qtd_vendas ? e.valor_vendido / e.qtd_vendas : 0;
    return { ...e, dias_sem_mov: dias, conversao: conv, ticket_medio: ticket };
  });

  const [min, max] = SEG_RANGES[segmento];
  let filtered = list.filter((e) => e.dias_sem_mov >= min && e.dias_sem_mov < max);

  if (segmento === "recuperados") {
    // Ativos agora (mov < 60d) que tiveram gap >180d em algum momento
    filtered = list.filter((e) => {
      if (e.dias_sem_mov >= 60) return false;
      const sorted = [...e.historico].sort();
      for (let i = 1; i < sorted.length; i++) {
        const gap = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
        if (gap > 180) return true;
      }
      return false;
    });
  }

  filtered.sort((a, b) => b.valor_vendido - a.valor_vendido);
  return filtered;
}
