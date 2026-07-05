
-- Revogar EXECUTE público de funções administrativas
REVOKE EXECUTE ON FUNCTION public.gerar_followups_diarios() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_oportunidades_campanha(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- campanhas / campanha_itens: escrita apenas por admin
DROP POLICY IF EXISTS campanhas_update_auth ON public.campanhas;
CREATE POLICY campanhas_admin_update ON public.campanhas
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS campanha_itens_all_auth ON public.campanha_itens;
CREATE POLICY campanha_itens_admin_write ON public.campanha_itens
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- eventos / evento_participantes: leitura aberta, escrita admin
DROP POLICY IF EXISTS eventos_write_auth ON public.eventos;
CREATE POLICY eventos_admin_write ON public.eventos
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS ep_write_auth ON public.evento_participantes;
CREATE POLICY ep_admin_write ON public.evento_participantes
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- orcamento_itens: escopo via orçamento pai
DROP POLICY IF EXISTS "auth write itens" ON public.orcamento_itens;
CREATE POLICY orcamento_itens_scoped_write ON public.orcamento_itens
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orcamentos o
    WHERE o.id = orcamento_itens.orcamento_id
      AND public.user_can_see_loja(auth.uid(), o.loja_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orcamentos o
    WHERE o.id = orcamento_itens.orcamento_id
      AND public.user_can_see_loja(auth.uid(), o.loja_id)
  )
);

-- oportunidades: insert restrito a admin (recálculo é feito por função SECURITY DEFINER do service_role)
DROP POLICY IF EXISTS oportunidades_insert_service ON public.oportunidades;
CREATE POLICY oportunidades_admin_insert ON public.oportunidades
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
