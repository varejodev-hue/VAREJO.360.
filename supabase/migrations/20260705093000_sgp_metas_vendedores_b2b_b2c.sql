-- Metas por vendedor, com separacao B2B/B2C e metas por valor ou percentual.

create table if not exists public.performance_metas_vendedor (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  ano integer not null,
  mes integer check (mes between 1 and 12),
  meta_total_valor numeric(14,2) not null default 0,
  meta_b2b_valor numeric(14,2) not null default 0,
  meta_b2c_valor numeric(14,2) not null default 0,
  meta_b2b_pct numeric(6,2),
  meta_b2c_pct numeric(6,2),
  meta_conversao_pct numeric(6,2),
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendedor_id, ano, mes)
);

alter table public.performance_metas_vendedor enable row level security;

create policy performance_metas_vendedor_auth_read on public.performance_metas_vendedor
  for select to authenticated using (true);

create policy performance_metas_vendedor_auth_write on public.performance_metas_vendedor
  for all to authenticated using (true) with check (true);

create index if not exists idx_performance_metas_vendedor_periodo
  on public.performance_metas_vendedor (ano, mes, loja_id, vendedor_id);
