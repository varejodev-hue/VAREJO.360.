
-- ============================================================
-- ENUM status da carteira
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.carteira_status AS ENUM
    ('ativo','acompanhamento','em_risco','inativo','sem_responsavel','compartilhado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.carteira_mov_tipo AS ENUM
    ('distribuicao','status','inativacao','reativacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ALTER especificadores
-- ============================================================
ALTER TABLE public.especificadores
  ADD COLUMN IF NOT EXISTS vendedor_responsavel_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loja_responsavel_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_carteira public.carteira_status NOT NULL DEFAULT 'sem_responsavel',
  ADD COLUMN IF NOT EXISTS data_status_alterado timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_status text;

CREATE INDEX IF NOT EXISTS idx_esp_vendedor_resp ON public.especificadores(vendedor_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_esp_loja_resp ON public.especificadores(loja_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_esp_status_carteira ON public.especificadores(status_carteira);

-- ============================================================
-- carteira_movimentacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.carteira_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especificador_id uuid NOT NULL REFERENCES public.especificadores(id) ON DELETE CASCADE,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  tipo public.carteira_mov_tipo NOT NULL,
  vendedor_anterior_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  vendedor_novo_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  status_anterior public.carteira_status,
  status_novo public.carteira_status,
  motivo text,
  observacao text,
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_esp ON public.carteira_movimentacoes(especificador_id);
CREATE INDEX IF NOT EXISTS idx_cm_loja ON public.carteira_movimentacoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_cm_created ON public.carteira_movimentacoes(created_at DESC);

GRANT SELECT, INSERT ON public.carteira_movimentacoes TO authenticated;
GRANT ALL ON public.carteira_movimentacoes TO service_role;

ALTER TABLE public.carteira_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_select_scope" ON public.carteira_movimentacoes;
CREATE POLICY "cm_select_scope" ON public.carteira_movimentacoes
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR public.user_can_see_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "cm_insert_scope" ON public.carteira_movimentacoes;
CREATE POLICY "cm_insert_scope" ON public.carteira_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (loja_id IS NULL OR public.user_can_see_loja(auth.uid(), loja_id));

-- ============================================================
-- RPCs
-- ============================================================

-- KPIs por loja/vendedor + janela
CREATE OR REPLACE FUNCTION public.carteira_kpis(
  p_loja uuid DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_inicio date DEFAULT (CURRENT_DATE - INTERVAL '180 days')::date,
  p_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total integer,
  ativos integer,
  acompanhamento integer,
  em_risco integer,
  inativos integer,
  sem_responsavel integer,
  compartilhados integer,
  valor_orcado numeric,
  valor_vendido numeric,
  conversao_pct numeric,
  ticket_medio numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  esp AS (
    SELECT e.* FROM public.especificadores e, scope s
    WHERE (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
      AND (p_vendedor IS NULL OR e.vendedor_responsavel_id = p_vendedor)
      AND (s.is_global OR e.loja_responsavel_id IS NULL
           OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
  ),
  orc AS (
    SELECT
      COALESCE(SUM(o.valor_orcado),0) AS v_orc,
      COALESCE(SUM(o.valor_vendido),0) AS v_vnd,
      COUNT(*) FILTER (WHERE COALESCE(o.valor_vendido,0)>0) AS qtd_vnd
    FROM public.orcamentos o
    JOIN esp ON esp.id = o.especificador_id
    WHERE o.data_orcamento BETWEEN p_inicio AND p_fim
      AND (p_loja IS NULL OR o.loja_id = p_loja)
  )
  SELECT
    (SELECT COUNT(*) FROM esp)::int,
    (SELECT COUNT(*) FROM esp WHERE status_carteira='ativo')::int,
    (SELECT COUNT(*) FROM esp WHERE status_carteira='acompanhamento')::int,
    (SELECT COUNT(*) FROM esp WHERE status_carteira='em_risco')::int,
    (SELECT COUNT(*) FROM esp WHERE status_carteira='inativo')::int,
    (SELECT COUNT(*) FROM esp WHERE status_carteira='sem_responsavel' OR vendedor_responsavel_id IS NULL)::int,
    (SELECT COUNT(*) FROM esp WHERE status_carteira='compartilhado')::int,
    (SELECT v_orc FROM orc),
    (SELECT v_vnd FROM orc),
    CASE WHEN (SELECT v_orc FROM orc) > 0
      THEN ROUND(((SELECT v_vnd FROM orc) / (SELECT v_orc FROM orc)) * 100, 2) ELSE 0 END,
    CASE WHEN (SELECT qtd_vnd FROM orc) > 0
      THEN ROUND((SELECT v_vnd FROM orc) / (SELECT qtd_vnd FROM orc), 2) ELSE 0 END;
END $$;

-- Lista de especificadores da carteira (com último orcamento, dias sem contato, etc.)
CREATE OR REPLACE FUNCTION public.carteira_especificadores(
  p_loja uuid DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_inicio date DEFAULT (CURRENT_DATE - INTERVAL '180 days')::date,
  p_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  id uuid, nome text, cidade text, uf text,
  vendedor_id uuid, vendedor_nome text,
  loja_id uuid, loja_nome text,
  status_carteira text,
  valor_orcado numeric, valor_vendido numeric,
  qtd_orcamentos integer, qtd_vendas integer,
  ultimo_orcamento date, ultima_venda date,
  dias_sem_contato integer,
  conversao_pct numeric, ticket_medio numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  esp AS (
    SELECT e.* FROM public.especificadores e, scope s
    WHERE (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
      AND (p_vendedor IS NULL OR e.vendedor_responsavel_id = p_vendedor)
      AND (p_status IS NULL OR p_status = 'todos' OR e.status_carteira::text = p_status)
      AND (p_busca IS NULL OR e.nome ILIKE '%'||p_busca||'%')
      AND (s.is_global OR e.loja_responsavel_id IS NULL
           OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
  ),
  agg AS (
    SELECT o.especificador_id,
      COALESCE(SUM(o.valor_orcado),0) AS v_orc,
      COALESCE(SUM(o.valor_vendido),0) AS v_vnd,
      COUNT(*) AS q_orc,
      COUNT(*) FILTER (WHERE COALESCE(o.valor_vendido,0)>0) AS q_vnd,
      MAX(o.data_orcamento) AS ult_orc,
      MAX(o.data_venda) AS ult_vnd
    FROM public.orcamentos o
    JOIN esp ON esp.id = o.especificador_id
    WHERE o.data_orcamento BETWEEN p_inicio AND p_fim
    GROUP BY o.especificador_id
  )
  SELECT
    e.id, e.nome, e.cidade, e.uf,
    e.vendedor_responsavel_id, v.nome,
    e.loja_responsavel_id, l.nome,
    e.status_carteira::text,
    COALESCE(a.v_orc,0), COALESCE(a.v_vnd,0),
    COALESCE(a.q_orc,0)::int, COALESCE(a.q_vnd,0)::int,
    a.ult_orc, a.ult_vnd,
    CASE WHEN a.ult_orc IS NOT NULL
      THEN (CURRENT_DATE - GREATEST(a.ult_orc, COALESCE(a.ult_vnd, a.ult_orc)))::int ELSE NULL END,
    CASE WHEN COALESCE(a.v_orc,0)>0 THEN ROUND((a.v_vnd/a.v_orc)*100,2) ELSE 0 END,
    CASE WHEN COALESCE(a.q_vnd,0)>0 THEN ROUND(a.v_vnd/a.q_vnd,2) ELSE 0 END
  FROM esp e
  LEFT JOIN agg a ON a.especificador_id = e.id
  LEFT JOIN public.vendedores v ON v.id = e.vendedor_responsavel_id
  LEFT JOIN public.lojas l ON l.id = e.loja_responsavel_id
  ORDER BY COALESCE(a.v_vnd,0) DESC NULLS LAST, e.nome;
END $$;

-- Lista priorizada de sem responsável
CREATE OR REPLACE FUNCTION public.carteira_sem_responsavel(p_loja uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, nome text, cidade text, uf text,
  loja_id uuid, loja_nome text,
  ultimo_orcamento date, ultima_venda date,
  valor_potencial numeric, dias_sem_contato integer,
  qtd_orcamentos integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  esp AS (
    SELECT e.* FROM public.especificadores e, scope s
    WHERE (e.vendedor_responsavel_id IS NULL OR e.status_carteira = 'sem_responsavel')
      AND (p_loja IS NULL OR e.loja_responsavel_id = p_loja OR e.loja_responsavel_id IS NULL)
      AND (s.is_global OR e.loja_responsavel_id IS NULL
           OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
  ),
  agg AS (
    SELECT o.especificador_id,
      COALESCE(SUM(o.valor_orcado),0) - COALESCE(SUM(o.valor_vendido),0) AS potencial,
      COUNT(*) AS q,
      MAX(o.data_orcamento) AS ult_orc,
      MAX(o.data_venda) AS ult_vnd
    FROM public.orcamentos o
    JOIN esp ON esp.id = o.especificador_id
    GROUP BY o.especificador_id
  )
  SELECT
    e.id, e.nome, e.cidade, e.uf,
    e.loja_responsavel_id, l.nome,
    a.ult_orc, a.ult_vnd,
    COALESCE(a.potencial, 0),
    CASE WHEN a.ult_orc IS NOT NULL THEN (CURRENT_DATE - a.ult_orc)::int ELSE NULL END,
    COALESCE(a.q, 0)::int
  FROM esp e
  LEFT JOIN agg a ON a.especificador_id = e.id
  LEFT JOIN public.lojas l ON l.id = e.loja_responsavel_id
  ORDER BY COALESCE(a.potencial, 0) DESC NULLS LAST, e.nome;
END $$;

-- Agregado por vendedor
CREATE OR REPLACE FUNCTION public.carteira_por_vendedor(
  p_loja uuid DEFAULT NULL,
  p_inicio date DEFAULT (CURRENT_DATE - INTERVAL '180 days')::date,
  p_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  vendedor_id uuid, vendedor_nome text,
  loja_id uuid, loja_nome text,
  qtd_especificadores integer,
  qtd_ativos integer, qtd_risco integer, qtd_inativos integer,
  valor_orcado numeric, valor_vendido numeric,
  conversao_pct numeric, ticket_medio numeric,
  ultimo_contato date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  esp AS (
    SELECT e.* FROM public.especificadores e, scope s
    WHERE e.vendedor_responsavel_id IS NOT NULL
      AND (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
      AND (s.is_global OR e.loja_responsavel_id IS NULL
           OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
  ),
  agg AS (
    SELECT e.vendedor_responsavel_id AS v_id,
      COUNT(*) AS qtd,
      COUNT(*) FILTER (WHERE e.status_carteira='ativo') AS qtd_a,
      COUNT(*) FILTER (WHERE e.status_carteira='em_risco') AS qtd_r,
      COUNT(*) FILTER (WHERE e.status_carteira='inativo') AS qtd_i
    FROM esp e GROUP BY e.vendedor_responsavel_id
  ),
  orc AS (
    SELECT e.vendedor_responsavel_id AS v_id,
      COALESCE(SUM(o.valor_orcado),0) AS v_orc,
      COALESCE(SUM(o.valor_vendido),0) AS v_vnd,
      COUNT(*) FILTER (WHERE COALESCE(o.valor_vendido,0)>0) AS qtd_vnd,
      MAX(o.data_orcamento) AS ult
    FROM esp e
    LEFT JOIN public.orcamentos o ON o.especificador_id = e.id
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
    GROUP BY e.vendedor_responsavel_id
  )
  SELECT
    v.id, v.nome, v.loja_id, l.nome,
    COALESCE(a.qtd,0)::int,
    COALESCE(a.qtd_a,0)::int, COALESCE(a.qtd_r,0)::int, COALESCE(a.qtd_i,0)::int,
    COALESCE(o.v_orc,0), COALESCE(o.v_vnd,0),
    CASE WHEN COALESCE(o.v_orc,0)>0 THEN ROUND((o.v_vnd/o.v_orc)*100,2) ELSE 0 END,
    CASE WHEN COALESCE(o.qtd_vnd,0)>0 THEN ROUND(o.v_vnd/o.qtd_vnd,2) ELSE 0 END,
    o.ult
  FROM public.vendedores v
  JOIN agg a ON a.v_id = v.id
  LEFT JOIN orc o ON o.v_id = v.id
  LEFT JOIN public.lojas l ON l.id = v.loja_id
  ORDER BY v.nome;
END $$;

-- Distribuir em massa
CREATE OR REPLACE FUNCTION public.carteira_distribuir(
  p_esp_ids uuid[],
  p_vendedor_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loja uuid;
  v_user uuid := auth.uid();
  v_count int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT loja_id INTO v_loja FROM public.vendedores WHERE id = p_vendedor_id;

  INSERT INTO public.carteira_movimentacoes
    (especificador_id, loja_id, tipo, vendedor_anterior_id, vendedor_novo_id,
     status_anterior, status_novo, motivo, alterado_por)
  SELECT e.id, COALESCE(v_loja, e.loja_responsavel_id), 'distribuicao',
    e.vendedor_responsavel_id, p_vendedor_id,
    e.status_carteira,
    CASE WHEN e.status_carteira = 'sem_responsavel' THEN 'ativo'::carteira_status ELSE e.status_carteira END,
    p_motivo, v_user
  FROM public.especificadores e
  WHERE e.id = ANY(p_esp_ids)
    AND (public.user_is_global(v_user) OR e.loja_responsavel_id IS NULL
         OR public.user_can_see_loja(v_user, e.loja_responsavel_id));

  UPDATE public.especificadores
  SET vendedor_responsavel_id = p_vendedor_id,
      loja_responsavel_id = COALESCE(v_loja, loja_responsavel_id),
      status_carteira = CASE WHEN status_carteira = 'sem_responsavel' THEN 'ativo'::carteira_status ELSE status_carteira END,
      data_status_alterado = now(),
      motivo_status = COALESCE(p_motivo, motivo_status)
  WHERE id = ANY(p_esp_ids)
    AND (public.user_is_global(v_user) OR loja_responsavel_id IS NULL
         OR public.user_can_see_loja(v_user, loja_responsavel_id));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Alterar status em massa
CREATE OR REPLACE FUNCTION public.carteira_alterar_status(
  p_esp_ids uuid[],
  p_status text,
  p_motivo text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int := 0;
  v_status carteira_status := p_status::carteira_status;
  v_tipo carteira_mov_tipo := CASE WHEN v_status='inativo' THEN 'inativacao'::carteira_mov_tipo
                                   WHEN v_status='ativo' THEN 'reativacao'::carteira_mov_tipo
                                   ELSE 'status'::carteira_mov_tipo END;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  INSERT INTO public.carteira_movimentacoes
    (especificador_id, loja_id, tipo, vendedor_anterior_id, vendedor_novo_id,
     status_anterior, status_novo, motivo, alterado_por)
  SELECT e.id, e.loja_responsavel_id, v_tipo,
    e.vendedor_responsavel_id, e.vendedor_responsavel_id,
    e.status_carteira, v_status, p_motivo, v_user
  FROM public.especificadores e
  WHERE e.id = ANY(p_esp_ids)
    AND (public.user_is_global(v_user) OR e.loja_responsavel_id IS NULL
         OR public.user_can_see_loja(v_user, e.loja_responsavel_id));

  UPDATE public.especificadores
  SET status_carteira = v_status,
      data_status_alterado = now(),
      motivo_status = COALESCE(p_motivo, motivo_status)
  WHERE id = ANY(p_esp_ids)
    AND (public.user_is_global(v_user) OR loja_responsavel_id IS NULL
         OR public.user_can_see_loja(v_user, loja_responsavel_id));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Alertas inteligentes
CREATE OR REPLACE FUNCTION public.carteira_alertas(p_loja uuid DEFAULT NULL)
RETURNS TABLE(tipo text, severidade text, mensagem text, valor numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sem int;
  v_sem_contato int;
  v_potencial numeric;
  v_media numeric;
  v_max_v text;
  v_max_n int;
BEGIN
  -- sem responsável
  SELECT COUNT(*) INTO v_sem FROM public.especificadores e
  WHERE (e.vendedor_responsavel_id IS NULL OR e.status_carteira='sem_responsavel')
    AND (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
    AND (public.user_is_global(auth.uid()) OR e.loja_responsavel_id IS NULL
         OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id));
  IF v_sem > 0 THEN
    RETURN QUERY SELECT 'sem_responsavel','alta',
      'Existem '||v_sem||' especificadores sem vendedor responsável.', v_sem::numeric;
  END IF;

  -- sem contato > 60 dias
  WITH ult AS (
    SELECT o.especificador_id, MAX(o.data_orcamento) AS d
    FROM public.orcamentos o GROUP BY o.especificador_id
  )
  SELECT COUNT(*) INTO v_sem_contato FROM public.especificadores e
  LEFT JOIN ult u ON u.especificador_id = e.id
  WHERE (u.d IS NULL OR (CURRENT_DATE - u.d) > 60)
    AND (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
    AND (public.user_is_global(auth.uid()) OR e.loja_responsavel_id IS NULL
         OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id));
  IF v_sem_contato > 0 THEN
    RETURN QUERY SELECT 'sem_contato','media',
      'Existem '||v_sem_contato||' especificadores sem contato há mais de 60 dias.', v_sem_contato::numeric;
  END IF;

  -- valor potencial parado (sem responsável)
  WITH ult AS (
    SELECT o.especificador_id, COALESCE(SUM(o.valor_orcado),0) - COALESCE(SUM(o.valor_vendido),0) AS pot
    FROM public.orcamentos o GROUP BY o.especificador_id
  )
  SELECT COALESCE(SUM(u.pot),0) INTO v_potencial FROM public.especificadores e
  JOIN ult u ON u.especificador_id = e.id
  WHERE (e.vendedor_responsavel_id IS NULL OR e.status_carteira='sem_responsavel')
    AND (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
    AND (public.user_is_global(auth.uid()) OR e.loja_responsavel_id IS NULL
         OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id));
  IF v_potencial > 0 THEN
    RETURN QUERY SELECT 'potencial','alta',
      'Há R$ '||to_char(v_potencial,'FM999G999G999G990D00')||' em potencial sem acompanhamento ativo.', v_potencial;
  END IF;

  -- vendedor sobrecarregado
  WITH agg AS (
    SELECT v.nome, COUNT(*) AS qtd FROM public.especificadores e
    JOIN public.vendedores v ON v.id = e.vendedor_responsavel_id
    WHERE (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
      AND (public.user_is_global(auth.uid()) OR e.loja_responsavel_id IS NULL
           OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
    GROUP BY v.nome
  )
  SELECT AVG(qtd), (SELECT nome FROM agg ORDER BY qtd DESC LIMIT 1),
         (SELECT qtd FROM agg ORDER BY qtd DESC LIMIT 1)
  INTO v_media, v_max_v, v_max_n FROM agg;
  IF v_max_n IS NOT NULL AND v_media IS NOT NULL AND v_max_n > v_media * 1.5 THEN
    RETURN QUERY SELECT 'sobrecarga','media',
      'O vendedor '||v_max_v||' possui '||v_max_n||' especificadores, contra média de '||ROUND(v_media,0)||'.',
      v_max_n::numeric;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.carteira_kpis(uuid, uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carteira_especificadores(uuid, uuid, text, text, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carteira_sem_responsavel(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carteira_por_vendedor(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carteira_distribuir(uuid[], uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carteira_alterar_status(uuid[], text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carteira_alertas(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.carteira_kpis(uuid, uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.carteira_especificadores(uuid, uuid, text, text, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.carteira_sem_responsavel(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.carteira_por_vendedor(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.carteira_distribuir(uuid[], uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.carteira_alterar_status(uuid[], text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.carteira_alertas(uuid) TO authenticated, service_role;

-- Bootstrap: cada especificador com pelo menos um orçamento ganha vínculo derivado (loja+vendedor mais frequentes)
WITH base AS (
  SELECT o.especificador_id,
    (SELECT loja_id FROM public.orcamentos o2
     WHERE o2.especificador_id = o.especificador_id AND o2.loja_id IS NOT NULL
     GROUP BY o2.loja_id ORDER BY COUNT(*) DESC LIMIT 1) AS loja_id,
    (SELECT vendedor_id FROM public.orcamentos o2
     WHERE o2.especificador_id = o.especificador_id AND o2.vendedor_id IS NOT NULL
     GROUP BY o2.vendedor_id ORDER BY COUNT(*) DESC LIMIT 1) AS vendedor_id
  FROM public.orcamentos o
  WHERE o.especificador_id IS NOT NULL
  GROUP BY o.especificador_id
)
UPDATE public.especificadores e
SET vendedor_responsavel_id = COALESCE(e.vendedor_responsavel_id, b.vendedor_id),
    loja_responsavel_id = COALESCE(e.loja_responsavel_id, b.loja_id),
    status_carteira = CASE
      WHEN b.vendedor_id IS NOT NULL AND e.status_carteira = 'sem_responsavel' THEN 'ativo'::carteira_status
      ELSE e.status_carteira END
FROM base b
WHERE b.especificador_id = e.id;
