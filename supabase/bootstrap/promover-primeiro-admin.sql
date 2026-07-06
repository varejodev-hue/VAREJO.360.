-- Varejo 360 - promover primeiro administrador
--
-- Como usar:
-- 1. Crie o usuario normalmente pela tela de login/autenticacao do Supabase.
-- 2. Troque o e-mail abaixo pelo e-mail desse usuario.
-- 3. Rode este SQL no Supabase SQL Editor.
-- 4. Depois acesse /admin/usuarios no sistema.

begin;

with alvo as (
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)) as nome
  from auth.users u
  where lower(u.email) = lower('varejo.dev@gmail.com')
  limit 1
),
perfil as (
  insert into public.profiles (id, email, nome, ativo)
  select id, email, nome, true
  from alvo
  on conflict (id) do update
    set email = excluded.email,
        nome = coalesce(public.profiles.nome, excluded.nome),
        ativo = true
  returning id
)
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from alvo
on conflict (user_id, role) do nothing;

commit;

-- Conferencia:
-- select p.email, p.nome, ur.role
-- from public.user_roles ur
-- join public.profiles p on p.id = ur.user_id
-- where ur.role = 'admin';
