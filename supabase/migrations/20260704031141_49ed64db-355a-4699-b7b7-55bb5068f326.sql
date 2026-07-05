
-- 1) recalc_no_admin_check: exigir admin
CREATE OR REPLACE FUNCTION public.recalcular_oportunidades_campanha(_campanha_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem recalcular oportunidades.';
  END IF;

  WITH item_match AS (
    SELECT
      oi.orcamento_id,
      oi.id AS item_id,
      oi.quantidade,
      oi.valor_unitario AS preco_atual,
      COALESCE(
        ci.preco_promocional,
        CASE WHEN ci.desconto_pct IS NOT NULL THEN oi.valor_unitario * (1 - ci.desconto_pct/100.0) END
      ) AS preco_promo
    FROM public.orcamento_itens oi
    JOIN public.campanha_itens ci
      ON ci.campanha_id = _campanha_id
     AND (
       (ci.produto_id IS NOT NULL AND ci.produto_id = oi.produto_id)
       OR (ci.codigo_produto IS NOT NULL AND ci.codigo_produto = oi.codigo_produto)
     )
  ),
  agg AS (
    SELECT
      o.id AS orcamento_id,
      o.valor_orcado AS valor_original,
      COUNT(im.item_id) AS itens_impactados,
      SUM((im.preco_atual - COALESCE(im.preco_promo, im.preco_atual)) * im.quantidade) AS economia
    FROM public.orcamentos o
    JOIN item_match im ON im.orcamento_id = o.id
    WHERE o.status IN ('orcado','parcial')
    GROUP BY o.id, o.valor_orcado
    HAVING COUNT(im.item_id) > 0
  )
  INSERT INTO public.oportunidades (
    orcamento_id, campanha_id, valor_original, valor_atual, economia, economia_pct, tipo, status,
    vendedor_id, loja_id, cliente_id, especificador_id, itens_impactados
  )
  SELECT
    o.id,
    _campanha_id,
    a.valor_original,
    GREATEST(a.valor_original - COALESCE(a.economia,0), 0),
    COALESCE(a.economia, 0),
    CASE WHEN a.valor_original > 0 THEN ROUND((COALESCE(a.economia,0) / a.valor_original) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(a.economia,0) > 0 THEN 'reducao'::oportunidade_tipo
         WHEN COALESCE(a.economia,0) < 0 THEN 'aumento'::oportunidade_tipo
         ELSE 'promocional'::oportunidade_tipo END,
    'nova',
    o.vendedor_id, o.loja_id, o.cliente_id, o.especificador_id,
    a.itens_impactados
  FROM agg a
  JOIN public.orcamentos o ON o.id = a.orcamento_id
  ON CONFLICT (orcamento_id, campanha_id) DO UPDATE SET
    valor_original = EXCLUDED.valor_original,
    valor_atual = EXCLUDED.valor_atual,
    economia = EXCLUDED.economia,
    economia_pct = EXCLUDED.economia_pct,
    tipo = EXCLUDED.tipo,
    itens_impactados = EXCLUDED.itens_impactados,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.tasks (titulo, tipo, due_at, status, orcamento_id, vendedor_id, especificador_id, cliente_id, loja_id, descricao)
  SELECT
    'Reativação — Orçamento ' || o.numero || ' (-R$ ' || to_char(op.economia,'FM999G999G990D00') || ')',
    'followup'::task_tipo,
    (CURRENT_DATE + INTERVAL '9 hours')::timestamptz,
    'pendente'::task_status,
    op.orcamento_id, op.vendedor_id, op.especificador_id, op.cliente_id, op.loja_id,
    'Campanha gerou redução de preço. Contatar cliente com nova proposta.'
  FROM public.oportunidades op
  JOIN public.orcamentos o ON o.id = op.orcamento_id
  WHERE op.campanha_id = _campanha_id
    AND op.status = 'nova'
    AND (op.economia >= 5000 OR op.economia_pct >= 5)
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.orcamento_id = op.orcamento_id
        AND t.tipo = 'followup'
        AND t.titulo LIKE 'Reativação%'
        AND t.status IN ('pendente','em_andamento')
    );

  RETURN v_count;
END;
$function$;

-- 2) turnover_rls_bypass: adicionar escopo por loja/regiao em 5 funções

