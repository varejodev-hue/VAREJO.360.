
-- Forecast de vendas
CREATE TABLE public.forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escopo text NOT NULL DEFAULT 'global', -- global | loja | vendedor | regiao
  escopo_id uuid,
  horizonte_meses int NOT NULL DEFAULT 3,
  metodo text NOT NULL DEFAULT 'regressao_linear_sazonal',
  resultado jsonb NOT NULL, -- [{mes, previsto, otimista, pessimista, real?}]
  mape numeric, -- acurácia vs forecast anterior (%)
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecasts TO authenticated;
GRANT ALL ON public.forecasts TO service_role;

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth pode ler forecasts" ON public.forecasts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth pode criar forecasts" ON public.forecasts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = gerado_por);

CREATE POLICY "admin pode apagar" ON public.forecasts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- View de vendas mensais para alimentar o forecast
CREATE OR REPLACE VIEW public.vendas_mensais AS
SELECT
  date_trunc('month', data_venda)::date AS mes,
  loja_id,
  vendedor_id,
  COUNT(*) AS qtd,
  COALESCE(SUM(valor_vendido), 0)::numeric AS valor
FROM public.orcamentos
WHERE status IN ('vendido','parcial') AND data_venda IS NOT NULL
GROUP BY 1, 2, 3;

GRANT SELECT ON public.vendas_mensais TO authenticated;
