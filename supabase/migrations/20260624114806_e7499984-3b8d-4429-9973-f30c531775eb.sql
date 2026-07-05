CREATE OR REPLACE FUNCTION public.turnover_vendedores_resumo(p_inicio date, p_fim date, p_loja uuid DEFAULT NULL::uuid)
 RETURNS TABLE(vendedor_id uuid, nome text, ativo boolean, loja_id uuid, loja_nome text, ultima_atividade date, meses_inativo integer, carteira_especificadores integer, total_orcado numeric, total_vendido numeric, conversao_pct numeric, status text, evento_data date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meses_pausa integer;
BEGIN
  SELECT COALESCE(meses_pausa, 3) INTO v_meses_pausa
  FROM public.turnover_parametros LIMIT 1;
  IF v_meses_pausa IS NULL THEN v_meses_pausa := 3; END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      v.id AS v_id,
      v.nome AS v_nome,
      v.ativo AS v_ativo,
      v.loja_id AS v_loja_id,
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
    SELECT o.vendedor_id AS v_id, MAX(o.data_orcamento) AS ultima
    FROM public.orcamentos o
    WHERE o.vendedor_id IS NOT NULL
    GROUP BY o.vendedor_id
  )
  SELECT
    a.v_id,
    a.v_nome,
    a.v_ativo,
    a.v_loja_id,
    l.nome,
    COALESCE(a.ultima_atividade, u.ultima),
    CASE
      WHEN COALESCE(a.ultima_atividade, u.ultima) IS NULL THEN NULL
      ELSE GREATEST(0, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima)))*12
        + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima))))::integer)
    END,
    a.carteira::integer,
    a.total_orcado,
    a.total_vendido,
    CASE WHEN a.total_orcado > 0 THEN ROUND((a.total_vendido / a.total_orcado) * 100, 2) ELSE 0 END,
    CASE
      WHEN a.v_ativo = false THEN 'saida_confirmada'
      WHEN COALESCE(a.ultima_atividade, u.ultima) IS NULL THEN 'sem_atividade'
      WHEN (EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima)))*12
            + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima))))::integer >= v_meses_pausa
        THEN 'afastamento_temporario'
      ELSE 'ativo'
    END,
    CASE
      WHEN a.v_ativo = false OR
           (COALESCE(a.ultima_atividade, u.ultima) IS NOT NULL
            AND (EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima)))*12
                 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, COALESCE(a.ultima_atividade, u.ultima))))::integer >= v_meses_pausa)
        THEN COALESCE(a.ultima_atividade, u.ultima)
      ELSE NULL
    END
  FROM agg a
  LEFT JOIN ultima_geral u ON u.v_id = a.v_id
  LEFT JOIN public.lojas l ON l.id = a.v_loja_id
  ORDER BY a.v_nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.turnover_vendedores_resumo(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.turnover_vendedores_resumo(date, date, uuid) TO authenticated;