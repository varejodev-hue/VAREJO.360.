
-- Revoke default PUBLIC EXECUTE on all SECURITY DEFINER functions and grant only to authenticated where needed.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_is_global(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_global(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_can_see_loja(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_see_loja(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.gerar_followups_diarios() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.process_orcamentos_staging(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_orcamentos_staging(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.recalcular_oportunidades_campanha(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_oportunidades_campanha(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rastreabilidade_especificadores(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rastreabilidade_especificadores(int, int) TO authenticated;
