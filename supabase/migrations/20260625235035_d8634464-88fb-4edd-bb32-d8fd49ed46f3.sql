
CREATE OR REPLACE FUNCTION public.lojas_perfil_comparativo(
  p_inicio date,
  p_fim date,
  p_lojas uuid[]
)
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  canal text,
  qtd_orcamentos integer,
  qtd_vendas integer,
  valor_orcado numeric,
  valor_vendido numeric,
  conversao_qtd numeric,
  conversao_valor numeric,
  ticket_medio_vendido numeric,
  ticket_medio_orcado numeric,
  especificadores_ativos integer,
  vendedores_ativos integer,
  clientes_unicos integer,
  faixas jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      o.loja_id,
      o.especificador_id,
      o.vendedor_id,
      o.cliente_id,
      COALESCE(o.valor_orcado, 0) AS v_orc,
      COALESCE(o.valor_vendido, 0) AS v_vnd,
      (COALESCE(o.valor_vendido, 0) > 0) AS vendido,
      CASE
        WHEN COALESCE(o.valor_orcado, 0) < 25000 THEN 'ate25'
        WHEN COALESCE(o.valor_orcado, 0) < 50000 THEN '25a50'
        WHEN COALESCE(o.valor_orcado, 0) < 100000 THEN '50a100'
        WHEN COALESCE(o.valor_orcado, 0) < 250000 THEN '100a250'
        ELSE 'acima250'
      END AS faixa
    FROM public.orcamentos o
    WHERE o.loja_id = ANY(p_lojas)
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  por_faixa AS (
    SELECT
      b.loja_id, b.faixa,
      COUNT(*) AS qtd,
      COUNT(*) FILTER (WHERE b.vendido) AS qtd_vnd,
      SUM(b.v_orc) AS v_orc,
      SUM(b.v_vnd) AS v_vnd
    FROM base b
    GROUP BY b.loja_id, b.faixa
  ),
  faixa_json AS (
    SELECT
      pf.loja_id,
      jsonb_object_agg(pf.faixa, jsonb_build_object(
        'qtd', pf.qtd,
        'qtd_vendas', pf.qtd_vnd,
        'valor_orcado', pf.v_orc,
        'valor_vendido', pf.v_vnd,
        'conversao_qtd', CASE WHEN pf.qtd > 0 THEN ROUND((pf.qtd_vnd::numeric / pf.qtd) * 100, 2) ELSE 0 END,
        'conversao_valor', CASE WHEN pf.v_orc > 0 THEN ROUND((pf.v_vnd / pf.v_orc) * 100, 2) ELSE 0 END
      )) AS faixas
    FROM por_faixa pf
    GROUP BY pf.loja_id
  ),
  agg AS (
    SELECT
      b.loja_id,
      COUNT(*) AS qtd,
      COUNT(*) FILTER (WHERE b.vendido) AS qtd_vnd,
      SUM(b.v_orc) AS v_orc,
      SUM(b.v_vnd) AS v_vnd,
      COUNT(DISTINCT b.especificador_id) FILTER (WHERE b.especificador_id IS NOT NULL) AS n_esp,
      COUNT(DISTINCT b.vendedor_id) FILTER (WHERE b.vendedor_id IS NOT NULL) AS n_vnd,
      COUNT(DISTINCT b.cliente_id) FILTER (WHERE b.cliente_id IS NOT NULL) AS n_cli
    FROM base b
    GROUP BY b.loja_id
  )
  SELECT
    l.id,
    l.nome,
    CASE WHEN l.canal = 'nao_classificado'::canal_tipo THEN 'loja_propria' ELSE l.canal::text END,
    COALESCE(a.qtd, 0)::int,
    COALESCE(a.qtd_vnd, 0)::int,
    COALESCE(a.v_orc, 0),
    COALESCE(a.v_vnd, 0),
    CASE WHEN COALESCE(a.qtd, 0) > 0 THEN ROUND((a.qtd_vnd::numeric / a.qtd) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(a.v_orc, 0) > 0 THEN ROUND((a.v_vnd / a.v_orc) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(a.qtd_vnd, 0) > 0 THEN ROUND(a.v_vnd / a.qtd_vnd, 2) ELSE 0 END,
    CASE WHEN COALESCE(a.qtd, 0) > 0 THEN ROUND(a.v_orc / a.qtd, 2) ELSE 0 END,
    COALESCE(a.n_esp, 0)::int,
    COALESCE(a.n_vnd, 0)::int,
    COALESCE(a.n_cli, 0)::int,
    COALESCE(fj.faixas, '{}'::jsonb)
  FROM public.lojas l
  LEFT JOIN agg a ON a.loja_id = l.id
  LEFT JOIN faixa_json fj ON fj.loja_id = l.id
  WHERE l.id = ANY(p_lojas)
  ORDER BY l.nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.lojas_perfil_comparativo(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lojas_perfil_comparativo(date, date, uuid[]) TO authenticated, service_role;
