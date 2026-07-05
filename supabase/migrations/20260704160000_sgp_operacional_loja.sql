-- SGP Operacional da Loja
-- Une a base comercial do Varejo 360 aos modulos operacionais da filial.

create table if not exists public.operacao_fila_dias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  data_operacao date not null,
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  fechamento_previsto time not null default '23:00',
  fechado_em timestamptz,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loja_id, data_operacao)
);

create table if not exists public.operacao_fila_consultores (
  id uuid primary key default gen_random_uuid(),
  fila_dia_id uuid references public.operacao_fila_dias(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete cascade,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  data_operacao date not null,
  ordem integer not null,
  ordem_anterior integer,
  total_novos integer not null default 0,
  total_whatsapp integer not null default 0,
  total_tel_email integer not null default 0,
  total_retornos integer not null default 0,
  total_retornos_outros integer not null default 0,
  total_novos_outros integer not null default 0,
  total_valido integer generated always as (total_novos + total_whatsapp + total_tel_email) stored,
  total_geral integer generated always as (total_novos + total_whatsapp + total_tel_email + total_retornos + total_retornos_outros + total_novos_outros) stored,
  status text not null default 'disponivel' check (status in ('disponivel', 'folga', 'fora', 'ferias', 'almoco', 'afastamento', 'inativo', 'desligado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loja_id, data_operacao, vendedor_id)
);

create table if not exists public.operacao_atendimento_lancamentos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  data_operacao date not null default current_date,
  tipo text not null check (tipo in ('Novo', 'WhatsApp', 'Tel/E-mail', 'Retorno', 'Retorno dos Outros', 'Novo dos Outros')),
  canal text,
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  gerou_orcamento boolean not null default false,
  valor_orcamento numeric(14,2) not null default 0,
  status_atendimento text not null default 'registrado',
  conta_fila boolean not null default false,
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.operacao_atendimento_lancamentos
  add column if not exists status_atendimento text not null default 'registrado';

create table if not exists public.operacao_atendimento_historico (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  data_operacao date not null,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  ordem_dia integer,
  totais jsonb not null default '{}'::jsonb,
  lancamentos jsonb not null default '[]'::jsonb,
  fechado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.operacao_rotinas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  titulo text not null,
  descricao text,
  responsavel_perfil text,
  responsavel_user_id uuid,
  origem text,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  prazo date,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operacao_responsabilidades (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  perfil text not null,
  ciclo text not null check (ciclo in ('diario', 'semanal', 'mensal', 'eventual')),
  quando text,
  responsabilidade text not null,
  responsavel_principal text,
  substituto text,
  evidencia text,
  indicador text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operacao_amostras (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  codigo text not null,
  produto text not null,
  colecao text,
  tamanho text,
  localizacao text,
  status text not null default 'disponivel' check (status in ('disponivel', 'emprestado', 'atrasado', 'devolvido', 'inativo')),
  responsavel_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loja_id, codigo)
);

create table if not exists public.operacao_amostra_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  amostra_id uuid references public.operacao_amostras(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete cascade,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  tipo text not null check (tipo in ('emprestimo', 'devolucao', 'atraso', 'inativacao', 'reativacao')),
  destino text check (destino in ('Cliente', 'Arquiteto', 'Especificador', 'Loja')),
  responsavel_nome text,
  telefone text,
  email text,
  data_emprestimo date,
  previsao_devolucao date,
  data_devolucao date,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.operacao_materiais (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  produto text not null,
  unidade text,
  conteudo_embalagem text,
  estoque_atual numeric(12,2) not null default 0,
  estoque_minimo numeric(12,2) not null default 0,
  estoque_maximo numeric(12,2) not null default 0,
  fornecedor text,
  faturamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operacao_compras (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  material_id uuid references public.operacao_materiais(id) on delete set null,
  material text not null,
  quantidade numeric(12,2) not null default 1,
  fornecedor text,
  fornecedor_cadastrado boolean not null default false,
  etapa_atual text not null default 'Levantamento de estoque',
  checklist jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'encerrado', 'cancelado')),
  responsavel_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operacao_manutencoes_preventivas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,
  item text not null,
  categoria text,
  periodicidade text not null,
  ultima_execucao date,
  proxima_execucao date,
  fornecedor text,
  telefone text,
  contato text,
  regra text,
  status text not null default 'em_dia' check (status in ('em_dia', 'a_vencer', 'vencida', 'suspensa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operacao_fila_dias enable row level security;
alter table public.operacao_fila_consultores enable row level security;
alter table public.operacao_atendimento_lancamentos enable row level security;
alter table public.operacao_atendimento_historico enable row level security;
alter table public.operacao_rotinas enable row level security;
alter table public.operacao_responsabilidades enable row level security;
alter table public.operacao_amostras enable row level security;
alter table public.operacao_amostra_movimentacoes enable row level security;
alter table public.operacao_materiais enable row level security;
alter table public.operacao_compras enable row level security;
alter table public.operacao_manutencoes_preventivas enable row level security;

create policy operacao_fila_dias_auth_read on public.operacao_fila_dias for select to authenticated using (true);
create policy operacao_fila_dias_auth_write on public.operacao_fila_dias for all to authenticated using (true) with check (true);

create policy operacao_fila_consultores_auth_read on public.operacao_fila_consultores for select to authenticated using (true);
create policy operacao_fila_consultores_auth_write on public.operacao_fila_consultores for all to authenticated using (true) with check (true);

create policy operacao_atendimento_lancamentos_auth_read on public.operacao_atendimento_lancamentos for select to authenticated using (true);
create policy operacao_atendimento_lancamentos_auth_write on public.operacao_atendimento_lancamentos for all to authenticated using (true) with check (true);

create policy operacao_atendimento_historico_auth_read on public.operacao_atendimento_historico for select to authenticated using (true);
create policy operacao_atendimento_historico_auth_write on public.operacao_atendimento_historico for all to authenticated using (true) with check (true);

create policy operacao_rotinas_auth_read on public.operacao_rotinas for select to authenticated using (true);
create policy operacao_rotinas_auth_write on public.operacao_rotinas for all to authenticated using (true) with check (true);

create policy operacao_responsabilidades_auth_read on public.operacao_responsabilidades for select to authenticated using (true);
create policy operacao_responsabilidades_auth_write on public.operacao_responsabilidades for all to authenticated using (true) with check (true);

create policy operacao_amostras_auth_read on public.operacao_amostras for select to authenticated using (true);
create policy operacao_amostras_auth_write on public.operacao_amostras for all to authenticated using (true) with check (true);

create policy operacao_amostra_movimentacoes_auth_read on public.operacao_amostra_movimentacoes for select to authenticated using (true);
create policy operacao_amostra_movimentacoes_auth_write on public.operacao_amostra_movimentacoes for all to authenticated using (true) with check (true);

create policy operacao_materiais_auth_read on public.operacao_materiais for select to authenticated using (true);
create policy operacao_materiais_auth_write on public.operacao_materiais for all to authenticated using (true) with check (true);

create policy operacao_compras_auth_read on public.operacao_compras for select to authenticated using (true);
create policy operacao_compras_auth_write on public.operacao_compras for all to authenticated using (true) with check (true);

create policy operacao_manutencoes_preventivas_auth_read on public.operacao_manutencoes_preventivas for select to authenticated using (true);
create policy operacao_manutencoes_preventivas_auth_write on public.operacao_manutencoes_preventivas for all to authenticated using (true) with check (true);

create index if not exists idx_operacao_atendimento_data_loja on public.operacao_atendimento_lancamentos (data_operacao, loja_id);
create index if not exists idx_operacao_fila_data_loja on public.operacao_fila_consultores (data_operacao, loja_id, ordem);
create index if not exists idx_operacao_amostras_loja_status on public.operacao_amostras (loja_id, status);
create index if not exists idx_operacao_compras_loja_status on public.operacao_compras (loja_id, status);
create index if not exists idx_operacao_preventivas_proxima on public.operacao_manutencoes_preventivas (proxima_execucao);
