
-- Restringir writes para admin (Fase 1: só admin gerencia cadastros)
DROP POLICY IF EXISTS "especificadores_auth_write" ON public.especificadores;
CREATE POLICY "especificadores_admin_write" ON public.especificadores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "clientes_auth_write" ON public.clientes;
CREATE POLICY "clientes_admin_write" ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Revogar execução pública das funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
