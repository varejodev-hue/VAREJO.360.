ALTER FUNCTION public.turnover_especificadores_migracao(date, date, uuid) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turnover_especificadores_migracao(date, date, uuid) TO service_role;