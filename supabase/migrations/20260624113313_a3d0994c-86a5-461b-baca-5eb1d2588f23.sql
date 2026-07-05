
CREATE OR REPLACE FUNCTION public.turnover_especificadores_migracao(
  p_inicio date,
  p_fim date,
  p_loja uuid DEFAULT NULL
)
RETURNS TABLE (
  especificador_id uuid,
  especificador_nome text,
  loja_origem_id uuid,
  loja_origem_nome text,
  loja_atual_id uuid,
  loja_atual_nome text,
  vendedor_origem_id uuid,
  vendedor_origem_nome text,
  vendedor_atual_id uuid,
  vendedor_atual_nome text,
  valor_antes numeric,
  valor_depois numeric,
  delta_pct numeric,
  migrou boolean,
  trocou_vendedor boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meio date;
BEGIN
  v_meio := (p_inicio + ((p_fim - p_inicio)/2))::date;

  RETURN QUERY
  WITH base AS (
    SELECT o.especificador_id, o.loja_id, o.vendedor_id,
      CASE WHEN o.data_orcamento <= v_meio THEN 'antes' ELSE 'depois' END AS metade,
      COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado) AS valor
    FROM public.orcamentos o
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  loja_rank AS (
    SELECT especificador_id, metade, loja_id,
      SUM(valor) AS w,
      ROW_NUMBER() OVER (PARTITION BY especificador_id, metade ORDER BY SUM(valor) DESC) AS rn
    FROM base WHERE loja_id IS NOT NULL
    GROUP BY especificador_id, metade, loja_id
  ),
  vend_rank AS (
    SELECT especificador_id, metade, vendedor_id,
      SUM(valor) AS w,
      ROW_NUMBER() OVER (PARTITION BY especificador_id, metade ORDER BY SUM(valor) DESC) AS rn
    FROM base WHERE vendedor_id IS NOT NULL
    GROUP BY especificador_id, metade, vendedor_id
  ),
  tot AS (
    SELECT especificador_id,
      SUM(valor) FILTER (WHERE metade = 'antes') AS v_antes,
      SUM(valor) FILTER (WHERE metade = 'depois') AS v_depois
    FROM base GROUP BY especificador_id
  )
  SELECT
    e.id,
    e.nome,
    lo.loja_id,
    ll_o.nome,
    la.loja_id,
    ll_a.nome,
    vo.vendedor_id,
    vno.nome,
    va.vendedor_id,
    vna.nome,
    COALESCE(t.v_antes, 0),
    COALESCE(t.v_depois, 0),
    CASE WHEN COALESCE(t.v_antes,0) > 0
      THEN ROUND(((COALESCE(t.v_depois,0) - COALESCE(t.v_antes,0)) / t.v_antes) * 100, 2)
      ELSE 0 END,
    (lo.loja_id IS NOT NULL AND la.loja_id IS NOT NULL AND lo.loja_id <> la.loja_id),
    (vo.vendedor_id IS NOT NULL AND va.vendedor_id IS NOT NULL AND vo.vendedor_id <> va.vendedor_id)
  FROM tot t
  JOIN public.especificadores e ON e.id = t.especificador_id
  LEFT JOIN loja_rank lo ON lo.especificador_id = t.especificador_id AND lo.metade = 'antes' AND lo.rn = 1
  LEFT JOIN loja_rank la ON la.especificador_id = t.especificador_id AND la.metade = 'depois' AND la.rn = 1
  LEFT JOIN vend_rank vo ON vo.especificador_id = t.especificador_id AND vo.metade = 'antes' AND vo.rn = 1
  LEFT JOIN vend_rank va ON va.especificador_id = t.especificador_id AND va.metade = 'depois' AND va.rn = 1
  LEFT JOIN public.lojas ll_o ON ll_o.id = lo.loja_id
  LEFT JOIN public.lojas ll_a ON ll_a.id = la.loja_id
  LEFT JOIN public.vendedores vno ON vno.id = vo.vendedor_id
  LEFT JOIN public.vendedores vna ON vna.id = va.vendedor_id
  WHERE (p_loja IS NULL OR lo.loja_id = p_loja OR la.loja_id = p_loja)
  ORDER BY COALESCE(t.v_antes,0) + COALESCE(t.v_depois,0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) TO authenticated;
