
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_followup_auto_uniq
  ON public.tasks (orcamento_id, tipo, ((due_at AT TIME ZONE 'UTC')::date))
  WHERE tipo = 'followup' AND orcamento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gerar_followups_diarios()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_offset integer;
BEGIN
  FOREACH v_offset IN ARRAY ARRAY[2, 7, 15, 30] LOOP
    INSERT INTO public.tasks (titulo, tipo, due_at, status, orcamento_id, vendedor_id, especificador_id, cliente_id, loja_id, descricao)
    SELECT
      'Follow-up D+' || v_offset || ' — Orçamento ' || o.numero,
      'followup'::task_tipo,
      (CURRENT_DATE + INTERVAL '9 hours')::timestamptz,
      'pendente'::task_status,
      o.id,
      o.vendedor_id,
      o.especificador_id,
      o.cliente_id,
      o.loja_id,
      'Contato automático D+' || v_offset || ' dias após o orçamento.'
    FROM public.orcamentos o
    WHERE o.status = 'orcado'
      AND o.data_orcamento = (CURRENT_DATE - v_offset)::date
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END LOOP;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_followups_diarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_followups_diarios() TO service_role;

SELECT cron.unschedule('gerar-followups-diarios') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-followups-diarios');

SELECT cron.schedule(
  'gerar-followups-diarios',
  '0 9 * * *',
  $cron$ SELECT public.gerar_followups_diarios(); $cron$
);
