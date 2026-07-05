
CREATE TABLE public.transferencias_especificador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especificador_id uuid NOT NULL REFERENCES public.especificadores(id) ON DELETE CASCADE,
  loja_origem_id uuid REFERENCES public.lojas(id),
  vendedor_origem_id uuid REFERENCES public.vendedores(id),
  loja_destino_id uuid REFERENCES public.lojas(id),
  vendedor_destino_id uuid REFERENCES public.vendedores(id),
  motivo text NOT NULL,
  observacao text,
  responsavel_id uuid REFERENCES auth.users(id),
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  feedback text,
  resultado text,
  proxima_acao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transferencias_especificador TO authenticated;
GRANT ALL ON public.transferencias_especificador TO service_role;

ALTER TABLE public.transferencias_especificador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read transferencias" ON public.transferencias_especificador
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write transferencias" ON public.transferencias_especificador
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_transferencias_updated
  BEFORE UPDATE ON public.transferencias_especificador
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_transf_especificador ON public.transferencias_especificador(especificador_id);
CREATE INDEX idx_transf_data ON public.transferencias_especificador(data_transferencia);
