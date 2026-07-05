
CREATE TYPE public.novidade_tipo AS ENUM ('nova_funcionalidade','melhoria','correcao','nova_regra','novo_indicador');

CREATE TABLE public.novidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  tipo public.novidade_tipo NOT NULL DEFAULT 'nova_funcionalidade',
  descricao TEXT NOT NULL,
  modulo TEXT,
  perfis TEXT[] NOT NULL DEFAULT '{}',
  regra_alterada TEXT,
  link TEXT,
  publicado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novidades TO authenticated;
GRANT ALL ON public.novidades TO service_role;
ALTER TABLE public.novidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read novidades" ON public.novidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write novidades" ON public.novidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.novidades_leituras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novidade_id UUID NOT NULL REFERENCES public.novidades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (novidade_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.novidades_leituras TO authenticated;
GRANT ALL ON public.novidades_leituras TO service_role;
ALTER TABLE public.novidades_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own leituras" ON public.novidades_leituras FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user insert leituras" ON public.novidades_leituras FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user delete leituras" ON public.novidades_leituras FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.onboarding_status (
  user_id UUID PRIMARY KEY,
  concluido BOOLEAN NOT NULL DEFAULT false,
  passo INT NOT NULL DEFAULT 0,
  dispensado BOOLEAN NOT NULL DEFAULT false,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_status TO authenticated;
GRANT ALL ON public.onboarding_status TO service_role;
ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own onboarding" ON public.onboarding_status FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user upsert onboarding" ON public.onboarding_status FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user update onboarding" ON public.onboarding_status FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER set_updated_at_onboarding BEFORE UPDATE ON public.onboarding_status FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.novidades (titulo, tipo, descricao, modulo, perfis, link) VALUES
('Forecast de Vendas','novo_indicador','Projeção mensal automática com regressão linear e ajuste sazonal. Acompanhe MAPE para medir acurácia.','Performance','{gerente_loja,gerente_regional,head_nacional_loja_propria,head_nacional_franquia,analista_performance,gerente_performance,admin}','/performance/forecast'),
('Workflows (Automações)','nova_funcionalidade','Crie regras Quando→Se→Então. Comece em modo simulação e ative quando estiver seguro.','Configurações','{admin,gerente_performance}','/configuracoes/workflows'),
('Central de Ajuda','nova_funcionalidade','Novo módulo Ajuda com guia, indicadores, regras, FAQ, novidades e histórico.','Ajuda','{}','/ajuda');
