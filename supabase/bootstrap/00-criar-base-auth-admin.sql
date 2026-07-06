-- Varejo 360 - bootstrap minimo de autenticacao e admin
--
-- Use este script quando o Supabase ainda nao recebeu as migrations
-- e aparecer erro como:
-- relation "public.user_roles" does not exist
--
-- Depois rode tambem `promover-primeiro-admin.sql`.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum (
      'admin',
      'assistente_venda',
      'vendedor',
      'coordenador_loja',
      'gerente_loja',
      'gerente_regional_franquia',
      'head_nacional_loja_propria',
      'head_nacional_franquia',
      'analista_performance',
      'gerente_performance',
      'projetista'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  ativo boolean not null default true,
  loja_id uuid null,
  regiao_id uuid null,
  vendedor_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.onboarding_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  passo integer not null default 0,
  concluido boolean not null default false,
  dispensado boolean not null default false,
  concluido_em timestamptz null,
  updated_at timestamptz not null default now()
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.onboarding_status enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.onboarding_status to authenticated;
grant all on public.profiles to service_role;
grant all on public.user_roles to service_role;
grant all on public.onboarding_status to service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists user_roles_self_select on public.user_roles;
drop policy if exists user_roles_admin_select on public.user_roles;
drop policy if exists user_roles_admin_all on public.user_roles;
drop policy if exists onboarding_self_select on public.onboarding_status;
drop policy if exists onboarding_self_insert on public.onboarding_status;
drop policy if exists onboarding_self_update on public.onboarding_status;

create policy profiles_self_select
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy profiles_self_update
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy profiles_admin_all
on public.profiles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy user_roles_self_select
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create policy user_roles_admin_select
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy user_roles_admin_all
on public.user_roles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy onboarding_self_select
on public.onboarding_status
for select
to authenticated
using (auth.uid() = user_id);

create policy onboarding_self_insert
on public.onboarding_status
for insert
to authenticated
with check (auth.uid() = user_id);

create policy onboarding_self_update
on public.onboarding_status
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
