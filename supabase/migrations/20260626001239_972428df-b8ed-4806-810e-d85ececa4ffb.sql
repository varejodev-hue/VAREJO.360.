
CREATE TABLE IF NOT EXISTS public.especificadores_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especificador_id uuid NOT NULL REFERENCES public.especificadores(id) ON DELETE CASCADE,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('baixa_conversao','queda_valor','inativo','troca_vendedor','em_risco')),
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','ignorado')),
  titulo text NOT NULL,
  detalhe text,
  metrica numeric,
  periodo_inicio date,
  periodo_fim date,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS especificadores_alertas_open_uq
  ON public.especificadores_alertas(especificador_id, tipo)
  WHERE status = 'aberto';
CREATE INDEX IF NOT EXISTS especificadores_alertas_loja_idx ON public.especificadores_alertas(loja_id);
CREATE INDEX IF NOT EXISTS especificadores_alertas_status_idx ON public.especificadores_alertas(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.especificadores_alertas TO authenticated;
GRANT ALL ON public.especificadores_alertas TO service_role;

ALTER TABLE public.especificadores_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_select_scope" ON public.especificadores_alertas
  FOR SELECT TO authenticated
  USING (public.user_is_global(auth.uid()) OR loja_id IS NULL OR public.user_can_see_loja(auth.uid(), loja_id));

CREATE POLICY "alertas_update_scope" ON public.especificadores_alertas
  FOR UPDATE TO authenticated
  USING (public.user_is_global(auth.uid()) OR loja_id IS NULL OR public.user_can_see_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_is_global(auth.uid()) OR loja_id IS NULL OR public.user_can_see_loja(auth.uid(), loja_id));

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS especificadores_alertas_updated_at ON public.especificadores_alertas;
CREATE TRIGGER especificadores_alertas_updated_at
  BEFORE UPDATE ON public.especificadores_alertas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.gerar_alertas_especificadores(
  p_inicio date, p_fim date, p_loja uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; r record;
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
      DO UPDATE SET metrica=EXCLUDED.metrica, detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now();
      v_count := v_count + 1;
    END IF;

    IF r.delta_valor_pct IS NOT NULL AND r.delta_valor_pct <= -30 THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, metrica, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'queda_valor',
        CASE WHEN r.delta_valor_pct <= -50 THEN 'critica' ELSE 'alta' END,
        'Queda de faturamento vs período anterior',
        format('%s%% vs período anterior', round(r.delta_valor_pct,1)),
        r.delta_valor_pct, p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET metrica=EXCLUDED.metrica, detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now();
      v_count := v_count + 1;
    END IF;

    IF r.dias_sem_mov >= 90 THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, metrica, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'inativo',
        CASE WHEN r.dias_sem_mov >= 180 THEN 'critica' ELSE 'alta' END,
        format('Inativo há %s dias', r.dias_sem_mov),
        'Sem movimentação no período recente', r.dias_sem_mov, p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET metrica=EXCLUDED.metrica, detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now();
      v_count := v_count + 1;
    END IF;

    IF r.trocou_vendedor THEN
      INSERT INTO public.especificadores_alertas(especificador_id, loja_id, tipo, severidade, titulo, detalhe, periodo_inicio, periodo_fim)
      VALUES (r.especificador_id, r.loja_id, 'troca_vendedor', 'media',
        'Troca de vendedor identificada',
        format('De %s para %s', COALESCE(r.vendedor_anterior_nome,'—'), COALESCE(r.vendedor_atual_nome,'—')),
        p_inicio, p_fim)
      ON CONFLICT (especificador_id, tipo) WHERE status = 'aberto'
      DO UPDATE SET detalhe=EXCLUDED.detalhe, periodo_fim=EXCLUDED.periodo_fim, updated_at=now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

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
