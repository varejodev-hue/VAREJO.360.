
CREATE OR REPLACE FUNCTION public.turnover_eventos_carteira(
  p_inicio date,
  p_fim date,
  p_loja uuid DEFAULT NULL
)
RETURNS TABLE (
  vendedor_id uuid,
  vendedor_nome text,
  evento_data date,
  status_vendedor text,
  especificador_id uuid,
  especificador_nome text,
  valor_antes numeric,
  valor_depois numeric,
  orcado_antes numeric,
  orcado_depois numeric,
  vendedor_depois_id uuid,
  vendedor_depois_nome text,
  loja_depois_id uuid,
  loja_depois_nome text,
  mesma_loja boolean,
  mesmo_vendedor boolean,
  classificacao text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meses_pausa integer;
  v_janela_vp integer;
  v_janela_cmp integer;
  v_tol numeric;
  v_sem numeric;
  v_parcial_max numeric;
BEGIN
  SELECT meses_pausa, janela_vendedor_principal_meses, janela_comparacao_meses,
         tolerancia_recuperacao_total_pct, sem_recuperacao_max_pct, recuperacao_parcial_max_pct
    INTO v_meses_pausa, v_janela_vp, v_janela_cmp, v_tol, v_sem, v_parcial_max
  FROM public.turnover_parametros LIMIT 1;

  v_meses_pausa := COALESCE(v_meses_pausa, 3);
  v_janela_vp := COALESCE(v_janela_vp, 6);
  v_janela_cmp := COALESCE(v_janela_cmp, 6);
  v_tol := COALESCE(v_tol, -5);
  v_sem := COALESCE(v_sem, 50);
  v_parcial_max := COALESCE(v_parcial_max, 95);

  RETURN QUERY
  WITH ultima AS (
    SELECT o.vendedor_id, MAX(o.data_orcamento) AS ult
    FROM public.orcamentos o
    WHERE o.vendedor_id IS NOT NULL
    GROUP BY o.vendedor_id
  ),
  eventos AS (
    SELECT v.id AS vendedor_id, v.nome AS vendedor_nome, u.ult AS evento_data,
      CASE WHEN v.ativo = false THEN 'saida_confirmada' ELSE 'afastamento_temporario' END AS status_vendedor,
      v.loja_id AS loja_origem_id
    FROM public.vendedores v
    JOIN ultima u ON u.vendedor_id = v.id
    WHERE u.ult BETWEEN p_inicio AND p_fim
      AND (
        v.ativo = false
        OR (EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.ult))*12
            + EXTRACT(MONTH FROM AGE(CURRENT_DATE, u.ult)))::integer >= v_meses_pausa
      )
  ),
  carteira AS (
    SELECT e.vendedor_id, e.vendedor_nome, e.evento_data, e.status_vendedor, e.loja_origem_id,
      o.especificador_id
    FROM eventos e
    JOIN public.orcamentos o
      ON o.vendedor_id = e.vendedor_id
     AND o.especificador_id IS NOT NULL
     AND o.data_orcamento BETWEEN (e.evento_data - (v_janela_vp || ' months')::interval)::date AND e.evento_data
     AND (p_loja IS NULL OR o.loja_id = p_loja)
    GROUP BY e.vendedor_id, e.vendedor_nome, e.evento_data, e.status_vendedor, e.loja_origem_id, o.especificador_id
  ),
  periodos AS (
    SELECT c.*,
      (c.evento_data - (v_janela_cmp || ' months')::interval)::date AS antes_ini,
      c.evento_data AS antes_fim,
      (c.evento_data + INTERVAL '1 day')::date AS depois_ini,
      LEAST(CURRENT_DATE, (c.evento_data + (v_janela_cmp || ' months')::interval)::date) AS depois_fim
    FROM carteira c
  ),
  antes AS (
    SELECT p.vendedor_id, p.especificador_id,
      COALESCE(SUM(o.valor_vendido),0) AS v_antes,
      COALESCE(SUM(o.valor_orcado),0) AS o_antes
    FROM periodos p
    LEFT JOIN public.orcamentos o
      ON o.especificador_id = p.especificador_id
     AND o.vendedor_id = p.vendedor_id
     AND o.data_orcamento BETWEEN p.antes_ini AND p.antes_fim
     AND (p_loja IS NULL OR o.loja_id = p_loja)
    GROUP BY p.vendedor_id, p.especificador_id
  ),
  depois AS (
    SELECT p.vendedor_id, p.especificador_id,
      COALESCE(SUM(o.valor_vendido),0) AS v_depois,
      COALESCE(SUM(o.valor_orcado),0) AS o_depois
    FROM periodos p
    LEFT JOIN public.orcamentos o
      ON o.especificador_id = p.especificador_id
     AND o.data_orcamento BETWEEN p.depois_ini AND p.depois_fim
     AND (p_loja IS NULL OR o.loja_id = p_loja)
    GROUP BY p.vendedor_id, p.especificador_id
  ),
  dom_depois AS (
    SELECT s.vendedor_id, s.especificador_id, s.new_vendedor_id, s.new_loja_id
    FROM (
      SELECT p.vendedor_id, p.especificador_id,
        o.vendedor_id AS new_vendedor_id, o.loja_id AS new_loja_id,
        SUM(COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado)) AS w,
        ROW_NUMBER() OVER (
          PARTITION BY p.vendedor_id, p.especificador_id
          ORDER BY SUM(COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado)) DESC
        ) AS rn
      FROM periodos p
      JOIN public.orcamentos o
        ON o.especificador_id = p.especificador_id
       AND o.data_orcamento BETWEEN p.depois_ini AND p.depois_fim
       AND o.vendedor_id IS NOT NULL
       AND (p_loja IS NULL OR o.loja_id = p_loja)
      GROUP BY p.vendedor_id, p.especificador_id, o.vendedor_id, o.loja_id
    ) s
    WHERE s.rn = 1
  )
  SELECT
    p.vendedor_id,
    p.vendedor_nome,
    p.evento_data,
    p.status_vendedor,
    p.especificador_id,
    e.nome,
    COALESCE(a.v_antes, 0),
    COALESCE(d.v_depois, 0),
    COALESCE(a.o_antes, 0),
    COALESCE(d.o_depois, 0),
    dd.new_vendedor_id,
    vn.nome,
    dd.new_loja_id,
    ln.nome,
    (dd.new_loja_id IS NOT NULL AND p.loja_origem_id IS NOT NULL AND dd.new_loja_id = p.loja_origem_id),
    (dd.new_vendedor_id IS NOT NULL AND dd.new_vendedor_id = p.vendedor_id),
    CASE
      WHEN COALESCE(d.v_depois,0) = 0 AND COALESCE(a.v_antes,0) = 0 THEN 'sem_base'
      WHEN COALESCE(a.v_antes,0) = 0 THEN 'sem_base'
      WHEN COALESCE(d.v_depois,0) >= COALESCE(a.v_antes,0) * (1 + v_tol/100.0) THEN 'recuperacao_total'
      WHEN COALESCE(d.v_depois,0) >= COALESCE(a.v_antes,0) * (v_sem/100.0) THEN 'recuperacao_parcial'
      ELSE 'sem_recuperacao'
    END
  FROM periodos p
  LEFT JOIN public.especificadores e ON e.id = p.especificador_id
  LEFT JOIN antes a ON a.vendedor_id = p.vendedor_id AND a.especificador_id = p.especificador_id
  LEFT JOIN depois d ON d.vendedor_id = p.vendedor_id AND d.especificador_id = p.especificador_id
  LEFT JOIN dom_depois dd ON dd.vendedor_id = p.vendedor_id AND dd.especificador_id = p.especificador_id
  LEFT JOIN public.vendedores vn ON vn.id = dd.new_vendedor_id
  LEFT JOIN public.lojas ln ON ln.id = dd.new_loja_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.turnover_eventos_carteira(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.turnover_grupo_controle(
  p_inicio date,
  p_fim date,
  p_loja uuid DEFAULT NULL
)
RETURNS TABLE (
  vendedores_ativos integer,
  especificadores integer,
  valor_antes numeric,
  valor_depois numeric,
  delta_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meses_pausa integer;
  v_meio date;
BEGIN
  SELECT COALESCE(meses_pausa, 3) INTO v_meses_pausa FROM public.turnover_parametros LIMIT 1;
  v_meses_pausa := COALESCE(v_meses_pausa, 3);
  v_meio := (p_inicio + ((p_fim - p_inicio)/2))::date;

  RETURN QUERY
  WITH ultima AS (
    SELECT o.vendedor_id, MAX(o.data_orcamento) AS ult
    FROM public.orcamentos o
    WHERE o.vendedor_id IS NOT NULL GROUP BY o.vendedor_id
  ),
  ativos AS (
    SELECT v.id AS vendedor_id
    FROM public.vendedores v
    LEFT JOIN ultima u ON u.vendedor_id = v.id
    WHERE v.ativo = true
      AND (u.ult IS NULL OR
        (EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.ult))*12
         + EXTRACT(MONTH FROM AGE(CURRENT_DATE, u.ult)))::integer < v_meses_pausa)
  ),
  base AS (
    SELECT o.especificador_id,
      SUM(o.valor_vendido) FILTER (WHERE o.data_orcamento BETWEEN p_inicio AND v_meio) AS v_antes,
      SUM(o.valor_vendido) FILTER (WHERE o.data_orcamento >  v_meio AND o.data_orcamento <= p_fim) AS v_depois
    FROM public.orcamentos o
    JOIN ativos a ON a.vendedor_id = o.vendedor_id
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
      AND (p_loja IS NULL OR o.loja_id = p_loja)
    GROUP BY o.especificador_id
  )
  SELECT
    (SELECT count(*) FROM ativos)::integer,
    (SELECT count(*) FROM base)::integer,
    COALESCE(SUM(v_antes), 0),
    COALESCE(SUM(v_depois), 0),
    CASE WHEN COALESCE(SUM(v_antes),0) > 0
      THEN ROUND(((COALESCE(SUM(v_depois),0) - COALESCE(SUM(v_antes),0)) / SUM(v_antes)) * 100, 2)
      ELSE 0 END
  FROM base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.turnover_grupo_controle(date, date, uuid) TO authenticated;
