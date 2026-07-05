
-- Distribuição agregada por (especificador, loja) — para listar todas as lojas onde cada especificador da carteira filtrada movimentou no período
CREATE OR REPLACE FUNCTION public.carteira_esp_distribuicao_lojas(
  p_loja uuid DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_inicio date DEFAULT (CURRENT_DATE - INTERVAL '180 days')::date,
  p_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  especificador_id uuid,
  loja_id uuid,
  loja_nome text,
  valor_orcado numeric,
  valor_vendido numeric,
  qtd_orcamentos integer,
  ultimo_orcamento date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH scope AS (SELECT public.user_is_global(auth.uid()) AS is_global),
  esp_ids AS (
    SELECT e.id FROM public.especificadores e, scope s
    WHERE (p_vendedor IS NULL OR e.vendedor_responsavel_id = p_vendedor)
      AND (p_loja IS NULL OR e.loja_responsavel_id = p_loja)
      AND (s.is_global OR e.loja_responsavel_id IS NULL OR public.user_can_see_loja(auth.uid(), e.loja_responsavel_id))
  )
  SELECT o.especificador_id, o.loja_id, l.nome,
    COALESCE(SUM(o.valor_orcado),0)::numeric,
    COALESCE(SUM(o.valor_vendido),0)::numeric,
    COUNT(*)::int,
    MAX(o.data_orcamento)
  FROM public.orcamentos o
  JOIN esp_ids x ON x.id = o.especificador_id
  LEFT JOIN public.lojas l ON l.id = o.loja_id
  WHERE o.data_orcamento BETWEEN p_inicio AND p_fim
  GROUP BY o.especificador_id, o.loja_id, l.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.carteira_esp_distribuicao_lojas(uuid,uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.carteira_esp_distribuicao_lojas(uuid,uuid,date,date) TO authenticated, service_role;

-- Detalhe de um especificador por (loja, vendedor) — usado no drawer
CREATE OR REPLACE FUNCTION public.carteira_esp_distribuicao_detalhe(
  p_esp uuid,
  p_inicio date DEFAULT (CURRENT_DATE - INTERVAL '180 days')::date,
  p_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  vendedor_id uuid,
  vendedor_nome text,
  valor_orcado numeric,
  valor_vendido numeric,
  qtd_orcamentos integer,
  ultimo_orcamento date,
  ultima_venda date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.loja_id, l.nome, o.vendedor_id, v.nome,
    COALESCE(SUM(o.valor_orcado),0)::numeric,
    COALESCE(SUM(o.valor_vendido),0)::numeric,
    COUNT(*)::int,
    MAX(o.data_orcamento),
    MAX(o.data_venda)
  FROM public.orcamentos o
  LEFT JOIN public.lojas l ON l.id = o.loja_id
  LEFT JOIN public.vendedores v ON v.id = o.vendedor_id
  WHERE o.especificador_id = p_esp
    AND o.data_orcamento BETWEEN p_inicio AND p_fim
  GROUP BY o.loja_id, l.nome, o.vendedor_id, v.nome
  ORDER BY 5 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.carteira_esp_distribuicao_detalhe(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.carteira_esp_distribuicao_detalhe(uuid,date,date) TO authenticated, service_role;
