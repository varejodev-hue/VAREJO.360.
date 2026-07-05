
-- Notificações: extender gerar_alertas para notificar usuários com escopo na loja
CREATE OR REPLACE FUNCTION public.gerar_alertas_especificadores(
  p_inicio date, p_fim date, p_loja uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  v_new_id uuid;
  r record;
BEGIN
  FOR r IN SELECT * FROM public.especificadores_conversao_analise(p_inicio, p_fim, p_loja, 'todos')
  LOOP
    IF r.qtd_orcamentos >= 5 AND r.conversao_valor_pct < 20 THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, metrica, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'baixa_conversao',
        CASE WHEN r.conversao_valor_pct < 10 THEN 'alta' ELSE 'media' END,
        'Conversão abaixo de 20%',
        format('%s%% em %s orçamentos', round(r.conversao_valor_pct,1), r.qtd_orcamentos),
        r.conversao_valor_pct, p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET metrica=EXCLUDED.metrica, detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now()
      RETURNING (xmax = 0) AS is_new, id INTO v_count, v_new_id;
      IF FOUND AND v_count::boolean THEN
        INSERT INTO public.notificacoes(user_id, titulo, mensagem, link, origem, lida)
        SELECT p.id, '⚠ Baixa conversão: ' || r.nome,
               format('%s%% em %s orçamentos', round(r.conversao_valor_pct,1), r.qtd_orcamentos),
               '/especificadores/alertas', 'alertas_especificadores', false
        FROM public.profiles p
        WHERE public.user_is_global(p.id) OR (r.loja_id IS NOT NULL AND public.user_can_see_loja(p.id, r.loja_id));
      END IF;
    END IF;

    IF r.delta_valor_pct IS NOT NULL AND r.delta_valor_pct <= -30 THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, metrica, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'queda_valor',
        CASE WHEN r.delta_valor_pct <= -50 THEN 'critica' ELSE 'alta' END,
        'Queda de faturamento vs período anterior',
        format('%s%% vs período anterior', round(r.delta_valor_pct,1)),
        r.delta_valor_pct, p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET metrica=EXCLUDED.metrica, detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now()
      RETURNING (xmax = 0) AS is_new, id INTO v_count, v_new_id;
      IF FOUND AND v_count::boolean THEN
        INSERT INTO public.notificacoes(user_id, titulo, mensagem, link, origem, lida)
        SELECT p.id, '📉 Queda de faturamento: ' || r.nome,
               format('%s%% vs período anterior', round(r.delta_valor_pct,1)),
               '/especificadores/alertas', 'alertas_especificadores', false
        FROM public.profiles p
        WHERE public.user_is_global(p.id) OR (r.loja_id IS NOT NULL AND public.user_can_see_loja(p.id, r.loja_id));
      END IF;
    END IF;

    IF r.dias_sem_mov >= 90 THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, metrica, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'inativo',
        CASE WHEN r.dias_sem_mov >= 180 THEN 'critica' ELSE 'alta' END,
        format('Inativo há %s dias', r.dias_sem_mov),
        'Sem movimentação no período recente', r.dias_sem_mov, p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET metrica=EXCLUDED.metrica, detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now()
      RETURNING (xmax = 0) AS is_new, id INTO v_count, v_new_id;
      IF FOUND AND v_count::boolean THEN
        INSERT INTO public.notificacoes(user_id, titulo, mensagem, link, origem, lida)
        SELECT p.id, '⏳ Inativo: ' || r.nome,
               format('Sem movimentação há %s dias', r.dias_sem_mov),
               '/especificadores/alertas', 'alertas_especificadores', false
        FROM public.profiles p
        WHERE public.user_is_global(p.id) OR (r.loja_id IS NOT NULL AND public.user_can_see_loja(p.id, r.loja_id));
      END IF;
    END IF;

    IF r.trocou_vendedor THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'troca_vendedor', 'media',
        'Troca de vendedor identificada',
        format('De %s para %s', COALESCE(r.vendedor_anterior_nome,'—'), COALESCE(r.vendedor_atual_nome,'—')),
        p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now()
      RETURNING (xmax = 0) AS is_new, id INTO v_count, v_new_id;
      IF FOUND AND v_count::boolean THEN
        INSERT INTO public.notificacoes(user_id, titulo, mensagem, link, origem, lida)
        SELECT p.id, '🔄 Troca de vendedor: ' || r.nome,
               format('De %s para %s', COALESCE(r.vendedor_anterior_nome,'—'), COALESCE(r.vendedor_atual_nome,'—')),
               '/especificadores/alertas', 'alertas_especificadores', false
        FROM public.profiles p
        WHERE public.user_is_global(p.id) OR (r.loja_id IS NOT NULL AND public.user_can_see_loja(p.id, r.loja_id));
      END IF;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_count FROM public.especificadores_alertas
  WHERE status='aberto' AND (p_loja IS NULL OR loja_id = p_loja);

  UPDATE public.especificadores_alertas a
  SET status='resolvido', resolved_at=now(), updated_at=now()
  WHERE a.status='aberto'
    AND (p_loja IS NULL OR a.loja_id = p_loja)
    AND NOT EXISTS (
      SELECT 1 FROM public.especificadores_conversao_analise(p_inicio, p_fim, p_loja, 'todos') x
      WHERE x.especificador_id = a.especificador_id AND (
        (a.tipo='baixa_conversao' AND x.qtd_orcamentos>=5 AND x.conversao_valor_pct<20) OR
        (a.tipo='queda_valor' AND x.delta_valor_pct IS NOT NULL AND x.delta_valor_pct<=-30) OR
        (a.tipo='inativo' AND x.dias_sem_mov>=90) OR
        (a.tipo='troca_vendedor' AND x.trocou_vendedor)
      )
    );

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.gerar_alertas_especificadores(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_alertas_especificadores(date, date, uuid) TO authenticated, service_role;

-- Rankings dedicados
CREATE OR REPLACE FUNCTION public.especificadores_rankings(
  p_inicio date, p_fim date, p_loja uuid DEFAULT NULL, p_tipo text DEFAULT 'mais_orcam', p_limite integer DEFAULT 10
) RETURNS TABLE(
  especificador_id uuid, nome text, loja_nome text,
  qtd_orcamentos integer, qtd_vendas integer,
  valor_orcado numeric, valor_vendido numeric,
  conversao_valor_pct numeric, delta_valor_pct numeric,
  dias_sem_mov integer, classificacao text, posicao integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.especificadores_conversao_analise(p_inicio, p_fim, p_loja, 'todos')
  ),
  ord AS (
    SELECT b.*,
      CASE p_tipo
        WHEN 'mais_orcam'  THEN ROW_NUMBER() OVER (ORDER BY b.qtd_orcamentos DESC NULLS LAST)
        WHEN 'mais_vendem' THEN ROW_NUMBER() OVER (ORDER BY b.valor_vendido DESC NULLS LAST)
        WHEN 'maior_conv'  THEN ROW_NUMBER() OVER (ORDER BY b.conversao_valor_pct DESC NULLS LAST)
        WHEN 'menor_conv'  THEN ROW_NUMBER() OVER (ORDER BY b.conversao_valor_pct ASC NULLS LAST)
        WHEN 'maior_queda' THEN ROW_NUMBER() OVER (ORDER BY b.delta_valor_pct ASC NULLS LAST)
        WHEN 'recuperados' THEN ROW_NUMBER() OVER (ORDER BY b.delta_valor_pct DESC NULLS LAST)
        WHEN 'inativos'    THEN ROW_NUMBER() OVER (ORDER BY b.dias_sem_mov DESC NULLS LAST)
        ELSE ROW_NUMBER() OVER (ORDER BY b.valor_vendido DESC NULLS LAST)
      END AS pos
    FROM base b
    WHERE
      (p_tipo NOT IN ('mais_orcam') OR b.qtd_orcamentos > 0) AND
      (p_tipo NOT IN ('mais_vendem','maior_conv') OR b.valor_vendido > 0) AND
      (p_tipo <> 'menor_conv' OR b.qtd_orcamentos >= 5) AND
      (p_tipo <> 'maior_queda' OR (b.delta_valor_pct IS NOT NULL AND b.delta_valor_pct < 0)) AND
      (p_tipo <> 'recuperados' OR (b.delta_valor_pct IS NOT NULL AND b.delta_valor_pct > 0)) AND
      (p_tipo <> 'inativos'    OR b.dias_sem_mov >= 60)
  )
  SELECT o.especificador_id, o.nome, o.loja_nome,
    o.qtd_orcamentos, o.qtd_vendas, o.valor_orcado, o.valor_vendido,
    o.conversao_valor_pct, o.delta_valor_pct, o.dias_sem_mov, o.classificacao, o.pos::int
  FROM ord o
  WHERE o.pos <= p_limite
  ORDER BY o.pos;
END $$;

REVOKE ALL ON FUNCTION public.especificadores_rankings(date, date, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.especificadores_rankings(date, date, uuid, text, integer) TO authenticated, service_role;