CREATE OR REPLACE FUNCTION public.rastreabilidade_especificadores(_ano_base integer, _ano_comp integer)
 RETURNS TABLE(especificador_id uuid, nome text, loja_origem text, loja_atual text, valor_base numeric, valor_comp numeric, valor_antes numeric, lojas_base_count integer, lojas_comp_count integer, origem_in_comp boolean, atual_in_base boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  base AS (
    SELECT
      o.especificador_id,
      l.nome AS loja,
      EXTRACT(YEAR FROM o.data_orcamento)::int AS ano,
      COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado) AS valor
    FROM public.orcamentos o
    JOIN public.lojas l ON l.id = o.loja_id, scope s
    WHERE o.especificador_id IS NOT NULL
      AND o.data_orcamento IS NOT NULL
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
$function$;

CREATE OR REPLACE FUNCTION public.turnover_especificador_vendedor_principal(p_referencia date, p_janela_meses integer)
 RETURNS TABLE(especificador_id uuid, vendedor_id uuid, valor_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  base AS (
    SELECT
      o.especificador_id,
      o.vendedor_id,
      SUM(COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado)) AS valor
    FROM public.orcamentos o, scope s
    WHERE o.especificador_id IS NOT NULL
      AND o.vendedor_id IS NOT NULL
      AND o.data_orcamento BETWEEN (p_referencia - (p_janela_meses || ' months')::interval)::date AND p_referencia
      AND (s.is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
$function$;

CREATE OR REPLACE FUNCTION public.turnover_vendedores_resumo(p_inicio date, p_fim date, p_loja uuid DEFAULT NULL::uuid)
 RETURNS TABLE(vendedor_id uuid, nome text, ativo boolean, loja_id uuid, loja_nome text, ultima_atividade date, meses_inativo integer, carteira_especificadores integer, total_orcado numeric, total_vendido numeric, conversao_pct numeric, status text, evento_data date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meses_pausa integer;
  v_is_global boolean := public.user_is_global(auth.uid());
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
     AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
    WHERE (v_is_global OR v.loja_id IS NULL OR public.user_can_see_loja(auth.uid(), v.loja_id))
    GROUP BY v.id, v.nome, v.ativo, v.loja_id
  ),
  ultima_geral AS (
    SELECT o.vendedor_id AS v_id, MAX(o.data_orcamento) AS ultima
    FROM public.orcamentos o
    WHERE o.vendedor_id IS NOT NULL
      AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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

CREATE OR REPLACE FUNCTION public.turnover_eventos_carteira(p_inicio date, p_fim date, p_loja uuid DEFAULT NULL::uuid)
 RETURNS TABLE(vendedor_id uuid, vendedor_nome text, evento_data date, status_vendedor text, especificador_id uuid, especificador_nome text, valor_antes numeric, valor_depois numeric, orcado_antes numeric, orcado_depois numeric, vendedor_depois_id uuid, vendedor_depois_nome text, loja_depois_id uuid, loja_depois_nome text, mesma_loja boolean, mesmo_vendedor boolean, classificacao text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meses_pausa integer;
  v_janela_vp integer;
  v_janela_cmp integer;
  v_tol numeric;
  v_sem numeric;
  v_parcial_max numeric;
  v_is_global boolean := public.user_is_global(auth.uid());
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
      AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
    GROUP BY o.vendedor_id
  ),
  eventos AS (
    SELECT v.id AS vendedor_id, v.nome AS vendedor_nome, u.ult AS evento_data,
      CASE WHEN v.ativo = false THEN 'saida_confirmada' ELSE 'afastamento_temporario' END AS status_vendedor,
      v.loja_id AS loja_origem_id
    FROM public.vendedores v
    JOIN ultima u ON u.vendedor_id = v.id
    WHERE u.ult BETWEEN p_inicio AND p_fim
      AND (v_is_global OR v.loja_id IS NULL OR public.user_can_see_loja(auth.uid(), v.loja_id))
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
     AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
     AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
     AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
       AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
$function$;

CREATE OR REPLACE FUNCTION public.turnover_grupo_controle(p_inicio date, p_fim date, p_loja uuid DEFAULT NULL::uuid)
 RETURNS TABLE(vendedores_ativos integer, especificadores integer, valor_antes numeric, valor_depois numeric, delta_pct numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meses_pausa integer;
  v_meio date;
  v_is_global boolean := public.user_is_global(auth.uid());
BEGIN
  SELECT COALESCE(meses_pausa, 3) INTO v_meses_pausa FROM public.turnover_parametros LIMIT 1;
  v_meses_pausa := COALESCE(v_meses_pausa, 3);
  v_meio := (p_inicio + ((p_fim - p_inicio)/2))::date;

  RETURN QUERY
  WITH ultima AS (
    SELECT o.vendedor_id, MAX(o.data_orcamento) AS ult
    FROM public.orcamentos o
    WHERE o.vendedor_id IS NOT NULL
      AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
    GROUP BY o.vendedor_id
  ),
  ativos AS (
    SELECT v.id AS vendedor_id
    FROM public.vendedores v
    LEFT JOIN ultima u ON u.vendedor_id = v.id
    WHERE v.ativo = true
      AND (v_is_global OR v.loja_id IS NULL OR public.user_can_see_loja(auth.uid(), v.loja_id))
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
      AND (v_is_global OR public.user_can_see_loja(auth.uid(), o.loja_id))
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
$function$;

-- 3) SUPA_anon_security_definer_function_executable:
--    remove EXECUTE do PUBLIC/anon em todas as funções SECURITY DEFINER do schema public.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
