import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  escopo?: "global" | "loja" | "vendedor";
  escopo_id?: string | null;
  horizonte_meses?: number;
};

type Ponto = { mes: string; valor: number; qtd: number };
type Projecao = { mes: string; previsto: number; otimista: number; pessimista: number; real: number | null };

function regLinear(points: number[]): { a: number; b: number } {
  const n = points.length;
  if (n < 2) return { a: points[0] ?? 0, b: 0 };
  const xs = points.map((_, i) => i);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = points.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (points[i] - my); den += (xs[i] - mx) ** 2; }
  const b = den === 0 ? 0 : num / den;
  return { a: my - b * mx, b };
}

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export const gerarForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const escopo = data.escopo ?? "global";
    const horizonte = Math.max(1, Math.min(12, data.horizonte_meses ?? 3));

    let q = supabase.from("vendas_mensais").select("mes,loja_id,vendedor_id,valor,qtd");
    if (escopo === "loja" && data.escopo_id) q = q.eq("loja_id", data.escopo_id);
    if (escopo === "vendedor" && data.escopo_id) q = q.eq("vendedor_id", data.escopo_id);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Agrega por mês
    const map = new Map<string, Ponto>();
    (rows ?? []).forEach((r) => {
      if (!r.mes) return;
      const k = r.mes;
      const cur = map.get(k) ?? { mes: k, valor: 0, qtd: 0 };
      cur.valor += Number(r.valor ?? 0);
      cur.qtd += Number(r.qtd ?? 0);
      map.set(k, cur);
    });
    const historico = Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));

    if (historico.length < 2) {
      return { historico, projecao: [] as Projecao[], mape: null, msg: "Histórico insuficiente (mínimo 2 meses)" };
    }

    // Regressão sobre os últimos 12 meses
    const base = historico.slice(-12);
    const valores = base.map((p) => p.valor);
    const { a, b } = regLinear(valores);

    // Sazonalidade: razão do mesmo mês do ano anterior vs média anual
    const sazonalidade = new Map<number, number>();
    const porMes = new Map<number, number[]>();
    historico.forEach((p) => {
      const m = new Date(p.mes + "T00:00:00Z").getUTCMonth();
      const arr = porMes.get(m) ?? [];
      arr.push(p.valor);
      porMes.set(m, arr);
    });
    const mediaGeral = valores.reduce((s, v) => s + v, 0) / valores.length;
    porMes.forEach((arr, m) => {
      const med = arr.reduce((s, v) => s + v, 0) / arr.length;
      sazonalidade.set(m, mediaGeral > 0 ? med / mediaGeral : 1);
    });

    // Erro padrão para banda
    const previstos = valores.map((_, i) => a + b * i);
    const residuos = valores.map((v, i) => v - previstos[i]);
    const sd = Math.sqrt(residuos.reduce((s, r) => s + r * r, 0) / residuos.length);

    const ultimoMes = historico[historico.length - 1].mes;
    const projecao: Projecao[] = [];
    for (let i = 1; i <= horizonte; i++) {
      const mes = addMonths(ultimoMes, i);
      const idx = valores.length - 1 + i;
      const tendencia = a + b * idx;
      const fator = sazonalidade.get(new Date(mes + "T00:00:00Z").getUTCMonth()) ?? 1;
      const previsto = Math.max(0, tendencia * fator);
      projecao.push({
        mes,
        previsto: Math.round(previsto),
        otimista: Math.round(previsto + 1.5 * sd),
        pessimista: Math.max(0, Math.round(previsto - 1.5 * sd)),
        real: null,
      });
    }

    // Acurácia: compara forecast anterior com vendas reais
    let antQuery = supabase.from("forecasts")
      .select("resultado").eq("escopo", escopo);
    antQuery = data.escopo_id ? antQuery.eq("escopo_id", data.escopo_id) : antQuery.is("escopo_id", null);
    const { data: ant } = await antQuery.order("gerado_em", { ascending: false }).limit(1).maybeSingle();
    let mape: number | null = null;
    if (ant?.resultado) {
      const prev = ant.resultado as Projecao[];
      const erros: number[] = [];
      prev.forEach((p) => {
        const real = map.get(p.mes)?.valor;
        if (real && p.previsto > 0) erros.push(Math.abs(real - p.previsto) / real);
      });
      if (erros.length > 0) mape = (erros.reduce((s, v) => s + v, 0) / erros.length) * 100;
    }

    // Salva snapshot
    await supabase.from("forecasts").insert({
      gerado_por: userId,
      escopo, escopo_id: data.escopo_id ?? null,
      horizonte_meses: horizonte,
      resultado: projecao as never,
      mape,
    });

    return { historico, projecao, mape, msg: null };
  });
