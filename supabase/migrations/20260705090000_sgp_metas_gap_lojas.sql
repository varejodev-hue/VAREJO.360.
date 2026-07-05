-- Metas anuais por loja para medir gap executivo.

create table if not exists public.performance_metas_loja (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  ano integer not null,
  meta_anual numeric(14,2) not null default 0,
  meta_mensal jsonb not null default '{}'::jsonb,
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loja_id, ano)
);

alter table public.performance_metas_loja enable row level security;

create policy performance_metas_loja_auth_read on public.performance_metas_loja
  for select to authenticated using (true);

create policy performance_metas_loja_auth_write on public.performance_metas_loja
  for all to authenticated using (true) with check (true);

create index if not exists idx_performance_metas_loja_ano
  on public.performance_metas_loja (ano, loja_id);
