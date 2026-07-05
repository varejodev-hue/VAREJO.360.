-- SGP Inteligencia da Carteira Comercial
-- Campos leves para orientar a rotina do vendedor e a visao gerencial.

alter table public.orcamentos
  add column if not exists temperatura text not null default 'auto'
    check (temperatura in ('auto', 'quente', 'atencao', 'parado', 'risco_perda', 'fechamento_proximo')),
  add column if not exists motivo_atual text not null default 'nao_informado'
    check (motivo_atual in (
      'nao_informado',
      'aguardando_cliente',
      'aguardando_arquiteto',
      'preco',
      'prazo',
      'concorrencia',
      'falta_produto',
      'aguardando_pagamento',
      'negociacao',
      'sem_retorno'
    )),
  add column if not exists proxima_acao text not null default 'auto'
    check (proxima_acao in (
      'auto',
      'ligar_hoje',
      'enviar_whatsapp',
      'confirmar_decisao',
      'cobrar_especificador',
      'validar_ar',
      'revisar_condicao',
      'agendar_visita',
      'sem_acao'
    )),
  add column if not exists ultima_interacao_tipo text
    check (ultima_interacao_tipo is null or ultima_interacao_tipo in ('whatsapp', 'ligacao', 'email', 'visita', 'loja')),
  add column if not exists ultima_interacao_em timestamptz;

create index if not exists idx_orcamentos_temperatura on public.orcamentos(temperatura);
create index if not exists idx_orcamentos_motivo_atual on public.orcamentos(motivo_atual);
create index if not exists idx_orcamentos_proxima_acao on public.orcamentos(proxima_acao);

create or replace function public.sgp_sugerir_temperatura_orcamento(
  p_data_orcamento date,
  p_previsao_fechamento date,
  p_ar_status text
)
returns text
language sql
stable
as $$
  select case
    when p_ar_status in ('pendente', 'divergente') then 'atencao'
    when p_previsao_fechamento is not null
      and p_previsao_fechamento between current_date and current_date + 3 then 'fechamento_proximo'
    when p_data_orcamento <= current_date - 90 then 'risco_perda'
    when p_data_orcamento <= current_date - 45 then 'parado'
    when p_previsao_fechamento is null and p_data_orcamento <= current_date - 7 then 'atencao'
    else 'quente'
  end;
$$;

create or replace function public.sgp_sugerir_proxima_acao_orcamento(
  p_data_orcamento date,
  p_previsao_fechamento date,
  p_ar_status text,
  p_motivo_atual text
)
returns text
language sql
stable
as $$
  select case
    when p_ar_status in ('pendente', 'divergente') then 'validar_ar'
    when p_motivo_atual = 'aguardando_arquiteto' then 'cobrar_especificador'
    when p_motivo_atual in ('preco', 'concorrencia') then 'revisar_condicao'
    when p_previsao_fechamento is not null
      and p_previsao_fechamento between current_date and current_date + 3 then 'confirmar_decisao'
    when p_data_orcamento <= current_date - 45 then 'ligar_hoje'
    else 'enviar_whatsapp'
  end;
$$;

create or replace view public.orcamentos_carteira_inteligente as
select
  o.*,
  case
    when o.temperatura = 'auto' then public.sgp_sugerir_temperatura_orcamento(o.data_orcamento, o.previsao_fechamento, o.ar_status)
    else o.temperatura
  end as temperatura_calculada,
  case
    when o.proxima_acao = 'auto' then public.sgp_sugerir_proxima_acao_orcamento(o.data_orcamento, o.previsao_fechamento, o.ar_status, o.motivo_atual)
    else o.proxima_acao
  end as proxima_acao_calculada
from public.orcamentos o;

grant select on public.orcamentos_carteira_inteligente to authenticated;
