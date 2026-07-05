-- Amplia metas de vendedor para medicao mensal, trimestral, semestral e anual.

alter table public.performance_metas_vendedor
  add column if not exists periodo_tipo text not null default 'mensal'
    check (periodo_tipo in ('mensal', 'trimestral', 'semestral', 'anual')),
  add column if not exists periodo_numero integer not null default 0;

update public.performance_metas_vendedor
set
  periodo_tipo = case when mes is null then 'anual' else 'mensal' end,
  periodo_numero = coalesce(mes, 0)
where periodo_tipo = 'mensal' and periodo_numero = 0;

create unique index if not exists performance_metas_vendedor_periodo_uniq
  on public.performance_metas_vendedor (vendedor_id, ano, periodo_tipo, periodo_numero);

create index if not exists idx_performance_metas_vendedor_periodo_tipo
  on public.performance_metas_vendedor (ano, periodo_tipo, periodo_numero, loja_id);
