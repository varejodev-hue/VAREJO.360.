
ALTER TYPE public.canal_tipo ADD VALUE IF NOT EXISTS 'nao_classificado';

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS numero_pedido text;
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero_pedido ON public.orcamentos(numero_pedido) WHERE numero_pedido IS NOT NULL;
