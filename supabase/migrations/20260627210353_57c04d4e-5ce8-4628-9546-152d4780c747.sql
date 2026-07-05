WITH ranked AS (
  SELECT vendedor_id, loja_id, COUNT(*) AS qtd,
         ROW_NUMBER() OVER (PARTITION BY vendedor_id ORDER BY COUNT(*) DESC) AS rn
  FROM public.orcamentos
  WHERE vendedor_id IS NOT NULL AND loja_id IS NOT NULL
  GROUP BY vendedor_id, loja_id
)
UPDATE public.vendedores v
SET loja_id = r.loja_id
FROM ranked r
WHERE r.vendedor_id = v.id
  AND r.rn = 1
  AND v.loja_id IS NULL;