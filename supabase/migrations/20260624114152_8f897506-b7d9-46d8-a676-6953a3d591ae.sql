-- Revoke public/anon EXECUTE on SECURITY DEFINER functions; keep authenticated where appropriate
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;
END $$;

-- Internal trigger/util functions: also revoke from authenticated
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated can call the RPCs the app uses
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_global(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_see_loja(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_orcamentos_staging(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_followups_diarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_oportunidades_campanha(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rastreabilidade_especificadores(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_grupo_controle(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_eventos_carteira(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_especificador_vendedor_principal(date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_vendedores_resumo(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) TO authenticated;