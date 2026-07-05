CREATE OR REPLACE FUNCTION public.turnover_especificadores_migracao(p_inicio date, p_fim date, p_loja uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  especificador_id uuid,
  especificador_nome text,
  loja_origem_id uuid,
  loja_origem_nome text,
  loja_origem_canal text,
  loja_atual_id uuid,
  loja_atual_nome text,
  loja_atual_canal text,
  vendedor_origem_id uuid,
  vendedor_origem_nome text,
  vendedor_atual_id uuid,
  vendedor_atual_nome text,
  valor_antes numeric,
  valor_depois numeric,
  delta_pct numeric,
  migrou boolean,
  trocou_vendedor boolean,
  mudou_canal boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS MATERIALIZED (
    SELECT
      o.especificador_id AS esp_id,
      o.loja_id AS lj_id,
      o.vendedor_id AS vd_id,
      CASE
        WHEN o.data_orcamento <= (p_inicio + ((p_fim - p_inicio) / 2))::date THEN 'antes'::text
        ELSE 'depois'::text
      END AS metade,
      COALESCE(NULLIF(o.valor_vendido, 0), o.valor_orcado) AS valor
    FROM public.orcamentos o
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  loja_rank AS (
    SELECT
      b.esp_id,
      b.metade,
      b.lj_id,
      ROW_NUMBER() OVER (
        PARTITION BY b.esp_id, b.metade
        ORDER BY SUM(b.valor) DESC, b.lj_id
      ) AS rn
    FROM base b
    WHERE b.lj_id IS NOT NULL
    GROUP BY b.esp_id, b.metade, b.lj_id
  ),
  loja_top AS MATERIALIZED (
    SELECT esp_id, metade, lj_id
    FROM loja_rank
    WHERE rn = 1
  ),
  vend_rank AS (
    SELECT
      b.esp_id,
      b.metade,
      b.vd_id,
      ROW_NUMBER() OVER (
        PARTITION BY b.esp_id, b.metade
        ORDER BY SUM(b.valor) DESC, b.vd_id
      ) AS rn
    FROM base b
    WHERE b.vd_id IS NOT NULL
    GROUP BY b.esp_id, b.metade, b.vd_id
  ),
  vend_top AS MATERIALIZED (
    SELECT esp_id, metade, vd_id
    FROM vend_rank
    WHERE rn = 1
  ),
  tot AS (
    SELECT
      b.esp_id,
      SUM(b.valor) FILTER (WHERE b.metade = 'antes') AS v_antes,
      SUM(b.valor) FILTER (WHERE b.metade = 'depois') AS v_depois
    FROM base b
    GROUP BY b.esp_id
  )
  SELECT
    e.id,
    e.nome,
    lo.lj_id,
    ll_o.nome,
    ll_o.canal::text,
    la.lj_id,
    ll_a.nome,
    ll_a.canal::text,
    vo.vd_id,
    vno.nome,
    va.vd_id,
    vna.nome,
    COALESCE(t.v_antes, 0),
    COALESCE(t.v_depois, 0),
    CASE
      WHEN COALESCE(t.v_antes, 0) > 0 THEN
        ROUND(((COALESCE(t.v_depois, 0) - COALESCE(t.v_antes, 0)) / t.v_antes) * 100, 2)
      ELSE 0
    END,
    (lo.lj_id IS NOT NULL AND la.lj_id IS NOT NULL AND lo.lj_id <> la.lj_id),
    (vo.vd_id IS NOT NULL AND va.vd_id IS NOT NULL AND vo.vd_id <> va.vd_id),
    (ll_o.canal IS NOT NULL AND ll_a.canal IS NOT NULL AND ll_o.canal <> ll_a.canal)
  FROM tot t
  JOIN public.especificadores e ON e.id = t.esp_id
  LEFT JOIN loja_top lo ON lo.esp_id = t.esp_id AND lo.metade = 'antes'
  LEFT JOIN loja_top la ON la.esp_id = t.esp_id AND la.metade = 'depois'
  LEFT JOIN vend_top vo ON vo.esp_id = t.esp_id AND vo.metade = 'antes'
  LEFT JOIN vend_top va ON va.esp_id = t.esp_id AND va.metade = 'depois'
  LEFT JOIN public.lojas ll_o ON ll_o.id = lo.lj_id
  LEFT JOIN public.lojas ll_a ON ll_a.id = la.lj_id
  LEFT JOIN public.vendedores vno ON vno.id = vo.vd_id
  LEFT JOIN public.vendedores vna ON vna.id = va.vd_id
  WHERE (p_loja IS NULL OR lo.lj_id = p_loja OR la.lj_id = p_loja)
  ORDER BY COALESCE(t.v_antes, 0) + COALESCE(t.v_depois, 0) DESC;
$function$;

REVOKE ALL ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) TO service_role;