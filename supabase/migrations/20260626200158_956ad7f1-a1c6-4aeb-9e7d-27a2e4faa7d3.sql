
CREATE OR REPLACE FUNCTION public.carteira_transferir(
  p_vendedor_destino uuid,
  p_esp_ids uuid[] DEFAULT NULL,
  p_vendedor_origem uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_loja uuid;
  v_owner uuid;
  v_email text;
  v_ids uuid[];
  v_count int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_vendedor_destino IS NULL THEN RAISE EXCEPTION 'Vendedor destino obrigatório'; END IF;

  SELECT loja_id, email INTO v_loja, v_email FROM public.vendedores WHERE id = p_vendedor_destino;
  SELECT id INTO v_owner FROM public.profiles WHERE email = v_email LIMIT 1;

  IF p_esp_ids IS NOT NULL AND array_length(p_esp_ids, 1) > 0 THEN
    v_ids := p_esp_ids;
  ELSIF p_vendedor_origem IS NOT NULL THEN
    SELECT array_agg(id) INTO v_ids FROM public.especificadores WHERE vendedor_responsavel_id = p_vendedor_origem;
  ELSE
    RAISE EXCEPTION 'Informe os especificadores ou o vendedor origem';
  END IF;

  IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.carteira_movimentacoes
    (especificador_id, loja_id, tipo, vendedor_anterior_id, vendedor_novo_id,
     status_anterior, status_novo, motivo, observacao, alterado_por)
  SELECT e.id, COALESCE(v_loja, e.loja_responsavel_id), 'transferencia',
    e.vendedor_responsavel_id, p_vendedor_destino,
    e.status_carteira,
    CASE WHEN e.status_carteira = 'sem_responsavel' THEN 'ativo'::carteira_status ELSE e.status_carteira END,
    p_motivo, p_observacao, v_user
  FROM public.especificadores e
  WHERE e.id = ANY(v_ids)
    AND (public.user_is_global(v_user) OR e.loja_responsavel_id IS NULL
         OR public.user_can_see_loja(v_user, e.loja_responsavel_id));

  UPDATE public.especificadores
  SET vendedor_responsavel_id = p_vendedor_destino,
      loja_responsavel_id = COALESCE(v_loja, loja_responsavel_id),
      status_carteira = CASE WHEN status_carteira = 'sem_responsavel' THEN 'ativo'::carteira_status ELSE status_carteira END,
      data_status_alterado = now(),
      motivo_status = COALESCE(p_motivo, motivo_status)
  WHERE id = ANY(v_ids)
    AND (public.user_is_global(v_user) OR loja_responsavel_id IS NULL
         OR public.user_can_see_loja(v_user, loja_responsavel_id));
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.tasks (owner_id, vendedor_id, loja_id, especificador_id, tipo, titulo, descricao, due_at)
    SELECT v_owner, p_vendedor_destino, v_loja, e.id, 'followup',
      'Primeiro contato — carteira recebida',
      COALESCE('Especificador transferido. Motivo: ' || p_motivo, 'Especificador transferido para sua carteira. Faça o primeiro contato de apresentação.'),
      (now() + interval '2 days')
    FROM public.especificadores e WHERE e.id = ANY(v_ids)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.carteira_transferir(uuid, uuid[], uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.carteira_transferir(uuid, uuid[], uuid, text, text) TO authenticated, service_role;
