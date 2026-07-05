-- Fases de maturidade do SGP: parametros, auditoria e plano de acao.

create table if not exists public.sgp_parametros_filial (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  chave text not null,
  valor jsonb not null default '{}'::jsonb,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loja_id, chave)
);

create table if not exists public.sgp_pesos_saude_loja (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  indicador text not null,
  peso numeric(8,2) not null default 0,
  limite_atencao numeric(12,2),
  limite_critico numeric(12,2),
  ativo boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (loja_id, indicador)
);

create table if not exists public.sgp_planos_acao (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  origem text not null default 'saude_loja',
  origem_ref text,
  titulo text not null,
  descricao text,
  responsavel_perfil text,
  responsavel_user_id uuid,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta', 'critica')),
  prazo date,
  status text not null default 'aberto' check (status in ('aberto', 'em_execucao', 'concluido', 'cancelado')),
  evidencia text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sgp_auditoria (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete set null,
  user_id uuid,
  entidade text not null,
  entidade_id text,
  acao text not null,
  antes jsonb,
  depois jsonb,
  observacao text,
  created_at timestamptz not null default now()
);

alter table public.sgp_parametros_filial enable row level security;
alter table public.sgp_pesos_saude_loja enable row level security;
alter table public.sgp_planos_acao enable row level security;
alter table public.sgp_auditoria enable row level security;

create policy sgp_parametros_filial_auth_read on public.sgp_parametros_filial for select to authenticated using (true);
create policy sgp_parametros_filial_auth_write on public.sgp_parametros_filial for all to authenticated using (true) with check (true);

create policy sgp_pesos_saude_loja_auth_read on public.sgp_pesos_saude_loja for select to authenticated using (true);
create policy sgp_pesos_saude_loja_auth_write on public.sgp_pesos_saude_loja for all to authenticated using (true) with check (true);

create policy sgp_planos_acao_auth_read on public.sgp_planos_acao for select to authenticated using (true);
create policy sgp_planos_acao_auth_write on public.sgp_planos_acao for all to authenticated using (true) with check (true);

create policy sgp_auditoria_auth_read on public.sgp_auditoria for select to authenticated using (true);
create policy sgp_auditoria_auth_write on public.sgp_auditoria for insert to authenticated with check (true);

create index if not exists idx_sgp_planos_acao_loja_status on public.sgp_planos_acao (loja_id, status, prazo);
create index if not exists idx_sgp_auditoria_entidade on public.sgp_auditoria (entidade, entidade_id, created_at desc);

insert into public.sgp_pesos_saude_loja (loja_id, indicador, peso, limite_atencao, limite_critico)
select null, x.indicador, x.peso, x.limite_atencao, x.limite_critico
from (values
  ('sem_entrada_orcamentos', 15, 1, 0),
  ('conversao_baixa', 12, 0.25, 0.15),
  ('followups_vencidos', 15, 3, 8),
  ('carteira_risco', 15, 3, 8),
  ('ar_pendente', 10, 2, 5),
  ('planejamento_pendente', 12, 1, 1),
  ('manutencao_vencida', 10, 1, 3),
  ('estoque_critico', 10, 2, 5),
  ('compra_aberta', 8, 2, 5),
  ('amostra_atrasada', 8, 2, 5),
  ('rotina_atrasada', 8, 2, 5)
) as x(indicador, peso, limite_atencao, limite_critico)
on conflict (loja_id, indicador) do nothing;

insert into public.sgp_parametros_filial (loja_id, chave, valor, descricao)
values
  (null, 'followup', '{"dias_primeiro_contato": 1, "dias_recorrencia": 3, "dias_risco": 30}'::jsonb, 'Regras de follow-up e carteira em risco.'),
  (null, 'atendimento', '{"fechamento_automatico": "23:00", "pular_domingo": true}'::jsonb, 'Regras do atendimento da vez.'),
  (null, 'alertas', '{"dias_manutencao": 15, "dias_compra_aberta": 3, "dias_previsao_fechamento": 0}'::jsonb, 'Prazos para alertas da loja.')
on conflict (loja_id, chave) do nothing;
