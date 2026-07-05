CREATE TABLE public.turnover_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  meses_pausa int NOT NULL DEFAULT 2,
  janela_vendedor_principal_meses int NOT NULL DEFAULT 6,
  janela_comparacao_meses int NOT NULL DEFAULT 3,
  tolerancia_recuperacao_total_pct numeric NOT NULL DEFAULT -5,
  recuperacao_parcial_min_pct numeric NOT NULL DEFAULT 30,
  recuperacao_parcial_max_pct numeric NOT NULL DEFAULT 95,
  sem_recuperacao_max_pct numeric NOT NULL DEFAULT 30,
  alerta_queda_sem_turnover_pct numeric NOT NULL DEFAULT 40,
  alerta_queda_conversao_pp numeric NOT NULL DEFAULT 30,
  alerta_carteira_nao_recuperada_pct numeric NOT NULL DEFAULT 50,
  janela_loja_predominante_meses int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turnover_parametros TO authenticated;
GRANT ALL ON public.turnover_parametros TO service_role;

ALTER TABLE public.turnover_parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turnover_parametros_select_auth"
  ON public.turnover_parametros FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "turnover_parametros_admin_insert"
  ON public.turnover_parametros FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "turnover_parametros_admin_update"
  ON public.turnover_parametros FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "turnover_parametros_admin_delete"
  ON public.turnover_parametros FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER turnover_parametros_set_updated_at
  BEFORE UPDATE ON public.turnover_parametros
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.turnover_parametros (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;