
-- Status enum
CREATE TYPE public.orcamento_status AS ENUM ('orcado','vendido','perdido','parcial');

-- Orcamentos
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  data_orcamento DATE NOT NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  especificador_id UUID REFERENCES public.especificadores(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  valor_orcado NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_vendido NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_venda DATE,
  status public.orcamento_status NOT NULL DEFAULT 'orcado',
  observacao TEXT,
  import_log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero, loja_id)
);
CREATE INDEX ON public.orcamentos (data_orcamento);
CREATE INDEX ON public.orcamentos (especificador_id);
CREATE INDEX ON public.orcamentos (vendedor_id);
CREATE INDEX ON public.orcamentos (loja_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write orcamentos" ON public.orcamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Itens
CREATE TABLE public.orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao TEXT,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.orcamento_itens (orcamento_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO authenticated;
GRANT ALL ON public.orcamento_itens TO service_role;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read itens" ON public.orcamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write itens" ON public.orcamento_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Import logs
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  total_linhas INT NOT NULL DEFAULT 0,
  total_sucesso INT NOT NULL DEFAULT 0,
  total_erro INT NOT NULL DEFAULT 0,
  cadastros_criados JSONB NOT NULL DEFAULT '{}'::jsonb,
  erros JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_logs TO authenticated;
GRANT ALL ON public.import_logs TO service_role;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read logs" ON public.import_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write logs" ON public.import_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_import_log_fk FOREIGN KEY (import_log_id) REFERENCES public.import_logs(id) ON DELETE SET NULL;
