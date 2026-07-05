CREATE OR REPLACE FUNCTION public.process_orcamentos_staging_chunk(_log_id uuid, _limit integer DEFAULT 25000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '0'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_lojas_criadas int := 0;
  v_vend_criados int := 0;
  v_esp_criados int := 0;
  v_cli_criados int := 0;
  v_inseridos int := 0;
  v_atualizados int := 0;
  v_lojas_sem_canal int := 0;
  v_chunk_ids bigint[];
  v_remaining int := 0;
  v_processed int := 0;
BEGIN
  SELECT public.has_role(v_user, 'admin') INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar importação.';
  END IF;

  SELECT array_agg(id) INTO v_chunk_ids
  FROM (
    SELECT id FROM public.orcamentos_staging
    WHERE log_id = _log_id
    ORDER BY id
    LIMIT _limit
  ) t;

  IF v_chunk_ids IS NULL OR array_length(v_chunk_ids, 1) IS NULL THEN
    SELECT count(*) INTO v_remaining FROM public.orcamentos_staging WHERE log_id = _log_id;
    RETURN jsonb_build_object(
      'processed', 0, 'inseridos', 0, 'atualizados', 0,
      'lojas_criadas', 0, 'vendedores_criados', 0, 'especificadores_criados', 0,
      'clientes_criados', 0, 'lojas_sem_canal', 0, 'remaining', v_remaining, 'done', true
    );
  END IF;

  v_processed := array_length(v_chunk_ids, 1);

  WITH novas AS (
    SELECT DISTINCT ON (lower(s.loja))
      s.loja AS nome,
      CASE
        WHEN lower(COALESCE(s.canal, '')) LIKE '%propri%'
          OR lower(COALESCE(s.canal, '')) LIKE '%própri%'
          OR lower(COALESCE(s.canal, '')) LIKE '%own%'
        THEN 'loja_propria'::canal_tipo
        WHEN lower(COALESCE(s.canal, '')) LIKE '%franqu%'
          OR lower(COALESCE(s.canal, '')) LIKE '%franch%'
        THEN 'franquia'::canal_tipo
        ELSE 'nao_classificado'::canal_tipo
      END AS canal
    FROM public.orcamentos_staging s
    WHERE s.id = ANY(v_chunk_ids)
      AND s.loja IS NOT NULL AND s.loja <> ''
      AND NOT EXISTS (SELECT 1 FROM public.lojas l WHERE lower(l.nome) = lower(s.loja))
  ), ins AS (
    INSERT INTO public.lojas (codigo, nome, canal)
    SELECT left(upper(regexp_replace(nome, '[^a-zA-Z0-9]+', '_', 'g')), 30), nome, canal
    FROM novas ON CONFLICT (codigo) DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_lojas_criadas FROM ins;

  SELECT count(DISTINCT lower(s.loja)) INTO v_lojas_sem_canal
  FROM public.orcamentos_staging s
  WHERE s.id = ANY(v_chunk_ids) AND s.loja IS NOT NULL AND s.loja <> ''
    AND (s.canal IS NULL OR s.canal = ''
         OR (lower(s.canal) NOT LIKE '%propri%' AND lower(s.canal) NOT LIKE '%própri%'
             AND lower(s.canal) NOT LIKE '%franqu%' AND lower(s.canal) NOT LIKE '%own%'
             AND lower(s.canal) NOT LIKE '%franch%'));

  WITH novos AS (
    SELECT DISTINCT ON (lower(s.vendedor)) s.vendedor AS nome
    FROM public.orcamentos_staging s
    WHERE s.id = ANY(v_chunk_ids) AND s.vendedor IS NOT NULL AND s.vendedor <> ''
      AND NOT EXISTS (SELECT 1 FROM public.vendedores v WHERE lower(v.nome) = lower(s.vendedor))
  ), ins AS (INSERT INTO public.vendedores (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_vend_criados FROM ins;

  WITH novos AS (
    SELECT DISTINCT ON (lower(s.especificador)) s.especificador AS nome
    FROM public.orcamentos_staging s
    WHERE s.id = ANY(v_chunk_ids) AND s.especificador IS NOT NULL AND s.especificador <> ''
      AND NOT EXISTS (SELECT 1 FROM public.especificadores e WHERE lower(e.nome) = lower(s.especificador))
  ), ins AS (INSERT INTO public.especificadores (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_esp_criados FROM ins;

  WITH novos AS (
    SELECT DISTINCT ON (lower(s.cliente)) s.cliente AS nome
    FROM public.orcamentos_staging s
    WHERE s.id = ANY(v_chunk_ids) AND s.cliente IS NOT NULL AND s.cliente <> ''
      AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE lower(c.nome) = lower(s.cliente))
  ), ins AS (INSERT INTO public.clientes (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_cli_criados FROM ins;

  WITH resolved AS (
    SELECT
      s.id AS staging_id,
      s.numero, NULLIF(s.numero_pedido,'') AS numero_pedido, s.data_orcamento,
      l.id AS loja_id, v.id AS vendedor_id, e.id AS especificador_id, c.id AS cliente_id,
      COALESCE(s.valor_orcado,0) AS valor_orcado,
      COALESCE(s.valor_vendido,0) AS valor_vendido,
      s.data_venda,
      lower(COALESCE(NULLIF(s.status,''), '')) AS status_raw,
      NULLIF(s.observacao,'') AS observacao,
      NULLIF(s.categoria,'') AS categoria,
      NULLIF(s.linha_produto,'') AS linha_produto,
      NULLIF(s.formato,'') AS formato,
      NULLIF(s.tamanho,'') AS tamanho,
      NULLIF(s.codigo_produto,'') AS codigo_produto,
      NULLIF(s.descricao_produto,'') AS descricao_produto,
      ROW_NUMBER() OVER (PARTITION BY s.numero, l.id ORDER BY s.id DESC) AS rn
    FROM public.orcamentos_staging s
    LEFT JOIN public.lojas l ON l.nome IS NOT NULL AND lower(l.nome) = lower(s.loja)
    LEFT JOIN public.vendedores v ON v.nome IS NOT NULL AND lower(v.nome) = lower(s.vendedor)
    LEFT JOIN public.especificadores e ON e.nome IS NOT NULL AND lower(e.nome) = lower(s.especificador)
    LEFT JOIN public.clientes c ON c.nome IS NOT NULL AND lower(c.nome) = lower(s.cliente)
    WHERE s.id = ANY(v_chunk_ids) AND s.numero IS NOT NULL AND s.numero <> ''
      AND s.data_orcamento IS NOT NULL AND l.id IS NOT NULL
  ), normed AS (
    SELECT numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, observacao,
      categoria, linha_produto, formato, tamanho, codigo_produto, descricao_produto,
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
    FROM resolved WHERE rn = 1
  ), ups AS (
    INSERT INTO public.orcamentos AS o (
      numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, status, observacao, import_log_id,
      categoria, linha_produto, formato, tamanho, codigo_produto, descricao_produto
    )
    SELECT numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, status, observacao, _log_id,
      categoria, linha_produto, formato, tamanho, codigo_produto, descricao_produto
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
      categoria = COALESCE(EXCLUDED.categoria, o.categoria),
      linha_produto = COALESCE(EXCLUDED.linha_produto, o.linha_produto),
      formato = COALESCE(EXCLUDED.formato, o.formato),
      tamanho = COALESCE(EXCLUDED.tamanho, o.tamanho),
      codigo_produto = COALESCE(EXCLUDED.codigo_produto, o.codigo_produto),
      descricao_produto = COALESCE(EXCLUDED.descricao_produto, o.descricao_produto),
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE inserted), count(*) FILTER (WHERE NOT inserted)
  INTO v_inseridos, v_atualizados FROM ups;

  DELETE FROM public.orcamentos_staging WHERE id = ANY(v_chunk_ids);

  SELECT count(*) INTO v_remaining FROM public.orcamentos_staging WHERE log_id = _log_id;

  UPDATE public.import_logs SET
    total_sucesso = COALESCE(total_sucesso, 0) + (v_inseridos + v_atualizados),
    cadastros_criados = COALESCE(cadastros_criados, '{}'::jsonb) || jsonb_build_object(
      'lojas', COALESCE((cadastros_criados->>'lojas')::int, 0) + v_lojas_criadas,
      'vendedores', COALESCE((cadastros_criados->>'vendedores')::int, 0) + v_vend_criados,
      'especificadores', COALESCE((cadastros_criados->>'especificadores')::int, 0) + v_esp_criados,
      'clientes', COALESCE((cadastros_criados->>'clientes')::int, 0) + v_cli_criados,
      'lojas_sem_canal', GREATEST(COALESCE((cadastros_criados->>'lojas_sem_canal')::int, 0), v_lojas_sem_canal),
      'inseridos', COALESCE((cadastros_criados->>'inseridos')::int, 0) + v_inseridos,
      'atualizados', COALESCE((cadastros_criados->>'atualizados')::int, 0) + v_atualizados
    )
  WHERE id = _log_id;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'lojas_criadas', v_lojas_criadas,
    'vendedores_criados', v_vend_criados,
    'especificadores_criados', v_esp_criados,
    'clientes_criados', v_cli_criados,
    'lojas_sem_canal', v_lojas_sem_canal,
    'remaining', v_remaining,
    'done', v_remaining = 0
  );
END;
$function$;