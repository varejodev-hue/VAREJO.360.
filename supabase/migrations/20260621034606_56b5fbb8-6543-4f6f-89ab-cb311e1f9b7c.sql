
-- Scope orcamento_versoes SELECT to users that can see the parent orcamento
DROP POLICY IF EXISTS "auth read versoes" ON public.orcamento_versoes;
CREATE POLICY orcamento_versoes_scoped_read
  ON public.orcamento_versoes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id = orcamento_versoes.orcamento_id
        AND public.user_can_see_loja(auth.uid(), o.loja_id)
    )
  );

-- Restrict import_logs SELECT to the owner or admin/global users
DROP POLICY IF EXISTS "auth read logs" ON public.import_logs;
CREATE POLICY import_logs_scoped_read
  ON public.import_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_is_global(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Restrict workflow_runs SELECT to admin/global only
DROP POLICY IF EXISTS "auth read runs" ON public.workflow_runs;
CREATE POLICY workflow_runs_admin_read
  ON public.workflow_runs FOR SELECT TO authenticated
  USING (
    public.user_is_global(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Allow authenticated users to read campaign items (mirrors campanhas read policy)
CREATE POLICY campanha_itens_auth_read
  ON public.campanha_itens FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
