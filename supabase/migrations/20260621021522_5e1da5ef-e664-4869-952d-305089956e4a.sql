
-- 1) Extend produtos with linha, formato, tamanho
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS linha text,
  ADD COLUMN IF NOT EXISTS formato text,
  ADD COLUMN IF NOT EXISTS tamanho text;

-- 2) Extend orcamento_itens with snapshot fields
ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS codigo_produto text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS linha text,
  ADD COLUMN IF NOT EXISTS formato text,
  ADD COLUMN IF NOT EXISTS tamanho text;

CREATE INDEX IF NOT EXISTS idx_orcamento_itens_codigo ON public.orcamento_itens(codigo_produto);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_tamanho ON public.orcamento_itens(tamanho);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_linha ON public.orcamento_itens(linha);

-- 3) Enums for campanha + oportunidade
DO $$ BEGIN CREATE TYPE public.campanha_status AS ENUM ('rascunho','ativa','encerrada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.oportunidade_tipo AS ENUM ('reducao','aumento','desconto','promocional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.oportunidade_status AS ENUM ('nova','em_andamento','convertida','descartada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) campanhas table
CREATE TABLE IF NOT EXISTS public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status public.campanha_status NOT NULL DEFAULT 'rascunho',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campanhas_select_auth" ON public.campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "campanhas_insert_auth" ON public.campanhas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "campanhas_update_auth" ON public.campanhas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campanhas_delete_auth" ON public.campanhas FOR DELETE TO authenticated USING (public.user_is_global(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER trg_campanhas_updated_at BEFORE UPDATE ON public.campanhas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) campanha_itens
CREATE TABLE IF NOT EXISTS public.campanha_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  codigo_produto text,
  preco_promocional numeric,
  desconto_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campanha_itens_campanha ON public.campanha_itens(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_itens_codigo ON public.campanha_itens(codigo_produto);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanha_itens TO authenticated;
GRANT ALL ON public.campanha_itens TO service_role;
ALTER TABLE public.campanha_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campanha_itens_all_auth" ON public.campanha_itens FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- 6) oportunidades
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  valor_original numeric NOT NULL DEFAULT 0,
  valor_atual numeric NOT NULL DEFAULT 0,
  economia numeric NOT NULL DEFAULT 0,
  economia_pct numeric NOT NULL DEFAULT 0,
  tipo public.oportunidade_tipo NOT NULL DEFAULT 'reducao',
  status public.oportunidade_status NOT NULL DEFAULT 'nova',
  vendedor_id uuid,
  loja_id uuid,
  cliente_id uuid,
  especificador_id uuid,
  itens_impactados int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, campanha_id)
);
CREATE INDEX IF NOT EXISTS idx_oportunidades_campanha ON public.oportunidades(campanha_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_vendedor ON public.oportunidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_loja ON public.oportunidades(loja_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_status ON public.oportunidades(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oportunidades_select_scoped" ON public.oportunidades FOR SELECT TO authenticated
  USING (public.user_can_see_loja(auth.uid(), loja_id));
CREATE POLICY "oportunidades_update_scoped" ON public.oportunidades FOR UPDATE TO authenticated
  USING (public.user_can_see_loja(auth.uid(), loja_id));
CREATE POLICY "oportunidades_insert_service" ON public.oportunidades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "oportunidades_delete_global" ON public.oportunidades FOR DELETE TO authenticated USING (public.user_is_global(auth.uid()));

CREATE TRIGGER trg_oportunidades_updated_at BEFORE UPDATE ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7) Recalc function
CREATE OR REPLACE FUNCTION public.recalcular_oportunidades_campanha(_campanha_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  -- Compute new totals per orcamento based on campanha prices
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

  -- Auto follow-up tasks for relevant economias
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
$$;

REVOKE ALL ON FUNCTION public.recalcular_oportunidades_campanha(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.recalcular_oportunidades_campanha(uuid) TO authenticated, service_role;
