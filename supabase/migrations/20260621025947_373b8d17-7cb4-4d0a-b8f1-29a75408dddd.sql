
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'aberto';
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'em_negociacao';
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'cancelado';
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'reaberto';
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'reaproveitado';

CREATE TABLE IF NOT EXISTS public.orcamento_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  import_log_id uuid REFERENCES public.import_logs(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  arquivo text,
  status_anterior text,
  status_novo text,
  valor_anterior numeric(14,2),
  valor_novo numeric(14,2),
  campos_alterados jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_versoes_orcamento ON public.orcamento_versoes(orcamento_id, created_at DESC);

GRANT SELECT ON public.orcamento_versoes TO authenticated;
GRANT ALL ON public.orcamento_versoes TO service_role;

ALTER TABLE public.orcamento_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read versoes" ON public.orcamento_versoes
  FOR SELECT TO authenticated USING (true);
