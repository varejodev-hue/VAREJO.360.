
CREATE OR REPLACE FUNCTION public.rastreabilidade_especificadores(_ano_base int, _ano_comp int)
RETURNS TABLE (
  especificador_id uuid,
  nome text,
  loja_origem text,
  loja_atual text,
  valor_base numeric,
  valor_comp numeric,
  valor_antes numeric,
  lojas_base_count int,
  lojas_comp_count int,
  origem_in_comp boolean,
  atual_in_base boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      o.especificador_id,
      l.nome AS loja,
      EXTRACT(YEAR FROM o.data_orcamento)::int AS ano,
      COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado) AS valor
    FROM public.orcamentos o
    JOIN public.lojas l ON l.id = o.loja_id
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento IS NOT NULL
  ),
  per AS (
    SELECT
      especificador_id, loja, ano,
      SUM(valor) AS valor
    FROM base
    WHERE ano IN (_ano_base, _ano_comp) OR ano < _ano_base
    GROUP BY especificador_id, loja, ano
  ),
  agg AS (
    SELECT
      especificador_id,
      SUM(valor) FILTER (WHERE ano = _ano_base) AS v_base,
      SUM(valor) FILTER (WHERE ano = _ano_comp) AS v_comp,
      SUM(valor) FILTER (WHERE ano < _ano_base) AS v_antes,
      COUNT(DISTINCT loja) FILTER (WHERE ano = _ano_base) AS n_base,
      COUNT(DISTINCT loja) FILTER (WHERE ano = _ano_comp) AS n_comp
    FROM per
    GROUP BY especificador_id
  ),
  dom_base AS (
    SELECT DISTINCT ON (especificador_id) especificador_id, loja AS loja_origem
    FROM per WHERE ano = _ano_base
    ORDER BY especificador_id, valor DESC
  ),
  dom_comp AS (
    SELECT DISTINCT ON (especificador_id) especificador_id, loja AS loja_atual
    FROM per WHERE ano = _ano_comp
    ORDER BY especificador_id, valor DESC
  )
  SELECT
    e.id,
    e.nome,
    COALESCE(db.loja_origem, '—'),
    COALESCE(dc.loja_atual, '—'),
    COALESCE(a.v_base, 0),
    COALESCE(a.v_comp, 0),
    COALESCE(a.v_antes, 0),
    COALESCE(a.n_base, 0)::int,
    COALESCE(a.n_comp, 0)::int,
    EXISTS (SELECT 1 FROM per p WHERE p.especificador_id = e.id AND p.ano = _ano_comp AND p.loja = db.loja_origem),
    EXISTS (SELECT 1 FROM per p WHERE p.especificador_id = e.id AND p.ano = _ano_base AND p.loja = dc.loja_atual)
  FROM public.especificadores e
  LEFT JOIN agg a ON a.especificador_id = e.id
  LEFT JOIN dom_base db ON db.especificador_id = e.id
  LEFT JOIN dom_comp dc ON dc.especificador_id = e.id
  WHERE COALESCE(a.v_base,0) > 0 OR COALESCE(a.v_comp,0) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.rastreabilidade_especificadores(int, int) TO authenticated;
