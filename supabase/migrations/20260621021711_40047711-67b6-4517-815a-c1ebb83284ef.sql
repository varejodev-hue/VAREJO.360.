
ALTER TABLE public.oportunidades
  ADD CONSTRAINT oportunidades_vendedor_fk FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ADD CONSTRAINT oportunidades_loja_fk FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE SET NULL,
  ADD CONSTRAINT oportunidades_cliente_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD CONSTRAINT oportunidades_especificador_fk FOREIGN KEY (especificador_id) REFERENCES public.especificadores(id) ON DELETE SET NULL;
