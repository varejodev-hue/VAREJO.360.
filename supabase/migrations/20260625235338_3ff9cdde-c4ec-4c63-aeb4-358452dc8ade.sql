
-- ============ PERFIL DE CLIENTE POR LOJA ============
CREATE OR REPLACE FUNCTION public.lojas_perfil_clientes(p_inicio date, p_fim date, p_lojas uuid[])
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  clientes_unicos int,
  clientes_recorrentes int,
  recorrencia_pct numeric,
  ticket_medio_cliente numeric,
  ticket_mediano_cliente numeric,
  dias_medio_ate_conversao numeric,
  perfil_dominante text,
  distribuicao jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT o.loja_id, o.cliente_id,
      COALESCE(o.valor_orcado,0) AS v_orc,
      COALESCE(o.valor_vendido,0) AS v_vnd,
      o.data_orcamento, o.data_venda
    FROM public.orcamentos o
    WHERE o.loja_id = ANY(p_lojas)
      AND o.cliente_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  por_cliente AS (
    SELECT loja_id, cliente_id,
      COUNT(*) AS qtd_orc,
      SUM(v_vnd) AS total_vnd,
      AVG(CASE WHEN data_venda IS NOT NULL THEN (data_venda - data_orcamento) END) AS dias_conv,
      CASE
        WHEN AVG(v_orc) >= 100000 THEN 'alto'
        WHEN AVG(v_orc) >= 25000 THEN 'medio'
        ELSE 'entrada'
      END AS perfil
    FROM base
    GROUP BY loja_id, cliente_id
  ),
  agg AS (
    SELECT loja_id,
      COUNT(*) AS n_cli,
      COUNT(*) FILTER (WHERE qtd_orc > 1) AS n_recorr,
      AVG(total_vnd) FILTER (WHERE total_vnd > 0) AS ticket_avg,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_vnd) FILTER (WHERE total_vnd > 0) AS ticket_med,
      AVG(dias_conv) AS dias_conv,
      COUNT(*) FILTER (WHERE perfil='alto') AS n_alto,
      COUNT(*) FILTER (WHERE perfil='medio') AS n_medio,
      COUNT(*) FILTER (WHERE perfil='entrada') AS n_entrada
    FROM por_cliente
    GROUP BY loja_id
  )
  SELECT
    l.id, l.nome,
    COALESCE(a.n_cli,0)::int,
    COALESCE(a.n_recorr,0)::int,
    CASE WHEN COALESCE(a.n_cli,0)>0 THEN ROUND((a.n_recorr::numeric/a.n_cli)*100,2) ELSE 0 END,
    ROUND(COALESCE(a.ticket_avg,0),2),
    ROUND(COALESCE(a.ticket_med,0),2),
    ROUND(COALESCE(a.dias_conv,0),1),
    CASE
      WHEN COALESCE(a.n_cli,0)=0 THEN 'sem_dados'
      WHEN a.n_alto >= a.n_medio AND a.n_alto >= a.n_entrada THEN 'alto'
      WHEN a.n_medio >= a.n_entrada THEN 'medio'
      ELSE 'entrada'
    END,
    jsonb_build_object(
      'alto', COALESCE(a.n_alto,0),
      'medio', COALESCE(a.n_medio,0),
      'entrada', COALESCE(a.n_entrada,0)
    )
  FROM public.lojas l
  LEFT JOIN agg a ON a.loja_id = l.id
  WHERE l.id = ANY(p_lojas)
  ORDER BY l.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.lojas_perfil_clientes(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lojas_perfil_clientes(date, date, uuid[]) TO authenticated, service_role;

-- ============ PERFIL DE ESPECIFICADORES POR LOJA ============
CREATE OR REPLACE FUNCTION public.lojas_perfil_especificadores(p_inicio date, p_fim date, p_lojas uuid[])
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  especificadores_ativos int,
  especificadores_recorrentes int,
  dependencia_top5_pct numeric,
  ticket_medio_esp numeric,
  conversao_esp_pct numeric,
  top_especificadores jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT o.loja_id, o.especificador_id,
      COALESCE(o.valor_orcado,0) AS v_orc,
      COALESCE(o.valor_vendido,0) AS v_vnd
    FROM public.orcamentos o
    WHERE o.loja_id = ANY(p_lojas)
      AND o.especificador_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  por_esp AS (
    SELECT loja_id, especificador_id,
      COUNT(*) AS qtd,
      SUM(v_orc) AS orc,
      SUM(v_vnd) AS vnd
    FROM base
    GROUP BY loja_id, especificador_id
  ),
  total_loja AS (
    SELECT loja_id, SUM(orc) AS total_orc, SUM(vnd) AS total_vnd
    FROM por_esp GROUP BY loja_id
  ),
  ranked AS (
    SELECT pe.*, e.nome AS esp_nome,
      ROW_NUMBER() OVER (PARTITION BY pe.loja_id ORDER BY pe.vnd DESC NULLS LAST, pe.orc DESC) AS rn
    FROM por_esp pe
    JOIN public.especificadores e ON e.id = pe.especificador_id
  ),
  top5 AS (
    SELECT loja_id, SUM(vnd) AS top_vnd
    FROM ranked WHERE rn <= 5 GROUP BY loja_id
  ),
  top_json AS (
    SELECT loja_id, jsonb_agg(jsonb_build_object(
      'nome', esp_nome, 'qtd', qtd, 'vendido', vnd, 'orcado', orc
    ) ORDER BY rn) AS items
    FROM ranked WHERE rn <= 5
    GROUP BY loja_id
  ),
  agg AS (
    SELECT loja_id,
      COUNT(*) AS n_esp,
      COUNT(*) FILTER (WHERE qtd > 1) AS n_recorr,
      AVG(vnd) FILTER (WHERE vnd > 0) AS ticket
    FROM por_esp GROUP BY loja_id
  )
  SELECT
    l.id, l.nome,
    COALESCE(a.n_esp,0)::int,
    COALESCE(a.n_recorr,0)::int,
    CASE WHEN COALESCE(tl.total_vnd,0) > 0 THEN ROUND((COALESCE(t5.top_vnd,0)/tl.total_vnd)*100,2) ELSE 0 END,
    ROUND(COALESCE(a.ticket,0),2),
    CASE WHEN COALESCE(tl.total_orc,0) > 0 THEN ROUND((tl.total_vnd/tl.total_orc)*100,2) ELSE 0 END,
    COALESCE(tj.items, '[]'::jsonb)
  FROM public.lojas l
  LEFT JOIN agg a ON a.loja_id = l.id
  LEFT JOIN total_loja tl ON tl.loja_id = l.id
  LEFT JOIN top5 t5 ON t5.loja_id = l.id
  LEFT JOIN top_json tj ON tj.loja_id = l.id
  WHERE l.id = ANY(p_lojas)
  ORDER BY l.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.lojas_perfil_especificadores(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lojas_perfil_especificadores(date, date, uuid[]) TO authenticated, service_role;

-- ============ PERFIL DE VENDEDORES POR LOJA ============
CREATE OR REPLACE FUNCTION public.lojas_perfil_vendedores(p_inicio date, p_fim date, p_lojas uuid[])
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  vendedores_ativos int,
  produtividade_media numeric,
  conversao_media_pct numeric,
  ticket_medio_vendedor numeric,
  dependencia_top3_pct numeric,
  top_vendedores jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT o.loja_id, o.vendedor_id,
      COALESCE(o.valor_orcado,0) AS v_orc,
      COALESCE(o.valor_vendido,0) AS v_vnd
    FROM public.orcamentos o
    WHERE o.loja_id = ANY(p_lojas)
      AND o.vendedor_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  por_vnd AS (
    SELECT loja_id, vendedor_id,
      COUNT(*) AS qtd,
      SUM(v_orc) AS orc,
      SUM(v_vnd) AS vnd
    FROM base GROUP BY loja_id, vendedor_id
  ),
  total_loja AS (
    SELECT loja_id, SUM(vnd) AS total_vnd, SUM(orc) AS total_orc
    FROM por_vnd GROUP BY loja_id
  ),
  ranked AS (
    SELECT pv.*, v.nome AS vnd_nome,
      ROW_NUMBER() OVER (PARTITION BY pv.loja_id ORDER BY pv.vnd DESC NULLS LAST) AS rn
    FROM por_vnd pv
    JOIN public.vendedores v ON v.id = pv.vendedor_id
  ),
  top3 AS (
    SELECT loja_id, SUM(vnd) AS top_vnd FROM ranked WHERE rn <= 3 GROUP BY loja_id
  ),
  top_json AS (
    SELECT loja_id, jsonb_agg(jsonb_build_object(
      'nome', vnd_nome, 'qtd', qtd, 'vendido', vnd, 'orcado', orc,
      'conversao', CASE WHEN orc>0 THEN ROUND((vnd/orc)*100,2) ELSE 0 END
    ) ORDER BY rn) AS items
    FROM ranked WHERE rn <= 5 GROUP BY loja_id
  ),
  agg AS (
    SELECT loja_id,
      COUNT(*) AS n_vnd,
      AVG(qtd) AS prod_avg,
      AVG(CASE WHEN orc>0 THEN (vnd/orc)*100 END) AS conv_avg,
      AVG(vnd) FILTER (WHERE vnd > 0) AS ticket
    FROM por_vnd GROUP BY loja_id
  )
  SELECT
    l.id, l.nome,
    COALESCE(a.n_vnd,0)::int,
    ROUND(COALESCE(a.prod_avg,0),1),
    ROUND(COALESCE(a.conv_avg,0),2),
    ROUND(COALESCE(a.ticket,0),2),
    CASE WHEN COALESCE(tl.total_vnd,0) > 0 THEN ROUND((COALESCE(t3.top_vnd,0)/tl.total_vnd)*100,2) ELSE 0 END,
    COALESCE(tj.items, '[]'::jsonb)
  FROM public.lojas l
  LEFT JOIN agg a ON a.loja_id = l.id
  LEFT JOIN total_loja tl ON tl.loja_id = l.id
  LEFT JOIN top3 t3 ON t3.loja_id = l.id
  LEFT JOIN top_json tj ON tj.loja_id = l.id
  WHERE l.id = ANY(p_lojas)
  ORDER BY l.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.lojas_perfil_vendedores(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lojas_perfil_vendedores(date, date, uuid[]) TO authenticated, service_role;
