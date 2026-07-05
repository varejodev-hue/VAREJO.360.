
-- ENUMs
CREATE TYPE public.workflow_trigger AS ENUM ('orcamento_criado','task_vencida','especificador_inativo');
CREATE TYPE public.workflow_action_tipo AS ENUM ('criar_task','criar_interacao','notificar_usuario');
CREATE TYPE public.workflow_run_status AS ENUM ('sucesso','erro','simulado');

-- workflows
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  gatilho public.workflow_trigger NOT NULL,
  condicoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read workflows" ON public.workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write workflows" ON public.workflows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at_workflows BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- workflow_actions
CREATE TABLE public.workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tipo public.workflow_action_tipo NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_actions TO authenticated;
GRANT ALL ON public.workflow_actions TO service_role;
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read wfa" ON public.workflow_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write wfa" ON public.workflow_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_wfa_workflow ON public.workflow_actions(workflow_id);

-- workflow_runs
CREATE TABLE public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status public.workflow_run_status NOT NULL,
  gatilho public.workflow_trigger NOT NULL,
  payload JSONB,
  acoes_resultado JSONB,
  observacao TEXT,
  executado_por UUID,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read runs" ON public.workflow_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert runs" ON public.workflow_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_wfr_workflow ON public.workflow_runs(workflow_id, executado_em DESC);

-- notificacoes
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  origem TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notif" ON public.notificacoes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user updates own notif" ON public.notificacoes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth insert notif" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "user deletes own notif" ON public.notificacoes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_notif_user ON public.notificacoes(user_id, lida, created_at DESC);
