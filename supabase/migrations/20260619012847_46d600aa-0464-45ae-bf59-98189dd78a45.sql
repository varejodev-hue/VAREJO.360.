
CREATE TABLE IF NOT EXISTS public.parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  descricao text,
  grupo text DEFAULT 'geral',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.parametros TO authenticated;
GRANT ALL ON public.parametros TO service_role;

ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY parametros_read ON public.parametros FOR SELECT TO authenticated USING (true);
CREATE POLICY parametros_admin_write ON public.parametros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_parametros_updated_at BEFORE UPDATE ON public.parametros
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.parametros (chave, valor, descricao, grupo) VALUES
  ('followup_dias_criticos', '90', 'Dias após orçamento para classificar como crítico', 'followup'),
  ('followup_offsets', '2,7,15,30', 'Dias D+ para follow-up automático', 'followup'),
  ('meta_conversao_pct', '25', 'Meta de conversão (orçado → vendido) em %', 'metas'),
  ('especificador_inativo_dias', '180', 'Dias sem movimentação para classificar como inativo', 'especificadores')
ON CONFLICT (chave) DO NOTHING;
