
-- Wrapper for the daily cron job
CREATE OR REPLACE FUNCTION public.cron_gerar_alertas_especificadores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fim date := CURRENT_DATE;
  v_inicio date := CURRENT_DATE - INTERVAL '90 days';
BEGIN
  PERFORM public.gerar_alertas_especificadores(v_inicio, v_fim, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.cron_gerar_alertas_especificadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_gerar_alertas_especificadores() TO service_role;

-- Unschedule if previously created, then re-schedule daily at 06:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('gerar-alertas-especificadores-diario');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'gerar-alertas-especificadores-diario',
  '0 6 * * *',
  $cron$ SELECT public.cron_gerar_alertas_especificadores(); $cron$
);
