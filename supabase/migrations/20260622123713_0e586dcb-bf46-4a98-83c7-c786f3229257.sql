
-- Campaigns: restrict insert/delete to admins or global users
DROP POLICY IF EXISTS campanhas_insert_auth ON public.campanhas;
CREATE POLICY campanhas_insert_admin ON public.campanhas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_is_global(auth.uid()));

DROP POLICY IF EXISTS campanhas_delete_auth ON public.campanhas;
CREATE POLICY campanhas_delete_admin ON public.campanhas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.user_is_global(auth.uid()));

-- Event participants: scope reads via event's loja_id
DROP POLICY IF EXISTS ep_read_auth ON public.evento_participantes;
CREATE POLICY ep_read_scoped ON public.evento_participantes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.eventos e
      WHERE e.id = evento_participantes.evento_id
        AND public.user_can_see_loja(auth.uid(), e.loja_id)
    )
  );

-- Forecasts: restrict reads to global/admin users
DROP POLICY IF EXISTS "auth pode ler forecasts" ON public.forecasts;
CREATE POLICY forecasts_select_global ON public.forecasts
  FOR SELECT TO authenticated
  USING (public.user_is_global(auth.uid()));

-- Order line items: remove overly broad read policy so the scoped policy governs access
DROP POLICY IF EXISTS "auth read itens" ON public.orcamento_itens;
