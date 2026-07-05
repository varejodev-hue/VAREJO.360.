
CREATE OR REPLACE FUNCTION public.lojas_perfil_evolucao(p_inicio date, p_fim date, p_lojas uuid[])
RETURNS TABLE(loja_id uuid, loja_nome text, mes date, valor_orcado numeric, valor_vendido numeric, qtd_orcamentos integer, qtd_vendas integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.nome,
    date_trunc('month', o.data_orcamento)::date AS mes,
    COALESCE(SUM(o.valor_orcado),0),
    COALESCE(SUM(o.valor_vendido),0),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE COALESCE(o.valor_vendido,0)>0)::int
  FROM public.lojas l
  LEFT JOIN public.orcamentos o
    ON o.loja_id = l.id AND o.data_orcamento BETWEEN p_inicio AND p_fim
  WHERE l.id = ANY(p_lojas)
  GROUP BY l.id, l.nome, date_trunc('month', o.data_orcamento)
  ORDER BY l.nome, mes;
END;
$$;

REVOKE ALL ON FUNCTION public.lojas_perfil_evolucao(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lojas_perfil_evolucao(date, date, uuid[]) TO authenticated, service_role;
