
-- 1. user_can_see_loja: bloquear loja_id nulo para não-globais
CREATE OR REPLACE FUNCTION public.user_can_see_loja(_user_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.user_is_global(_user_id)
    OR (
      _loja_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        LEFT JOIN public.lojas l ON l.id = _loja_id
        WHERE p.id = _user_id
          AND (
            p.loja_id = _loja_id
            OR (p.regiao_id IS NOT NULL AND p.regiao_id = l.regiao_id)
          )
      )
    )
$$;

-- 2. clientes / especificadores: escopo via orcamentos
DROP POLICY IF EXISTS clientes_auth_read ON public.clientes;
CREATE POLICY clientes_scoped_read ON public.clientes
FOR SELECT TO authenticated
USING (
  public.user_is_global(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.orcamentos o
    WHERE o.cliente_id = clientes.id
      AND public.user_can_see_loja(auth.uid(), o.loja_id)
  )
);

DROP POLICY IF EXISTS especificadores_auth_read ON public.especificadores;
CREATE POLICY especificadores_scoped_read ON public.especificadores
FOR SELECT TO authenticated
USING (
  public.user_is_global(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.orcamentos o
    WHERE o.especificador_id = especificadores.id
      AND public.user_can_see_loja(auth.uid(), o.loja_id)
  )
);

-- 3. vendedores / coordenadores / gerentes: escopo por loja/região
DROP POLICY IF EXISTS vendedores_auth_read ON public.vendedores;
CREATE POLICY vendedores_scoped_read ON public.vendedores
FOR SELECT TO authenticated
USING (public.user_can_see_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS coordenadores_auth_read ON public.coordenadores;
CREATE POLICY coordenadores_scoped_read ON public.coordenadores
FOR SELECT TO authenticated
USING (public.user_can_see_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS gerentes_auth_read ON public.gerentes;
CREATE POLICY gerentes_scoped_read ON public.gerentes
FOR SELECT TO authenticated
USING (
  public.user_is_global(auth.uid())
  OR public.user_can_see_loja(auth.uid(), loja_id)
);

-- 4. interacoes: escopo por loja
DROP POLICY IF EXISTS interacoes_read_auth ON public.interacoes;
DROP POLICY IF EXISTS interacoes_write_auth ON public.interacoes;
CREATE POLICY interacoes_scoped_read ON public.interacoes
FOR SELECT TO authenticated
USING (public.user_can_see_loja(auth.uid(), loja_id));
CREATE POLICY interacoes_scoped_write ON public.interacoes
FOR ALL TO authenticated
USING (public.user_can_see_loja(auth.uid(), loja_id))
WITH CHECK (public.user_can_see_loja(auth.uid(), loja_id));

-- 5. transferencias_especificador: escopo por loja origem/destino
DROP POLICY IF EXISTS auth_read_transferencias ON public.transferencias_especificador;
DROP POLICY IF EXISTS "auth read transferencias" ON public.transferencias_especificador;
DROP POLICY IF EXISTS auth_write_transferencias ON public.transferencias_especificador;
DROP POLICY IF EXISTS "auth write transferencias" ON public.transferencias_especificador;
CREATE POLICY transferencias_scoped_read ON public.transferencias_especificador
FOR SELECT TO authenticated
USING (
  public.user_can_see_loja(auth.uid(), loja_origem_id)
  OR public.user_can_see_loja(auth.uid(), loja_destino_id)
);
CREATE POLICY transferencias_admin_write ON public.transferencias_especificador
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. notificacoes: usuário só pode criar para si (anti-spoofing)
DROP POLICY IF EXISTS "auth insert notif" ON public.notificacoes;
CREATE POLICY notif_user_insert_self ON public.notificacoes
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 7. workflows / workflow_actions / workflow_runs: leitura aberta, escrita só admin
DROP POLICY IF EXISTS "auth write workflows" ON public.workflows;
CREATE POLICY workflows_admin_write ON public.workflows
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth write wfa" ON public.workflow_actions;
CREATE POLICY wfa_admin_write ON public.workflow_actions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth insert runs" ON public.workflow_runs;
CREATE POLICY wfruns_admin_insert ON public.workflow_runs
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. import_logs: insert apenas próprio usuário
DROP POLICY IF EXISTS "auth write logs" ON public.import_logs;
CREATE POLICY import_logs_user_insert ON public.import_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY import_logs_admin_modify ON public.import_logs
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY import_logs_admin_delete ON public.import_logs
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 9. View vendas_mensais com security_invoker (respeita RLS do consumidor)
ALTER VIEW public.vendas_mensais SET (security_invoker = on);
