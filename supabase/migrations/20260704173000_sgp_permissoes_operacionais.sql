-- SGP - Perfis, hierarquia e permissoes operacionais.
-- Mantem compatibilidade com os papeis comerciais existentes e adiciona Projetista.

alter type public.app_role add value if not exists 'projetista';

create table if not exists public.operacao_permissoes_perfil (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  perfil_sgp text not null,
  nivel integer not null,
  modulo text not null,
  pode_ver boolean not null default true,
  pode_criar boolean not null default false,
  pode_editar boolean not null default false,
  pode_excluir boolean not null default false,
  pode_aprovar boolean not null default false,
  pode_configurar boolean not null default false,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, modulo)
);

alter table public.operacao_permissoes_perfil enable row level security;

create policy operacao_permissoes_read on public.operacao_permissoes_perfil
for select to authenticated using (true);

create policy operacao_permissoes_admin_write on public.operacao_permissoes_perfil
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'gerente_loja')
  or public.has_role(auth.uid(), 'head_nacional_loja_propria')
  or public.has_role(auth.uid(), 'head_nacional_franquia')
  or public.has_role(auth.uid(), 'gerente_performance')
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'gerente_loja')
  or public.has_role(auth.uid(), 'head_nacional_loja_propria')
  or public.has_role(auth.uid(), 'head_nacional_franquia')
  or public.has_role(auth.uid(), 'gerente_performance')
);

create index if not exists idx_operacao_permissoes_role on public.operacao_permissoes_perfil (role, modulo);

insert into public.operacao_permissoes_perfil
  (role, perfil_sgp, nivel, modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_aprovar, pode_configurar, observacao)
