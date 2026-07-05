-- SGP Produtividade do Vendedor
-- Amarra login -> vendedor, carteira de orcamentos, follow-up e controle de AR.

alter table public.profiles
  add column if not exists vendedor_id uuid references public.vendedores(id) on delete set null;

create index if not exists idx_profiles_vendedor_id on public.profiles(vendedor_id);

alter table public.orcamentos
  add column if not exists previsao_fechamento date,
  add column if not exists proximo_followup date,
  add column if not exists ar_status text not null default 'nao_informado'
    check (ar_status in ('nao_informado', 'pendente', 'parcial', 'pago', 'divergente')),
  add column if not exists ar_pago_em date,
  add column if not exists ar_valor_pago numeric(14,2) not null default 0,
  add column if not exists ar_observacao text;

create index if not exists idx_orcamentos_previsao_fechamento on public.orcamentos(previsao_fechamento);
create index if not exists idx_orcamentos_ar_status on public.orcamentos(ar_status);

create table if not exists public.orcamentos_ar_pagamentos (
  id uuid primary key default gen_random_uuid(),
  numero text,
  numero_pedido text,
  loja_id uuid references public.lojas(id) on delete set null,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  cliente text,
  valor_pago numeric(14,2) not null default 0,
  data_pagamento date,
  status text not null default 'pago' check (status in ('pendente', 'parcial', 'pago', 'divergente')),
  arquivo text,
  import_log_id uuid references public.import_logs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.orcamentos_ar_pagamentos enable row level security;

drop policy if exists orcamentos_ar_pagamentos_auth_read on public.orcamentos_ar_pagamentos;
drop policy if exists orcamentos_ar_pagamentos_auth_write on public.orcamentos_ar_pagamentos;

create policy orcamentos_ar_pagamentos_auth_read
  on public.orcamentos_ar_pagamentos for select to authenticated using (true);

create policy orcamentos_ar_pagamentos_auth_write
  on public.orcamentos_ar_pagamentos for all to authenticated using (true) with check (true);

create index if not exists idx_ar_pagamentos_numero on public.orcamentos_ar_pagamentos(numero);
create index if not exists idx_ar_pagamentos_pedido on public.orcamentos_ar_pagamentos(numero_pedido);
create index if not exists idx_ar_pagamentos_vendedor_data on public.orcamentos_ar_pagamentos(vendedor_id, data_pagamento);

create or replace function public.gerar_followups_orcamentos_sgp()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_total integer := 0;
begin
  with base as (
    select
      o.id,
      o.numero,
      o.data_orcamento,
      o.previsao_fechamento,
      o.vendedor_id,
      o.especificador_id,
      o.cliente_id,
      o.loja_id
    from public.orcamentos o
    where o.status in ('orcado', 'parcial')
  ),
  agenda as (
    select b.*, (b.data_orcamento + offs.dias)::date as follow_date, 'D+' || offs.dias::text as marco
    from base b
    cross join (values (1), (3), (7), (15)) as offs(dias)
    where (b.data_orcamento + offs.dias)::date >= current_date
    union all
    select b.*, greatest(current_date, b.previsao_fechamento - 1)::date as follow_date, 'Previsao de fechamento' as marco
    from base b
    where b.previsao_fechamento is not null
      and b.previsao_fechamento >= current_date
  )
  insert into public.tasks (
    titulo, tipo, due_at, status, orcamento_id, vendedor_id, especificador_id, cliente_id, loja_id, descricao
  )
  select
    'Follow-up ' || a.marco || ' - Orcamento ' || a.numero,
    'followup'::task_tipo,
    (a.follow_date + time '09:00')::timestamptz,
    'pendente'::task_status,
    a.id,
    a.vendedor_id,
    a.especificador_id,
    a.cliente_id,
    a.loja_id,
    case
      when a.marco = 'Previsao de fechamento' then 'Contato antes da previsao de fechamento para nao perder a oportunidade.'
      else 'Rotina automatica de acompanhamento da carteira do vendedor.'
    end
  from agenda a
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  update public.orcamentos o
  set proximo_followup = nxt.follow_date
  from (
    select orcamento_id, min((due_at at time zone 'UTC')::date) as follow_date
    from public.tasks
    where tipo = 'followup'
      and status = 'pendente'
      and (due_at at time zone 'UTC')::date >= current_date
      and orcamento_id is not null
    group by orcamento_id
  ) nxt
  where o.id = nxt.orcamento_id;

  return v_total;
end;
$$;

revoke all on function public.gerar_followups_orcamentos_sgp() from public;
grant execute on function public.gerar_followups_orcamentos_sgp() to authenticated, service_role;
