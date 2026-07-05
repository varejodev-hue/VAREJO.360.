
-- Add product columns
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS linha text,
  ADD COLUMN IF NOT EXISTS formato text,
  ADD COLUMN IF NOT EXISTS tamanho text,
  ADD COLUMN IF NOT EXISTS codigo_produto text,
  ADD COLUMN IF NOT EXISTS descricao_produto text;

ALTER TABLE public.orcamentos_staging
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS linha text,
  ADD COLUMN IF NOT EXISTS formato text,
  ADD COLUMN IF NOT EXISTS tamanho text,
  ADD COLUMN IF NOT EXISTS codigo_produto text,
  ADD COLUMN IF NOT EXISTS descricao_produto text;

CREATE INDEX IF NOT EXISTS idx_orcamentos_loja_categoria ON public.orcamentos(loja_id, categoria);
CREATE INDEX IF NOT EXISTS idx_orcamentos_loja_linha ON public.orcamentos(loja_id, linha);

-- Update process function to include product fields
CREATE OR REPLACE FUNCTION public.process_orcamentos_staging(_log_id uuid)
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
  v_sucesso int := 0;
  v_lojas_sem_canal int := 0;
  v_total int := 0;
BEGIN
  SELECT public.has_role(v_user, 'admin') INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar importação.';
  END IF;

  SELECT count(*) INTO v_total FROM public.orcamentos_staging WHERE log_id = _log_id;

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
         OR (lower(s.canal) NOT LIKE '%propri%'
             AND lower(s.canal) NOT LIKE '%própri%'
             AND lower(s.canal) NOT LIKE '%franqu%'
             AND lower(s.canal) NOT LIKE '%own%'
             AND lower(s.canal) NOT LIKE '%franch%'));

  WITH novos AS (
    SELECT DISTINCT ON (lower(s.vendedor)) s.vendedor AS nome
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id AND s.vendedor IS NOT NULL AND s.vendedor <> ''
      AND NOT EXISTS (SELECT 1 FROM public.vendedores v WHERE lower(v.nome) = lower(s.vendedor))
  ), ins AS (INSERT INTO public.vendedores (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_vend_criados FROM ins;

  WITH novos AS (
    SELECT DISTINCT ON (lower(s.especificador)) s.especificador AS nome
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id AND s.especificador IS NOT NULL AND s.especificador <> ''
      AND NOT EXISTS (SELECT 1 FROM public.especificadores e WHERE lower(e.nome) = lower(s.especificador))
  ), ins AS (INSERT INTO public.especificadores (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_esp_criados FROM ins;

  WITH novos AS (
    SELECT DISTINCT ON (lower(s.cliente)) s.cliente AS nome
    FROM public.orcamentos_staging s
    WHERE s.log_id = _log_id AND s.cliente IS NOT NULL AND s.cliente <> ''
      AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE lower(c.nome) = lower(s.cliente))
  ), ins AS (INSERT INTO public.clientes (nome) SELECT nome FROM novos RETURNING 1)
  SELECT count(*) INTO v_cli_criados FROM ins;

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
      NULLIF(s.categoria,'') AS categoria,
      NULLIF(s.linha,'') AS linha,
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
    WHERE s.log_id = _log_id
      AND s.numero IS NOT NULL AND s.numero <> ''
      AND s.data_orcamento IS NOT NULL
      AND l.id IS NOT NULL
  ), normed AS (
    SELECT
      numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, observacao,
      categoria, linha, formato, tamanho, codigo_produto, descricao_produto,
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
      cliente_id, valor_orcado, valor_vendido, data_venda, status, observacao, import_log_id,
      categoria, linha, formato, tamanho, codigo_produto, descricao_produto
    )
    SELECT
      numero, numero_pedido, data_orcamento, loja_id, vendedor_id, especificador_id,
      cliente_id, valor_orcado, valor_vendido, data_venda, status, observacao, _log_id,
      categoria, linha, formato, tamanho, codigo_produto, descricao_produto
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
      linha = COALESCE(EXCLUDED.linha, o.linha),
      formato = COALESCE(EXCLUDED.formato, o.formato),
      tamanho = COALESCE(EXCLUDED.tamanho, o.tamanho),
      codigo_produto = COALESCE(EXCLUDED.codigo_produto, o.codigo_produto),
      descricao_produto = COALESCE(EXCLUDED.descricao_produto, o.descricao_produto),
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
$function$;

-- Perfil de produtos por loja
CREATE OR REPLACE FUNCTION public.lojas_perfil_produtos(p_inicio date, p_fim date, p_lojas uuid[])
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  cobertura_pct numeric,
  top_categorias jsonb,
  top_linhas jsonb,
  top_formatos jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT o.loja_id,
      NULLIF(trim(o.categoria),'') AS categoria,
      NULLIF(trim(o.linha),'') AS linha,
      NULLIF(trim(o.formato),'') AS formato,
      COALESCE(NULLIF(o.valor_vendido,0), o.valor_orcado) AS valor
    FROM public.orcamentos o
    WHERE o.loja_id = ANY(p_lojas)
      AND o.data_orcamento BETWEEN p_inicio AND p_fim
  ),
  cobertura AS (
    SELECT loja_id,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE categoria IS NOT NULL OR linha IS NOT NULL OR formato IS NOT NULL) AS preench
    FROM base GROUP BY loja_id
  ),
  cat AS (
    SELECT loja_id, categoria AS nome, SUM(valor) AS v, COUNT(*) AS q,
      ROW_NUMBER() OVER (PARTITION BY loja_id ORDER BY SUM(valor) DESC) AS rn
    FROM base WHERE categoria IS NOT NULL
    GROUP BY loja_id, categoria
  ),
  lin AS (
    SELECT loja_id, linha AS nome, SUM(valor) AS v, COUNT(*) AS q,
      ROW_NUMBER() OVER (PARTITION BY loja_id ORDER BY SUM(valor) DESC) AS rn
    FROM base WHERE linha IS NOT NULL
    GROUP BY loja_id, linha
  ),
  fmt AS (
    SELECT loja_id, formato AS nome, SUM(valor) AS v, COUNT(*) AS q,
      ROW_NUMBER() OVER (PARTITION BY loja_id ORDER BY SUM(valor) DESC) AS rn
    FROM base WHERE formato IS NOT NULL
    GROUP BY loja_id, formato
  ),
  cat_j AS (
    SELECT loja_id, jsonb_agg(jsonb_build_object('nome',nome,'valor',v,'qtd',q) ORDER BY rn) AS items
    FROM cat WHERE rn<=5 GROUP BY loja_id
  ),
  lin_j AS (
    SELECT loja_id, jsonb_agg(jsonb_build_object('nome',nome,'valor',v,'qtd',q) ORDER BY rn) AS items
    FROM lin WHERE rn<=5 GROUP BY loja_id
  ),
  fmt_j AS (
    SELECT loja_id, jsonb_agg(jsonb_build_object('nome',nome,'valor',v,'qtd',q) ORDER BY rn) AS items
    FROM fmt WHERE rn<=5 GROUP BY loja_id
  )
  SELECT
    l.id, l.nome,
    CASE WHEN COALESCE(c.total,0)>0 THEN ROUND((c.preench::numeric/c.total)*100,2) ELSE 0 END,
    COALESCE(cj.items,'[]'::jsonb),
    COALESCE(lj.items,'[]'::jsonb),
    COALESCE(fj.items,'[]'::jsonb)
  FROM public.lojas l
  LEFT JOIN cobertura c ON c.loja_id = l.id
  LEFT JOIN cat_j cj ON cj.loja_id = l.id
  LEFT JOIN lin_j lj ON lj.loja_id = l.id
  LEFT JOIN fmt_j fj ON fj.loja_id = l.id
  WHERE l.id = ANY(p_lojas)
  ORDER BY l.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.lojas_perfil_produtos(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lojas_perfil_produtos(date, date, uuid[]) TO authenticated, service_role;