values
  ('admin', 'Gerente', 100, 'dashboard', true, true, true, true, true, true, 'Acesso total ao sistema.'),
  ('admin', 'Gerente', 100, 'atendimento', true, true, true, true, true, true, 'Pode corrigir fila, registros e historico.'),
  ('admin', 'Gerente', 100, 'rotina', true, true, true, true, true, true, 'Pode parametrizar responsabilidades por funcao.'),
  ('admin', 'Gerente', 100, 'amostras', true, true, true, true, true, true, 'Controle completo.'),
  ('admin', 'Gerente', 100, 'materiais_compras', true, true, true, true, true, true, 'Compra, aprovacao e parametros.'),
  ('admin', 'Gerente', 100, 'manutencao', true, true, true, true, true, true, 'Calendario preventivo e chamados.'),
  ('admin', 'Gerente', 100, 'relatorios', true, true, true, true, true, true, 'Relatorios gerenciais.'),
  ('admin', 'Gerente', 100, 'configuracoes', true, true, true, true, true, true, 'Usuarios, perfis, parametros e auditoria.'),

  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'dashboard', true, true, true, false, true, true, 'Visao consolidada de todas as lojas proprias.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'atendimento', true, false, false, false, false, false, 'Acompanha produtividade e distribuicao por filial.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'rotina', true, false, false, false, true, true, 'Define padroes nacionais sem executar rotina diaria.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'amostras', true, false, false, false, true, false, 'Acompanha indicadores e padronizacao entre lojas.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'materiais_compras', true, false, false, false, true, true, 'Acompanha custos, fornecedores e politica de compras.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'manutencao', true, false, false, false, true, true, 'Acompanha preventivas criticas e padrao nacional.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'relatorios', true, true, true, false, true, true, 'Relatorios consolidados multi-loja.'),
  ('head_nacional_loja_propria', 'Head Nacional Loja Propria', 98, 'configuracoes', true, true, true, false, true, true, 'Parametrizacao nacional das lojas proprias.'),

  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'dashboard', true, true, true, false, true, true, 'Visao consolidada da rede de franquias.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'atendimento', true, false, false, false, false, false, 'Acompanha indicadores de atendimento por franquia.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'rotina', true, false, false, false, true, true, 'Define padroes recomendados para a rede.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'amostras', true, false, false, false, true, false, 'Acompanha mostruario e amostras por franquia.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'materiais_compras', true, false, false, false, true, false, 'Acompanha consumo e fornecedores em nivel nacional.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'manutencao', true, false, false, false, true, false, 'Acompanha preventivas e riscos operacionais da rede.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'relatorios', true, true, true, false, true, true, 'Relatorios consolidados da rede.'),
  ('head_nacional_franquia', 'Head Nacional Franquia', 96, 'configuracoes', true, false, true, false, true, true, 'Parametrizacao nacional da franquia.'),

  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'dashboard', true, true, true, false, true, false, 'Visao consolidada das lojas da regiao.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'atendimento', true, false, false, false, false, false, 'Acompanha fila e produtividade regional.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'rotina', true, false, false, false, true, false, 'Acompanha aderencia da rotina nas lojas.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'amostras', true, false, false, false, true, false, 'Acompanha indicadores regionais de amostras.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'materiais_compras', true, false, false, false, true, false, 'Acompanha compras e pendencias regionais.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'manutencao', true, false, false, false, true, false, 'Acompanha preventivas e riscos regionais.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'relatorios', true, true, true, false, true, false, 'Relatorios regionais.'),
  ('gerente_regional_franquia', 'Gerente Regional Franquia', 85, 'configuracoes', true, false, false, false, false, false, 'Consulta parametros, sem administrar usuarios da filial.'),

  ('gerente_performance', 'Gerente de Performance', 88, 'dashboard', true, true, true, false, true, true, 'Governanca de indicadores e performance.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'atendimento', true, false, false, false, false, false, 'Analisa produtividade e canais.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'rotina', true, false, false, false, false, true, 'Parametriza indicadores e padroes de acompanhamento.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'amostras', true, false, false, false, false, false, 'Analisa indicadores de devolucao e atraso.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'materiais_compras', true, false, false, false, false, false, 'Analisa custo, consumo e estoque critico.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'manutencao', true, false, false, false, false, false, 'Analisa SLA e preventivas.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'relatorios', true, true, true, false, true, true, 'Cria e padroniza relatorios.'),
  ('gerente_performance', 'Gerente de Performance', 88, 'configuracoes', true, true, true, false, true, true, 'Owner de parametros, workflows e governanca.'),

  ('analista_performance', 'Analista de Performance', 65, 'dashboard', true, true, true, false, false, false, 'Analise e qualidade dos indicadores.'),
  ('analista_performance', 'Analista de Performance', 65, 'atendimento', true, false, false, false, false, false, 'Analisa canal de entrada e produtividade.'),
  ('analista_performance', 'Analista de Performance', 65, 'rotina', true, false, false, false, false, false, 'Consulta aderencia da rotina.'),
  ('analista_performance', 'Analista de Performance', 65, 'amostras', true, false, false, false, false, false, 'Analisa amostras emprestadas e atrasos.'),
  ('analista_performance', 'Analista de Performance', 65, 'materiais_compras', true, false, false, false, false, false, 'Analisa consumo e estoque critico.'),
  ('analista_performance', 'Analista de Performance', 65, 'manutencao', true, false, false, false, false, false, 'Analisa SLA e preventivas.'),
  ('analista_performance', 'Analista de Performance', 65, 'relatorios', true, true, true, false, false, false, 'Monta bases e relatorios.'),
  ('analista_performance', 'Analista de Performance', 65, 'configuracoes', true, false, false, false, false, false, 'Consulta parametros sem alterar regras.'),

  ('gerente_loja', 'Gerente', 90, 'dashboard', true, true, true, false, true, true, 'Visao gerencial da filial.'),
  ('gerente_loja', 'Gerente', 90, 'atendimento', true, true, true, false, true, true, 'Pode acompanhar e corrigir registros.'),
  ('gerente_loja', 'Gerente', 90, 'rotina', true, true, true, true, true, true, 'Pode incluir, modificar e excluir responsabilidades.'),
  ('gerente_loja', 'Gerente', 90, 'amostras', true, true, true, false, true, false, 'Acompanha indicadores e excecoes.'),
  ('gerente_loja', 'Gerente', 90, 'materiais_compras', true, true, true, false, true, true, 'Aprova cotacoes e acompanha pendencias.'),
  ('gerente_loja', 'Gerente', 90, 'manutencao', true, true, true, false, true, true, 'Define rotina preventiva.'),
  ('gerente_loja', 'Gerente', 90, 'relatorios', true, true, true, false, true, true, 'Exporta relatorios da filial.'),
  ('gerente_loja', 'Gerente', 90, 'configuracoes', true, true, true, true, true, true, 'Gerencia usuarios da filial.'),

  ('assistente_venda', 'Assistente de Vendas', 70, 'dashboard', true, false, false, false, false, false, 'Visao operacional.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'atendimento', true, true, true, false, false, false, 'Administra fila e corrige registros operacionais.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'rotina', true, true, true, false, false, false, 'Executa e acompanha rotina.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'amostras', true, true, true, false, false, false, 'Administra emprestimos e devolucoes.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'materiais_compras', true, true, true, false, false, false, 'Controla estoque, cotacao e checklist de compra.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'manutencao', true, true, true, false, false, false, 'Abre e acompanha manutencoes.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'relatorios', true, true, false, false, false, false, 'Relatorios operacionais.'),
  ('assistente_venda', 'Assistente de Vendas', 70, 'configuracoes', false, false, false, false, false, false, 'Sem acesso a configuracoes.'),

  ('vendedor', 'Consultor', 50, 'dashboard', true, false, false, false, false, false, 'Visao do proprio desempenho.'),
  ('vendedor', 'Consultor', 50, 'atendimento', true, true, true, false, false, false, 'Registra atendimentos e status de orcamento.'),
  ('vendedor', 'Consultor', 50, 'rotina', true, false, true, false, false, false, 'Consulta e conclui responsabilidades do perfil.'),
  ('vendedor', 'Consultor', 50, 'amostras', true, true, true, false, false, false, 'Registra emprestimo e devolucao de amostras.'),
  ('vendedor', 'Consultor', 50, 'materiais_compras', false, false, false, false, false, false, 'Sem rotina de compras.'),
  ('vendedor', 'Consultor', 50, 'manutencao', false, false, false, false, false, false, 'Sem rotina de manutencao.'),
  ('vendedor', 'Consultor', 50, 'relatorios', true, false, false, false, false, false, 'Consulta relatorios do proprio perfil.'),
  ('vendedor', 'Consultor', 50, 'configuracoes', false, false, false, false, false, false, 'Sem acesso.'),

  ('projetista', 'Projetista', 55, 'dashboard', true, false, false, false, false, false, 'Visao operacional do mostruario.'),
  ('projetista', 'Projetista', 55, 'atendimento', true, false, false, false, false, false, 'Consulta fila quando necessario.'),
  ('projetista', 'Projetista', 55, 'rotina', true, false, true, false, false, false, 'Consulta e atualiza responsabilidades do perfil.'),
  ('projetista', 'Projetista', 55, 'amostras', true, true, true, false, false, false, 'Cadastra, edita e inativa amostras.'),
  ('projetista', 'Projetista', 55, 'materiais_compras', false, false, false, false, false, false, 'Sem rotina de compras.'),
  ('projetista', 'Projetista', 55, 'manutencao', true, true, true, false, false, false, 'Registra demandas ligadas a obra/mostruario.'),
  ('projetista', 'Projetista', 55, 'relatorios', true, false, false, false, false, false, 'Consulta mostruario e amostras.'),
  ('projetista', 'Projetista', 55, 'configuracoes', false, false, false, false, false, false, 'Sem acesso.')
on conflict (role, modulo) do update set
  perfil_sgp = excluded.perfil_sgp,
  nivel = excluded.nivel,
  pode_ver = excluded.pode_ver,
  pode_criar = excluded.pode_criar,
  pode_editar = excluded.pode_editar,
  pode_excluir = excluded.pode_excluir,
  pode_aprovar = excluded.pode_aprovar,
  pode_configurar = excluded.pode_configurar,
  observacao = excluded.observacao,
  updated_at = now();
