
-- Fase 1: RPC de análise de conversão dos especificadores
CREATE OR REPLACE FUNCTION public.especificadores_conversao_analise(
  p_inicio date,
  p_fim date,
  p_loja uuid DEFAULT NULL,
  p_tipo_mov text DEFAULT 'todos' -- todos | orcamento | venda | conversao
)
RETURNS TABLE(
  especificador_id uuid,
  nome text,
  loja_id uuid,
  loja_nome text,
  vendedor_atual_id uuid,
  vendedor_atual_nome text,
  vendedor_anterior_id uuid,
  vendedor_anterior_nome text,
  trocou_vendedor boolean,
  qtd_orcamentos integer,
  qtd_vendas integer,
  valor_orcado numeric,
  valor_vendido numeric,
  conversao_valor_pct numeric,
  conversao_qtd_pct numeric,
  ticket_medio numeric,
  ultima_mov_data date,
  ultima_mov_tipo text,
  ultima_mov_valor numeric,
  dias_sem_mov integer,
  tempo_medio_orc_venda numeric,
  delta_valor_pct numeric,
  classificacao text,
  alerta_baixa_conversao boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias integer := GREATEST(1, (p_fim - p_inicio));
  v_ant_ini date := (p_inicio - v_dias)::date;
  v_ant_fim date := (p_inicio - 1)::date;
BEGIN
  RETURN QUERY
  WITH scope AS (
    SELECT public.user_is_global(auth.uid()) AS is_global
  ),
  base AS (
    SELECT o.*,
      COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado) AS v_ref
    FROM public.orcamentos o, scope s
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
      AND (p_loja IS NULL OR o.loja_id = p_loja)
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
  ),
  ant AS (
    SELECT o.especificador_id, SUM(COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado)) AS v_ant
    FROM public.orcamentos o, scope s
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento BETWEEN v_ant_ini AND v_ant_fim
      AND (p_loja IS NULL OR o.loja_id = p_loja)
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
    GROUP BY o.especificador_id
  ),
  agg AS (
    SELECT
      b.especificador_id,
      COUNT(*) AS qtd_orc,
      COUNT(*) FILTER (WHERE COALESCE(b.valor_vendido,0) > 0) AS qtd_vnd,
      SUM(COALESCE(b.valor_orcado,0)) AS v_orc,
      SUM(COALESCE(b.valor_vendido,0)) AS v_vnd,
      AVG(CASE WHEN b.data_venda IS NOT NULL THEN (b.data_venda - b.data_orcamento) END) AS dias_orc_venda,
      MAX(b.data_orcamento) AS ult_orc,
      MAX(b.data_venda) AS ult_vnd
    FROM base b GROUP BY b.especificador_id
  ),
  ult_mov_geral AS (
    SELECT o.especificador_id, MAX(o.data_orcamento) AS ult
    FROM public.orcamentos o
    WHERE o.especificador_id IS NOT NULL
    GROUP BY o.especificador_id
  ),
  ult_orc_row AS (
    SELECT DISTINCT ON (o.especificador_id)
      o.especificador_id, o.data_orcamento AS d, COALESCE(o.valor_orcado,0) AS v,
      'orcamento'::text AS tipo, o.vendedor_id, o.loja_id
    FROM public.orcamentos o, scope s
    WHERE o.especificador_id IS NOT NULL
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
    ORDER BY o.especificador_id, o.data_orcamento DESC
  ),
  ult_vnd_row AS (
    SELECT DISTINCT ON (o.especificador_id)
      o.especificador_id, o.data_venda AS d, COALESCE(o.valor_vendido,0) AS v,
      'venda'::text AS tipo, o.vendedor_id, o.loja_id
    FROM public.orcamentos o, scope s
    WHERE o.especificador_id IS NOT NULL
      AND o.data_venda IS NOT NULL AND COALESCE(o.valor_vendido,0) > 0
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
    ORDER BY o.especificador_id, o.data_venda DESC
  ),
  ult_mov AS (
    SELECT
      e.id AS esp_id,
      CASE
        WHEN p_tipo_mov = 'orcamento' THEN uo.d
        WHEN p_tipo_mov IN ('venda','conversao') THEN uv.d
        ELSE GREATEST(COALESCE(uo.d,'1900-01-01'::date), COALESCE(uv.d,'1900-01-01'::date))
      END AS d,
      CASE
        WHEN p_tipo_mov = 'orcamento' THEN 'orcamento'
        WHEN p_tipo_mov IN ('venda','conversao') THEN 'venda'
        WHEN COALESCE(uv.d,'1900-01-01'::date) >= COALESCE(uo.d,'1900-01-01'::date)
          AND uv.d IS NOT NULL THEN 'venda'
        ELSE 'orcamento'
      END AS tipo,
      CASE
        WHEN p_tipo_mov = 'orcamento' THEN uo.v
        WHEN p_tipo_mov IN ('venda','conversao') THEN uv.v
        WHEN COALESCE(uv.d,'1900-01-01'::date) >= COALESCE(uo.d,'1900-01-01'::date)
          AND uv.d IS NOT NULL THEN uv.v
        ELSE uo.v
      END AS valor,
      COALESCE(uv.vendedor_id, uo.vendedor_id) AS vend_atual,
      COALESCE(uv.loja_id, uo.loja_id) AS loja_atual
    FROM public.especificadores e
    LEFT JOIN ult_orc_row uo ON uo.especificador_id = e.id
    LEFT JOIN ult_vnd_row uv ON uv.especificador_id = e.id
  ),
  vend_hist AS (
    SELECT
      o.especificador_id,
      o.vendedor_id,
      MAX(o.data_orcamento) AS ult,
      ROW_NUMBER() OVER (PARTITION BY o.especificador_id ORDER BY MAX(o.data_orcamento) DESC) AS rn
    FROM public.orcamentos o
    WHERE o.especificador_id IS NOT NULL AND o.vendedor_id IS NOT NULL
    GROUP BY o.especificador_id, o.vendedor_id
  ),
  vend_atual AS (SELECT especificador_id, vendedor_id FROM vend_hist WHERE rn = 1),
  vend_ant   AS (SELECT especificador_id, vendedor_id FROM vend_hist WHERE rn = 2),
  top_orc AS (
    SELECT NTILE(4) OVER (ORDER BY v_orc DESC) AS quartil, especificador_id
    FROM agg WHERE v_orc > 0
  )
  SELECT
    e.id,
    e.nome,
    um.loja_atual,
    l.nome,
    va.vendedor_id,
    vna.nome,
    vp.vendedor_id,
    vnp.nome,
    (va.vendedor_id IS NOT NULL AND vp.vendedor_id IS NOT NULL AND va.vendedor_id <> vp.vendedor_id),
    COALESCE(a.qtd_orc,0)::int,
    COALESCE(a.qtd_vnd,0)::int,
    COALESCE(a.v_orc,0),
    COALESCE(a.v_vnd,0),
    CASE WHEN COALESCE(a.v_orc,0) > 0 THEN ROUND((a.v_vnd/a.v_orc)*100,2) ELSE 0 END,
    CASE WHEN COALESCE(a.qtd_orc,0) > 0 THEN ROUND((a.qtd_vnd::numeric/a.qtd_orc)*100,2) ELSE 0 END,
    CASE WHEN COALESCE(a.qtd_vnd,0) > 0 THEN ROUND(a.v_vnd/a.qtd_vnd,2) ELSE 0 END,
    NULLIF(um.d, '1900-01-01'::date),
    um.tipo,
    COALESCE(um.valor,0),
    CASE WHEN um.d IS NOT NULL AND um.d <> '1900-01-01'::date
         THEN (CURRENT_DATE - um.d)::int ELSE NULL END,
    ROUND(COALESCE(a.dias_orc_venda,0),1),
    CASE WHEN COALESCE(an.v_ant,0) > 0
         THEN ROUND(((COALESCE(a.v_vnd,0) - an.v_ant)/an.v_ant)*100,2)
         ELSE 0 END,
    CASE
      WHEN (um.d IS NULL OR um.d = '1900-01-01'::date
            OR (CURRENT_DATE - um.d) > 90) THEN 'inativo'
      WHEN COALESCE(an.v_ant,0) > 0
           AND ((COALESCE(a.v_vnd,0) - an.v_ant)/an.v_ant) <= -0.30 THEN 'em_risco'
      WHEN tq.quartil = 1 AND COALESCE(a.v_orc,0) > 0
           AND (a.v_vnd/a.v_orc) >= 0.40 THEN 'alto_potencial'
      WHEN tq.quartil = 1 AND COALESCE(a.v_orc,0) > 0
           AND (a.v_vnd/a.v_orc) < 0.20 THEN 'potencial_nao_explorado'
      WHEN COALESCE(a.qtd_orc,0) <= 2 THEN 'baixa_atividade'
      WHEN COALESCE(a.v_orc,0) > 0 AND (a.v_vnd/a.v_orc) >= 0.40 THEN 'alto_potencial'
      WHEN COALESCE(a.v_orc,0) > 0 AND (a.v_vnd/a.v_orc) < 0.20 THEN 'potencial_nao_explorado'
      ELSE 'estavel'
    END,
    (tq.quartil = 1 AND COALESCE(a.v_orc,0) > 0 AND (a.v_vnd/a.v_orc) < 0.20)
  FROM public.especificadores e
  LEFT JOIN agg a ON a.especificador_id = e.id
  LEFT JOIN ant an ON an.especificador_id = e.id
  LEFT JOIN ult_mov um ON um.esp_id = e.id
  LEFT JOIN top_orc tq ON tq.especificador_id = e.id
  LEFT JOIN vend_atual va ON va.especificador_id = e.id
  LEFT JOIN vend_ant vp ON vp.especificador_id = e.id
  LEFT JOIN public.vendedores vna ON vna.id = va.vendedor_id
  LEFT JOIN public.vendedores vnp ON vnp.id = vp.vendedor_id
  LEFT JOIN public.lojas l ON l.id = um.loja_atual
  WHERE COALESCE(a.qtd_orc,0) > 0
    AND (
      p_tipo_mov = 'todos'
      OR (p_tipo_mov = 'orcamento')
      OR (p_tipo_mov = 'venda' AND COALESCE(a.qtd_vnd,0) > 0)
      OR (p_tipo_mov = 'conversao' AND COALESCE(a.qtd_vnd,0) > 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.especificadores_conversao_analise(date, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.especificadores_conversao_analise(date, date, uuid, text) TO authenticated, service_role;
