# Varejo 360

Sistema web de gestao operacional, comercial e executiva para lojas, com foco em produtividade diaria, acompanhamento de carteira, atendimento da vez, planejamento, indicadores e rotinas administrativas.

## Principais modulos

- Dashboard operacional e gerencial
- Atendimento da Vez
- Rotina do Dia e matriz de responsabilidades
- Controle de escala, folgas e ferias
- Controle de amostras e emprestimos
- Mostruario
- Materiais internos e fluxo de compras
- Fornecedores
- Manutencao preventiva e corretiva
- Orcamentos, follow-up e carteira do vendedor
- Especificadores e relacionamento
- Metas B2B/B2C
- Ranking por loja e vendedor
- Saude da Loja
- Planejamento semanal, mensal e executivo
- Parametrizacao por filial
- Ajuda, auditoria e permissoes por perfil

## Perfis previstos

- Consultor
- Assistente operacional
- Projetista
- Gerente de loja
- Gerente de performance
- Head nacional de loja propria
- Head nacional de franquia
- Administrador

## Tecnologias

- React
- TanStack Start
- Vite
- Supabase
- Tailwind CSS
- Radix UI
- Recharts
- PDF/Excel export

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha os valores reais.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
LOVABLE_API_KEY=
ALLOW_BOOTSTRAP_ADMIN=false
```

Nunca publique o arquivo `.env` com valores reais.

## Comandos

```bash
pnpm install
pnpm dev
pnpm build
```

## Banco de dados

As migrations ficam em `supabase/migrations`.

## Primeiro administrador

Para criar o primeiro administrador sem Lovable Cloud, use um destes caminhos:

1. Temporariamente configure `ALLOW_BOOTSTRAP_ADMIN=true`, entre no sistema e use a tela `/admin/usuarios`.
2. Ou rode no Supabase SQL Editor o script:

```txt
supabase/bootstrap/00-criar-base-auth-admin.sql
```

Esse script cria a base minima de autenticacao quando o banco ainda nao tem `profiles`, `user_roles` ou `has_role`.

Depois rode:

```txt
supabase/bootstrap/promover-primeiro-admin.sql
```

No script, troque `SEU_EMAIL_AQUI@EXEMPLO.COM` pelo e-mail do usuario que ja existe no Supabase Auth.

Depois que o primeiro admin existir, mantenha:

```env
ALLOW_BOOTSTRAP_ADMIN=false
```

Antes de producao, revisar:

- RLS por perfil e filial
- permissoes administrativas
- variaveis de ambiente do deploy
- job automatico de fechamento diario
- politicas de backup

## Publicacao

O repositorio pode ser publicado sem `node_modules`, `.env`, `.output`, `.wrangler` e arquivos locais de desenvolvimento. Esses itens ja estao cobertos pelo `.gitignore`.
