# SGP Integrado - Lovable + Operacao da Loja

Esta copia une a base tecnica do Lovable/Varejo 360 com os modulos operacionais definidos para o SGP da filial.

## Base mantida do Lovable

- React + TanStack Start + Vite.
- Supabase com autenticacao, RLS, usuarios e perfis.
- Multi-loja por tabela `lojas` e filtros globais.
- Dashboard executivo.
- Importacao de orcamentos e vendas.
- Carteira, performance, especificadores, campanhas e relacionamento.
- Exportacao PDF/Excel via bibliotecas reais.

## Modulos operacionais adicionados

- Operacao da Loja no menu lateral.
- Atendimento da Vez.
- Rotina do Dia e matriz de responsabilidades.
- Controle de amostras.
- Materiais internos e compras com checklist.
- Manutencao preventiva da loja.

## Migration criada

Arquivo:

`supabase/migrations/20260704160000_sgp_operacional_loja.sql`

Tabelas principais:

- `operacao_fila_dias`
- `operacao_fila_consultores`
- `operacao_atendimento_lancamentos`
- `operacao_atendimento_historico`
- `operacao_rotinas`
- `operacao_responsabilidades`
- `operacao_amostras`
- `operacao_amostra_movimentacoes`
- `operacao_materiais`
- `operacao_compras`
- `operacao_manutencoes_preventivas`

## Regra oficial do Atendimento da Vez

- Contam para a fila: Novo, WhatsApp e Tel/E-mail.
- Nao contam: Retorno, Retorno dos Outros, Novo dos Outros quando parametrizado como historico, Folga, Fora, Ferias e Almoco.
- A coluna X representa o Total Valido para a Fila.
- A coluna Y representa o Total Geral.
- No fechamento, o sistema salva historico, recalcula a fila, limpa lancamentos, atualiza data e pula domingo.
- Empate: quem estava mais abaixo na fila anterior passa a frente.

## Proximas etapas

1. Rodar as migrations no Supabase.
2. Regenerar `src/integrations/supabase/types.ts`.
3. Rodar o gerador do TanStack Router para atualizar `routeTree.gen.ts`.
4. Criar formularios de cadastro/lancamento para cada modulo operacional.
5. Implementar job automatico de fechamento entre 23h e 0h.
6. Trocar politicas amplas de RLS por regras por perfil/loja antes de producao.
