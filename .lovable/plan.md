# Módulo — Carteira de Especificadores

Central de gestão da carteira por loja/vendedor, com distribuição, status operacional, auditoria e alertas. Integra-se ao restante do app respeitando RLS por loja (`user_can_see_loja`) e segue o padrão visual SaaS já usado em Turnover/Especificadores.

## 1. Banco de dados (1 migração)

**Novas colunas em `especificadores`:**
- `vendedor_responsavel_id uuid` (FK `vendedores`) — responsável atual
- `loja_responsavel_id uuid` (FK `lojas`) — loja dona da carteira
- `status_carteira` (enum: `ativo`, `acompanhamento`, `em_risco`, `inativo`, `sem_responsavel`, `compartilhado`) default `sem_responsavel`
- `data_status_alterado timestamptz`, `motivo_status text`

**Nova tabela `carteira_movimentacoes`** (auditoria de distribuição/status):
- especificador_id, loja_id
- tipo (`distribuicao` | `status` | `inativacao` | `reativacao`)
- vendedor_anterior_id, vendedor_novo_id
- status_anterior, status_novo
- motivo, observacao
- alterado_por (uuid → auth.users), created_at

GRANTs + RLS: `authenticated` lê/insere se `user_can_see_loja(auth.uid(), loja_id)`; `service_role` ALL.

**Funções RPC (SECURITY DEFINER):**
- `carteira_kpis(p_loja uuid, p_vendedor uuid, p_inicio date, p_fim date)` → totais por status, valor orçado/vendido, conversão, ticket
- `carteira_especificadores(filtros…)` → lista com último orçamento, última venda, dias_sem_contato, valor potencial, vendedor e loja
- `carteira_sem_responsavel(p_loja uuid)` → lista priorizada
- `carteira_por_vendedor(p_loja uuid)` → agregado por vendedor (qtd, ativos, em_risco, inativos, orçado, vendido, conversão, ticket, último contato, próximo follow-up)
- `carteira_distribuir(p_esp_ids uuid[], p_vendedor_id uuid, p_motivo text)` → atualiza responsável + grava auditoria em lote
- `carteira_alterar_status(p_esp_ids uuid[], p_status, p_motivo text)` → idem para status
- `carteira_alertas(p_loja uuid)` → frases automáticas (sem responsável, sem contato >60d, vendedor sobrecarregado vs média, valor potencial parado)

Trigger: ao mudar `vendedor_responsavel_id` ou `status_carteira` manualmente, gravar em `carteira_movimentacoes`.

## 2. Rotas (TanStack Start, sob `_authenticated/`)

Novo módulo `src/routes/_authenticated/carteira/`:
- `route.tsx` — `ModuleTabs` com abas
- `index.tsx` — redirect para `/carteira/visao-geral`
- `visao-geral.tsx` — cards KPI, alertas, resumo por loja
- `por-vendedor.tsx` — tabela por vendedor + drawer com carteira detalhada
- `sem-responsavel.tsx` — lista + ações em massa (atribuir vendedor)
- `distribuir.tsx` — distribuição em massa (filtros + seleção múltipla + atribuição)
- `historico.tsx` — auditoria (movimentações)

Entrada no menu lateral (`app-shell.tsx`) na seção comercial.

## 3. UI/Componentes

- `src/components/carteira/`:
  - `KpiCards.tsx` — 6 cards (Total, Ativas, Risco, Inativas, Sem Responsável, Compartilhadas) clicáveis para filtrar
  - `CarteiraFilters.tsx` — Loja/Região/Canal/Vendedor/Status/Faixa $/Última mov/Cidade/UF
  - `CarteiraTabela.tsx` — tabela com checkbox multi-seleção, ordenação, exportar CSV/PDF
  - `DistribuirDialog.tsx` — escolhe vendedor + motivo, confirma
  - `StatusDialog.tsx` — altera status com motivo
  - `AlertasInteligentes.tsx` — frases automáticas em cards
  - `VendedorDrawer.tsx` — detalhe do vendedor (KPIs + carteira)

Cores semânticas (mesmo padrão Turnover): verde=ativo/ganho, vermelho suave=risco/perda, âmbar=atenção, azul=informação. Layout largura total, fonte 13px, coluna fixa do especificador.

## 4. Integração

- Reutiliza `useGlobalFilters` (período Início/Fim).
- Notificações no sino para alertas críticos (sem responsável, sem contato >60d) via tabela `notificacoes`.
- Export CSV via `src/lib/csv-export.ts` e PDF via `src/lib/pdf-export.ts`.
- Ações em massa: Atribuir vendedor, Alterar status, Agendar follow-up (cria `tasks`), Exportar.

## 5. Entrega faseada

1. **Fase 1 (DB)**: migração com colunas/tabela/enum/RPCs/trigger + GRANTs/RLS.
2. **Fase 2 (Visão Geral + Sem Responsável)**: rotas base, KPIs, alertas, lista priorizada com atribuir vendedor.
3. **Fase 3 (Por Vendedor + Distribuir)**: agregado por vendedor, drawer detalhe, distribuição em massa com filtros.
4. **Fase 4 (Histórico + Inteligência)**: auditoria, alertas no sino, exportação CSV/PDF, ações em massa (follow-up).

## Observações técnicas

- Todas as RPCs usam `SECURITY DEFINER` + filtro `user_can_see_loja` para escapar do overhead RLS em `orcamentos` (mesmo padrão já adotado no Turnover).
- `statement_timeout = '0'` apenas na RPC de distribuição em massa, caso necessário.
- Sem `child_process`/libs Node-only no servidor; toda lógica via `createServerFn` ou RPC.
- Nenhuma alteração em arquivos auto-gerados (`types.ts`, `routeTree.gen.ts` — regenerados após migração).

Aprove para eu iniciar pela **Fase 1 (migração de banco)**.
