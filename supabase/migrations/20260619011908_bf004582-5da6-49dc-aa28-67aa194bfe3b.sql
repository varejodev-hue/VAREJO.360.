
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regiao_id uuid REFERENCES public.regioes(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.user_is_global(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','head_nacional_loja_propria','head_nacional_franquia','analista_performance','gerente_performance')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_loja(_user_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _loja_id IS NULL
    OR public.user_is_global(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.lojas l ON l.id = _loja_id
      WHERE p.id = _user_id
        AND (
          p.loja_id = _loja_id
          OR (p.regiao_id IS NOT NULL AND p.regiao_id = l.regiao_id)
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.user_is_global(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_see_loja(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "auth read orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "auth write orcamentos" ON public.orcamentos;

CREATE POLICY orcamentos_scope_read ON public.orcamentos
  FOR SELECT TO authenticated
  USING (public.user_can_see_loja(auth.uid(), loja_id));

CREATE POLICY orcamentos_scope_write ON public.orcamentos
  FOR ALL TO authenticated
  USING (public.user_can_see_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_can_see_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS tasks_read_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_update_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_write_auth ON public.tasks;

CREATE POLICY tasks_scope_read ON public.tasks
  FOR SELECT TO authenticated
  USING (public.user_can_see_loja(auth.uid(), loja_id));

CREATE POLICY tasks_scope_write ON public.tasks
  FOR ALL TO authenticated
  USING (public.user_can_see_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_can_see_loja(auth.uid(), loja_id));
