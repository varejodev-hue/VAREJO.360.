CREATE OR REPLACE FUNCTION public.carteira_por_loja(p_inicio date DEFAULT ((CURRENT_DATE - '180 days'::interval))::date, p_fim date DEFAULT CURRENT_DATE)
RETURNS TABLE(loja_id uuid, loja_nome text, canal text, qtd_vendedores integer, qtd_especificadores integer, qtd_ativos integer, qtd_risco integer, qtd_inativos integer, valor_orcado numeric, valor_vendido numeric, conversao_pct numeric, ticket_medio numeric, ultimo_contato date)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  esp AS (
    SELECT e.* FROM public.especificadores e, scope s
    WHERE e.loja_responsavel_id IS NOT NULL
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
  ),
  agg AS (
    SELECT e.loja_responsavel_id AS l_id,
      COUNT(*)::int AS qtd,
      COUNT(*) FILTER (WHERE e.status_carteira='ativo')::int AS qtd_a,
      COUNT(*) FILTER (WHERE e.status_carteira='em_risco')::int AS qtd_r,
      COUNT(*) FILTER (WHERE e.status_carteira='inativo')::int AS qtd_i,
      COUNT(DISTINCT e.vendedor_responsavel_id) FILTER (WHERE e.vendedor_responsavel_id IS NOT NULL)::int AS qtd_v
    FROM esp e GROUP BY e.loja_responsavel_id
  ),
  orc AS (
    SELECT e.loja_responsavel_id AS l_id,
      COALESCE(SUM(o.valor_orcado),0) AS v_orc,
      COALESCE(SUM(o.valor_vendido),0) AS v_vnd,
      COUNT(*) FILTER (WHERE COALESCE(o.valor_vendido,0)>0)::int AS qtd_vnd,
      MAX(o.data_orcamento) AS ult
    FROM esp e
    LEFT JOIN public.orcamentos o ON o.especificador_id = e.id
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
    GROUP BY e.loja_responsavel_id
  )
  SELECT
    l.id, l.nome, l.canal::text,
    COALESCE(a.qtd_v,0), COALESCE(a.qtd,0), COALESCE(a.qtd_a,0), COALESCE(a.qtd_r,0), COALESCE(a.qtd_i,0),
    COALESCE(o.v_orc,0), COALESCE(o.v_vnd,0),
    CASE WHEN COALESCE(a.qtd,0)>0 THEN ROUND((COALESCE(o.qtd_vnd,0)::numeric / a.qtd)*100, 2) ELSE 0 END,
    CASE WHEN COALESCE(o.qtd_vnd,0)>0 THEN ROUND(o.v_vnd / o.qtd_vnd, 2) ELSE 0 END,
    o.ult
  FROM public.lojas l
  JOIN agg a ON a.l_id = l.id
  LEFT JOIN orc o ON o.l_id = l.id
  ORDER BY COALESCE(o.v_vnd,0) DESC, l.nome;
END;
$function$;