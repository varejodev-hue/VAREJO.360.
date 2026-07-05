
-- 1. LOJAS: tipo propria vs franquia
DO $$ BEGIN
  CREATE TYPE public.loja_tipo AS ENUM ('propria','franquia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS tipo public.loja_tipo NOT NULL DEFAULT 'propria';

-- 2. CATEGORIAS hierárquicas
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  parent_id uuid REFERENCES public.categorias(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_read_auth" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_admin_write" ON public.categorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_categorias_updated BEFORE UPDATE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL;

-- Seed categorias (idempotente)
WITH parents AS (
  INSERT INTO public.categorias (nome, ordem) VALUES
    ('Revestimentos', 1),('Louças', 2),('Metais', 3),('Complementos', 4),('Banho', 5)
  ON CONFLICT (parent_id, nome) DO NOTHING
  RETURNING id, nome
), all_parents AS (
  SELECT id, nome FROM parents
  UNION SELECT id, nome FROM public.categorias WHERE parent_id IS NULL
)
INSERT INTO public.categorias (nome, parent_id, ordem)
SELECT sub.nome, p.id, sub.ordem FROM (VALUES
  ('Revestimentos','60x60',1),('Revestimentos','80x80',2),('Revestimentos','90x90',3),
  ('Revestimentos','60x120',4),('Revestimentos','120x120',5),('Revestimentos','Lastras',6),
  ('Louças','Cubas',1),('Louças','Bacias',2),('Louças','Acessórios',3),
  ('Metais','Monocomandos',1),('Metais','Misturadores',2),('Metais','Torneiras',3),
  ('Complementos','Argamassas',1),('Complementos','Rejuntes',2),
  ('Banho','Banheiras',1),('Banho','Spas',2)
) AS sub(pai, nome, ordem)
JOIN all_parents p ON p.nome = sub.pai
ON CONFLICT (parent_id, nome) DO NOTHING;

-- 3. ORÇAMENTOS: motivo de perda + status follow-up
DO $$ BEGIN
  CREATE TYPE public.motivo_perda AS ENUM ('preco','prazo','concorrencia','desistencia','sem_estoque','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.status_followup AS ENUM ('analisando','aguardando_aprovacao','comparando_concorrencia','sem_retorno','reagendar','em_negociacao','fechada','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS motivo_perda public.motivo_perda,
  ADD COLUMN IF NOT EXISTS status_followup public.status_followup;

-- 4. TASKS (Meu Dia + Follow-up automático)
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pendente','em_andamento','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.task_tipo AS ENUM ('followup','ligacao','whatsapp','email','visita','aniversario','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  especificador_id uuid REFERENCES public.especificadores(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo public.task_tipo NOT NULL DEFAULT 'followup',
  titulo text NOT NULL,
  descricao text,
  due_at timestamptz NOT NULL,
  status public.task_status NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_due ON public.tasks(owner_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_read_auth" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_write_auth" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. INTERAÇÕES com especificadores
DO $$ BEGIN
  CREATE TYPE public.interacao_tipo AS ENUM ('ligacao','whatsapp','email','visita','reuniao','evento','almoco','treinamento','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especificador_id uuid NOT NULL REFERENCES public.especificadores(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  tipo public.interacao_tipo NOT NULL,
  data_interacao timestamptz NOT NULL DEFAULT now(),
  observacao text,
  proxima_acao text,
  proxima_data date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interacoes_esp_data ON public.interacoes(especificador_id, data_interacao DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacoes TO authenticated;
GRANT ALL ON public.interacoes TO service_role;
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interacoes_read_auth" ON public.interacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "interacoes_write_auth" ON public.interacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_interacoes_updated BEFORE UPDATE ON public.interacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. EVENTOS + participantes (Agenda Comercial / ROI)
DO $$ BEGIN
  CREATE TYPE public.evento_tipo AS ENUM ('evento','visita','almoco','treinamento','happy_hour','cafe','reuniao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo public.evento_tipo NOT NULL DEFAULT 'evento',
  data_evento timestamptz NOT NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  investimento numeric(12,2) NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_read_auth" ON public.eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "eventos_write_auth" ON public.eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_eventos_updated BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.evento_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  especificador_id uuid REFERENCES public.especificadores(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (especificador_id IS NOT NULL OR cliente_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_ep_evento ON public.evento_participantes(evento_id);
CREATE INDEX IF NOT EXISTS idx_ep_esp ON public.evento_participantes(especificador_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evento_participantes TO authenticated;
GRANT ALL ON public.evento_participantes TO service_role;
ALTER TABLE public.evento_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_read_auth" ON public.evento_participantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ep_write_auth" ON public.evento_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. PERFIS hierárquicos (9 do spec)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_loja';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_regional';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_propria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_franquia';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analista_performance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_performance';
