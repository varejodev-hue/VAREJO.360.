-- Planejamento semanal e mensal do gerente.
-- Inspirado no modelo FCA: Fato, Causa e Plano de Acao.

create table if not exists public.operacao_planejamentos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  tipo text not null default 'semanal' check (tipo in ('semanal', 'mensal')),
  titulo text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'planejado' check (status in ('planejado', 'em_execucao', 'concluido', 'cancelado')),
  responsavel_user_id uuid,
  recado text,
  objetivo text,
  fato text,
  causa text,
  plano_acao text,
  indicadores jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operacao_planejamentos enable row level security;

create policy operacao_planejamentos_auth_read on public.operacao_planejamentos
  for select to authenticated using (true);

create policy operacao_planejamentos_auth_write on public.operacao_planejamentos
  for all to authenticated using (true) with check (true);

create index if not exists idx_operacao_planejamentos_loja_periodo
  on public.operacao_planejamentos (loja_id, tipo, periodo_inicio, periodo_fim);

create index if not exists idx_operacao_planejamentos_status
  on public.operacao_planejamentos (status, periodo_fim);
