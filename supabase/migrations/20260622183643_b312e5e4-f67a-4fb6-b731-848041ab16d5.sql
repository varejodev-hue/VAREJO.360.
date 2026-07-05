
CREATE TABLE IF NOT EXISTS public.orcamentos_staging (
  id bigserial PRIMARY KEY,
  log_id uuid NOT NULL REFERENCES public.import_logs(id) ON DELETE CASCADE,
  linha integer NOT NULL,
  numero text,
  numero_pedido text,
  data_orcamento date,
  loja text,
  canal text,
  vendedor text,
  especificador text,
  cliente text,
  valor_orcado numeric(14,2) DEFAULT 0,
  valor_vendido numeric(14,2) DEFAULT 0,
  data_venda date,
  status text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orcamentos_staging_log ON public.orcamentos_staging(log_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos_staging TO authenticated;
GRANT ALL ON public.orcamentos_staging TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.orcamentos_staging_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.orcamentos_staging_id_seq TO service_role;

ALTER TABLE public.orcamentos_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage orcamentos_staging" ON public.orcamentos_staging;
CREATE POLICY "Admins manage orcamentos_staging" ON public.orcamentos_staging
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.process_orcamentos_staging(_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_lojas_criadas int := 0;
  v_vend_criados int := 0;
  v_esp_criados int := 0;
  v_cli_criados int := 0;
  v_inseridos int := 0;
  v_atualizados int := 0;
  v_sucesso int := 0;
  v_lojas_sem_canal int := 0;
  v_total int := 0;
BEGIN
  SELECT public.has_role(v_user, 'admin') INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar importação.';
  END IF;

  SELECT count(*) INTO v_total FROM public.orcamentos_staging WHERE log_id = _log_id;

  -- 1. Lojas faltantes
  WITH novas AS (
    SELECT DISTINCT ON (lower(s.loja))
      s.loja AS nome,
      CASE
        WHEN s.canal ILIKE '%propri%' OR s.canal ILIKE '%own%' THEN 'loja_propria'::canal_tipo
        WHEN s.canal ILIKE '%franqu%' OR s.canal ILIKE '%franch%' THEN 'franquia'::canal_tipo
        ELSE 'nao_classificado'::canal_tipo
      END AS canal
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id
      AND s.loja IS NOT NULL AND s.loja <> ''
      AND NOT EXISTS (SELECT 1 FROM public.lojas l WHERE lower(l.nome) = lower(s.loja))
  ), ins AS (
    INSERT INTO public.lojas (codigo, nome, canal)
    SELECT
      left(upper(regexp_replace(nome, '[^a-zA-Z0-9]+', '_', 'g')), 30),
      nome, canal
    FROM novas
    ON CONFLICT (codigo) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_lojas_criadas FROM ins;

  SELECT count(DISTINCT lower(s.loja))
    INTO v_lojas_sem_canal
  FROM public.orcamentos_staging s
  WHERE s.log_id = _log_id
    AND s.loja IS NOT NULL AND s.loja <> ''
    AND (s.canal IS NULL OR s.canal = ''
         OR (s.canal NOT ILIKE '%propri%' AND s.canal NOT ILIKE '%franqu%'
             AND s.canal NOT ILIKE '%own%' AND s.canal NOT ILIKE '%franch%'));

  -- 2. Vendedores
  WITH novos AS (
    SELECT DISTINCT ON (lower(s.vendedor)) s.vendedor AS nome
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id AND s.vendedor IS NOT NULL AND s.vendedor <> ''
      AND NOT EXISTS (SELECT 1 FROM public.vendedores v WHERE lower(v.nome) = lower(s.vendedor))
  ), ins AS (INSERT INTO public.vendedores (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_vend_criados FROM ins;

  -- 3. Especificadores
  WITH novos AS (
    SELECT DISTINCT ON (lower(s.especificador)) s.especificador AS nome
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id AND s.especificador IS NOT NULL AND s.especificador <> ''
      AND NOT EXISTS (SELECT 1 FROM public.especificadores e WHERE lower(e.nome) = lower(s.especificador))
  ), ins AS (INSERT INTO public.especificadores (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_esp_criados FROM ins;

  -- 4. Clientes
  WITH novos AS (
    SELECT DISTINCT ON (lower(s.cliente)) s.cliente AS nome
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id AND s.cliente IS NOT NULL AND s.cliente <> ''
      AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE lower(c.nome) = lower(s.cliente))
  ), ins AS (INSERT INTO public.clientes (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_cli_criados FROM ins;

  -- 5. UPSERT orcamentos
  WITH resolved AS (
    SELECT
      s.id AS staging_id,
      s.numero, NULLIF(s.numero_pedido,'') AS numero_pedido, s.data_orcamento,
      l.id AS loja_id,
      v.id AS vendedor_id,
      e.id AS especificador_id,
      c.id AS cliente_id,
      COALESCE(s.valor_orcado,0) AS valor_orcado,
      COALESCE(s.valor_vendido,0) AS valor_vendido,
      s.data_venda,
      lower(COALESCE(NULLIF(s.status,''), '')) AS status_raw,
      NULLIF(s.observacao,'') AS observacao,
      ROW_NUMBER() OVER (PARTITION BY s.numero, l.id ORDER BY s.id DESC) AS rn
    FROM public.orcamentos_staging s
    LEFT JOIN public.lojas l ON l.nome IS NOT NULL AND lower(l.nome) = lower(s.loja)
    LEFT JOIN public.vendedores v ON v.nome IS NOT NULL AND lower(v.nome) = lower(s.vendedor)
    LEFT JOIN public.especificadores e ON e.nome IS NOT NULL AND lower(e.nome) = lower(s.especificador)
    LEFT JOIN public.clientes c ON c.nome IS NOT NULL AND lower(c.nome) = lower(s.cliente)
    WHERE s.log_id = _log_id
      AND s.numero IS NOT NULL AND s.numero <> ''
      AND s.data_orcamento IS NOT NULL
      AND l.id IS NOT NULL
  ), normed AS (
    SELECT
      numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, observacao,
      (CASE
        WHEN status_raw ~ 'em.?neg' THEN 'em_negociacao'
        WHEN status_raw ~ 'aprov' THEN 'aprovado'
        WHEN status_raw ~ 'reaber' THEN 'reaberto'
        WHEN status_raw ~ 'reaprov' THEN 'reaproveitado'
        WHEN status_raw ~ 'cancel' THEN 'cancelado'
        WHEN status_raw ~ 'perd' THEN 'perdido'
        WHEN status_raw ~ '(vend|sell)' THEN 'vendido'
        WHEN status_raw ~ 'parc' THEN 'parcial'
        WHEN status_raw ~ 'abert' THEN 'aberto'
        WHEN status_raw ~ 'orca' THEN 'orcado'
        WHEN status_raw = '' AND valor_vendido > 0 AND valor_vendido >= valor_orcado THEN 'vendido'
        WHEN status_raw = '' AND valor_vendido > 0 THEN 'parcial'
        ELSE 'orcado'
      END)::orcamento_status AS status
    FROM resolved
    WHERE rn = 1
  ), ups AS (
    INSERT INTO public.orcamentos AS o (
      numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, status, observacao, import_log_id
    )
    SELECT
      numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, status, observacao, _log_id
    FROM normed
    ON CONFLICT (numero, loja_id) DO UPDATE SET
      numero_pedido = EXCLUDED.numero_pedido,
      data_orcamento = EXCLUDED.data_orcamento,
      vendedor_id = EXCLUDED.vendedor_id,
      especificador_id = EXCLUDED.especificador_id,
      cliente_id = EXCLUDED.cliente_id,
      valor_orcado = EXCLUDED.valor_orcado,
      valor_vendido = EXCLUDED.valor_vendido,
      data_venda = EXCLUDED.data_venda,
      status = EXCLUDED.status,
      observacao = EXCLUDED.observacao,
      import_log_id = EXCLUDED.import_log_id,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    count(*) FILTER (WHERE inserted),
    count(*) FILTER (WHERE NOT inserted)
  INTO v_inseridos, v_atualizados
  FROM ups;

  v_sucesso := v_inseridos + v_atualizados;

  DELETE FROM public.orcamentos_staging WHERE log_id = _log_id;

  UPDATE public.import_logs SET
    total_linhas = GREATEST(total_linhas, v_total),
    total_sucesso = v_sucesso,
    cadastros_criados = jsonb_build_object(
      'lojas', v_lojas_criadas,
      'vendedores', v_vend_criados,
      'especificadores', v_esp_criados,
      'clientes', v_cli_criados,
      'lojas_sem_canal', v_lojas_sem_canal,
      'inseridos', v_inseridos,
      'atualizados', v_atualizados
    )
  WHERE id = _log_id;

  RETURN jsonb_build_object(
    'sucesso', v_sucesso,
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'lojas_criadas', v_lojas_criadas,
    'vendedores_criados', v_vend_criados,
    'especificadores_criados', v_esp_criados,
    'clientes_criados', v_cli_criados,
    'lojas_sem_canal', v_lojas_sem_canal,
    'total_staging', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_orcamentos_staging(uuid) TO authenticated;
