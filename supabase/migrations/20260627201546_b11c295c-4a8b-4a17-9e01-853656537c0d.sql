
-- Auditoria de mudança de status de vendedores
CREATE TABLE public.vendedor_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  status_anterior boolean,
  status_novo boolean NOT NULL,
  motivo text,
  alterado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendedor_status_log TO authenticated;
GRANT ALL ON public.vendedor_status_log TO service_role;

ALTER TABLE public.vendedor_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e gestores leem auditoria"
ON public.vendedor_status_log FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'gerente_loja')
  OR public.has_role(auth.uid(),'gerente_regional')
  OR public.has_role(auth.uid(),'gerente_regional_franquia')
  OR public.has_role(auth.uid(),'head_propria')
  OR public.has_role(auth.uid(),'head_franquia')
  OR public.has_role(auth.uid(),'head_nacional_loja_propria')
  OR public.has_role(auth.uid(),'head_nacional_franquia')
);

CREATE INDEX idx_vendedor_status_log_vendedor ON public.vendedor_status_log(vendedor_id, created_at DESC);

-- RPC para alterar status do vendedor com auditoria
CREATE OR REPLACE FUNCTION public.set_vendedor_ativo(
  p_vendedor_id uuid,
  p_ativo boolean,
  p_motivo text DEFAULT NULL
) RETURNS public.vendedores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old boolean;
  v_loja uuid;
  v_row public.vendedores;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_user,'admin')
    OR public.has_role(v_user,'gerente_loja')
    OR public.has_role(v_user,'gerente_regional')
    OR public.has_role(v_user,'gerente_regional_franquia')
    OR public.has_role(v_user,'head_propria')
    OR public.has_role(v_user,'head_franquia')
    OR public.has_role(v_user,'head_nacional_loja_propria')
    OR public.has_role(v_user,'head_nacional_franquia')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar status de vendedor';
  END IF;

  SELECT ativo, loja_id INTO v_old, v_loja FROM public.vendedores WHERE id = p_vendedor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendedor não encontrado';
  END IF;

  UPDATE public.vendedores
     SET ativo = p_ativo, updated_at = now()
   WHERE id = p_vendedor_id
   RETURNING * INTO v_row;

  INSERT INTO public.vendedor_status_log(vendedor_id, loja_id, status_anterior, status_novo, motivo, alterado_por)
  VALUES (p_vendedor_id, v_loja, v_old, p_ativo, p_motivo, v_user);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vendedor_ativo(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_vendedor_ativo(uuid, boolean, text) TO authenticated;

-- RPC com KPIs de vendedores por loja (carteira, orçado/vendido no período)
CREATE OR REPLACE FUNCTION public.loja_vendedores_kpis(
  p_loja_id uuid,
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL
) RETURNS TABLE (
  vendedor_id uuid,
  nome text,
  email text,
  ativo boolean,
  carteira_qtd bigint,
  valor_orcado numeric,
  valor_vendido numeric,
  ultima_movimentacao timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id, v.nome, v.email, v.ativo,
    COALESCE(c.qtd, 0) AS carteira_qtd,
    COALESCE(o.valor_orcado, 0) AS valor_orcado,
    COALESCE(o.valor_vendido, 0) AS valor_vendido,
    o.ultima_movimentacao
  FROM public.vendedores v
  LEFT JOIN (
    SELECT vendedor_responsavel_id AS vid, COUNT(*) AS qtd
    FROM public.especificadores
    WHERE vendedor_responsavel_id IS NOT NULL
    GROUP BY vendedor_responsavel_id
  ) c ON c.vid = v.id
  LEFT JOIN (
    SELECT
      vendedor_id AS vid,
      SUM(valor_orcado) AS valor_orcado,
      SUM(valor_vendido) AS valor_vendido,
      MAX(data_orcamento) AS ultima_movimentacao
    FROM public.orcamentos
    WHERE loja_id = p_loja_id
      AND (p_inicio IS NULL OR data_orcamento >= p_inicio)
      AND (p_fim IS NULL OR data_orcamento <= p_fim)
    GROUP BY vendedor_id
  ) o ON o.vid = v.id
  WHERE v.loja_id = p_loja_id
  ORDER BY v.ativo DESC, v.nome;
$$;

REVOKE ALL ON FUNCTION public.loja_vendedores_kpis(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.loja_vendedores_kpis(uuid, date, date) TO authenticated;
