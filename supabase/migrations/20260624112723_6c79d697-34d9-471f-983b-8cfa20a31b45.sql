
CREATE OR REPLACE FUNCTION public.turnover_vendedores_resumo(
  p_inicio date,
  p_fim date,
  p_loja uuid DEFAULT NULL
)
RETURNS TABLE (
  vendedor_id uuid,
  nome text,
  ativo boolean,
  loja_id uuid,
  loja_nome text,
  ultima_atividade date,
  meses_inativo integer,
  carteira_especificadores integer,
  total_orcado numeric,
  total_vendido numeric,
  conversao_pct numeric,
  status text,
  evento_data date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meses_pausa integer;
BEGIN
  SELECT COALESCE(meses_pausa, 3) INTO v_meses_pausa
  FROM public.turnover_parametros LIMIT 1;
  IF v_meses_pausa IS NULL THEN v_meses_pausa := 3; END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      v.id AS vendedor_id,
      v.nome,
      v.ativo,
      v.loja_id,
      MAX(o.data_orcamento) AS ultima_atividade,
      COUNT(DISTINCT o.especificador_id) FILTER (WHERE o.especificador_id IS NOT NULL) AS carteira,
      COALESCE(SUM(o.valor_orcado), 0) AS total_orcado,
      COALESCE(SUM(o.valor_vendido), 0) AS total_vendido
    FROM public.vendedores v
    LEFT JOIN public.orcamentos o
      ON o.vendedor_id = v.id
     AND o.data_orcamento BETWEEN p_inicio AND p_fim
     AND (p_loja IS NULL OR o.loja_id = p_loja)
    GROUP BY v.id, v.nome, v.ativo, v.loja_id
  ),
  ultima_geral AS (
    SELECT vendedor_id, MAX(data_orcamento) AS ultima
    FROM public.orcamentos
    WHERE vendedor_id IS NOT NULL
    GROUP BY vendedor_id
  )
  SELECT
    a.vendedor_id,
    a.nome,
    a.ativo,
    a.loja_id,
    l.nome AS loja_nome,
    COALESCE(a.ultima_atividade, u.ultima) AS ultima_atividade,
    CASE
      WHEN COALESCE(a.ultima_atividade, u.ultima) IS NULL THEN NULL
      ELSE GREATEST(0, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima)))*12
        + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima))))::integer)
    END AS meses_inativo,
    a.carteira::integer,
    a.total_orcado,
    a.total_vendido,
    CASE WHEN a.total_orcado > 0 THEN ROUND((a.total_vendido / a.total_orcado) * 100, 2) ELSE 0 END AS conversao_pct,
    CASE
      WHEN a.ativo = false THEN 'saida_confirmada'
      WHEN COALESCE(a.ultima_atividade, u.ultima) IS NULL THEN 'sem_atividade'
      WHEN (EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima)))*12
            + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima))))::integer >= v_meses_pausa
        THEN 'afastamento_temporario'
      ELSE 'ativo'
    END AS status,
    CASE
      WHEN a.ativo = false OR
           (COALESCE(a.ultima_atividade, u.ultima) IS NOT NULL
            AND (EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima)))*12
                 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima))))::integer >= v_meses_pausa)
        THEN COALESCE(a.ultima_atividade, u.ultima)
      ELSE NULL
    END AS evento_data
  FROM agg a
  LEFT JOIN ultima_geral u ON u.vendedor_id = a.vendedor_id
  LEFT JOIN public.lojas l ON l.id = a.loja_id
  ORDER BY a.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.turnover_vendedores_resumo(date, date, uuid) TO authenticated;

-- Vínculo especificador → vendedor principal numa janela
CREATE OR REPLACE FUNCTION public.turnover_especificador_vendedor_principal(
  p_referencia date,
  p_janela_meses integer
)
RETURNS TABLE (
  especificador_id uuid,
  vendedor_id uuid,
  valor_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      o.especificador_id,
      o.vendedor_id,
      SUM(COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado)) AS valor
    FROM public.orcamentos o
    WHERE o.especificador_id IS NOT NULL
      AND o.vendedor_id IS NOT NULL
      AND o.data_orcamento BETWEEN (p_referencia - (p_janela_meses || ' months')::interval)::date AND p_referencia
    GROUP BY o.especificador_id, o.vendedor_id
  ),
  ranked AS (
    SELECT especificador_id, vendedor_id, valor,
           ROW_NUMBER() OVER (PARTITION BY especificador_id ORDER BY valor DESC) AS rn
    FROM base
  )
  SELECT especificador_id, vendedor_id, valor
  FROM ranked
  WHERE rn = 1;
$$;

GRANT EXECUTE ON FUNCTION public.turnover_especificador_vendedor_principal(date, integer) TO authenticated;
