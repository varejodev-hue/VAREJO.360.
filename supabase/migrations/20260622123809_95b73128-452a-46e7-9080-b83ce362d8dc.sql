
REVOKE EXECUTE ON FUNCTION public.user_is_global(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_see_loja(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
