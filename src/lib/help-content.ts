// Conteúdo estático de Ajuda: textos curtos por módulo + tour por perfil.

export type AppRole =
  | "admin"
  | "assistente_venda"
  | "vendedor"
  | "coordenador_loja"
  | "gerente_loja"
  | "gerente_regional_franquia"
  | "head_nacional_loja_propria"
  | "head_nacional_franquia"
  | "analista_performance"
  | "gerente_performance"
  | "projetista";

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  assistente_venda: "Assistente de Venda",
  vendedor: "Vendedor",
  coordenador_loja: "Coordenador de Loja",
  gerente_loja: "Gerente de Loja",
  gerente_regional_franquia: "Gerente Regional Franquia",
  head_nacional_loja_propria: "Head Nacional Loja Própria",
  head_nacional_franquia: "Head Nacional Franquia",
  analista_performance: "Analista de Performance",
  gerente_performance: "Gerente de Performance",
  projetista: "Projetista",
};

export type TourStep = { titulo: string; descricao: string; link: string };

const TOUR_VENDEDOR: TourStep[] = [
  { titulo: "Meu Dia", descricao: "Sua tela principal: follow-ups de hoje, vencidos, críticos e aniversariantes.", link: "/meu-dia" },
  { titulo: "Follow-ups de Orçamentos", descricao: "Acompanhe orçamentos abertos. Contato inicial até D+2 aumenta conversão.", link: "/orcamentos/follow-up" },
  { titulo: "Especificadores", descricao: "Gerencie seus especificadores ativos, em risco e inativos.", link: "/especificadores/ativos" },
  { titulo: "Agenda Comercial", descricao: "Visitas, eventos, almoços e treinamentos do seu pipeline.", link: "/relacionamento/agenda" },
  { titulo: "Registro de Interações", descricao: "Toda ligação, WhatsApp ou visita deve ser registrada.", link: "/relacionamento/interacoes" },
];

const TOUR_GERENTE: TourStep[] = [
  { titulo: "Dashboard", descricao: "Visão consolidada da loja: vendas, conversão, ranking.", link: "/dashboard" },
  { titulo: "Orçamentos Críticos", descricao: "Oportunidades em risco que precisam de ação imediata.", link: "/orcamentos/follow-up" },
  { titulo: "Performance dos Vendedores", descricao: "Compare desempenho individual da equipe.", link: "/performance/vendedores" },
  { titulo: "Especificadores em Risco", descricao: "Quem está deixando de produzir e precisa ser reativado.", link: "/especificadores/em-risco" },
  { titulo: "Transferência de Carteira", descricao: "Realoque relacionamentos com avaliação pós-transferência.", link: "/especificadores/transferencias" },
  { titulo: "ROI de Eventos", descricao: "Meça retorno real de cada ação comercial.", link: "/relacionamento/roi" },
];

const TOUR_PERFORMANCE: TourStep[] = [
  { titulo: "Comparativos", descricao: "Cruze períodos, lojas e canais.", link: "/performance/comparativos" },
  { titulo: "Ranking", descricao: "Ranking de lojas e vendedores.", link: "/performance/ranking" },
  { titulo: "Forecast", descricao: "Projeção dos próximos meses com banda de confiança.", link: "/performance/forecast" },
  { titulo: "Workflows", descricao: "Crie automações para alertas e ações repetitivas.", link: "/admin/workflows" },
];

const TOUR_OPERACAO: TourStep[] = [
  { titulo: "Atendimento da Vez", descricao: "Registre atendimentos, canal de entrada, status de orcamento e acompanhe a regra justa da fila.", link: "/operacao/atendimento-da-vez" },
  { titulo: "Rotina da Loja", descricao: "Veja responsabilidades do dia, evidencias esperadas e substituicoes por perfil.", link: "/operacao/rotina" },
  { titulo: "Amostras", descricao: "Controle cadastro, emprestimo, devolucao, atraso e inativacao de amostras.", link: "/operacao/amostras" },
];

export function tourPorPerfil(role?: string | null): TourStep[] {
  switch (role) {
    case "vendedor":
    case "assistente_venda":
      return [...TOUR_OPERACAO, ...TOUR_VENDEDOR.slice(0, 2)];
    case "projetista":
      return [
        { titulo: "Amostras", descricao: "Cadastre novas amostras, edite o mostruario e registre movimentacoes.", link: "/operacao/amostras" },
        { titulo: "Mostruario e Rotina", descricao: "Acompanhe responsabilidades recorrentes e pendencias ligadas ao mostruario.", link: "/operacao/rotina" },
        { titulo: "Manutencao", descricao: "Registre demandas de obra, montagem e manutencoes ligadas a exposicao.", link: "/operacao/manutencao" },
      ];
    case "coordenador_loja":
    case "gerente_loja":
    case "gerente_regional_franquia":
    case "head_nacional_loja_propria":
    case "head_nacional_franquia":
      return TOUR_GERENTE;
    case "analista_performance":
    case "gerente_performance":
    case "admin":
      return TOUR_PERFORMANCE;
    default:
      return TOUR_VENDEDOR;
  }
}

// Responsabilidades por perfil (resumo curto)
export const RESPONSABILIDADES: Record<string, { resumo: string; foco: string[]; indicadores: string[] }> = {
  vendedor: {
    resumo: "Converter orçamentos em vendas e manter relacionamento ativo com especificadores.",
    foco: ["Meu Dia", "Follow-ups", "Especificadores", "Agenda", "Interações"],
    indicadores: ["Taxa de conversão", "Orçamentos sem retorno", "Especificadores em risco", "Tarefas vencidas"],
  },
  assistente_venda: {
    resumo: "Apoiar vendedores no atendimento, cadastro e registro de interações.",
    foco: ["Meu Dia", "Interações", "Cadastros básicos"],
    indicadores: ["Tarefas pendentes", "Qualidade do cadastro"],
  },
  coordenador_loja: {
    resumo: "Garantir disciplina do funil e cobrança de follow-up da equipe.",
    foco: ["Dashboard", "Follow-ups críticos", "Performance da equipe"],
    indicadores: ["Conversão da loja", "Orçamentos críticos", "Especificadores em risco"],
  },
  gerente_loja: {
    resumo: "Resultado da loja, ROI de eventos e desenvolvimento de vendedores.",
    foco: ["Dashboard", "Performance", "ROI Eventos", "Transferências"],
    indicadores: ["Faturamento", "Conversão", "Ticket médio", "Forecast"],
  },
  gerente_regional_franquia: {
    resumo: "Gestão das franquias da região e padronização de processo.",
    foco: ["Comparativos entre lojas", "Ranking", "Forecast"],
    indicadores: ["Variação regional", "Cumprimento de regra", "Forecast vs realizado"],
  },
  head_nacional_loja_propria: {
    resumo: "Direção das lojas próprias em escala nacional.",
    foco: ["Comparativos", "Ranking", "Forecast", "Workflows"],
    indicadores: ["Faturamento nacional", "MAPE Forecast", "Adoção do sistema"],
  },
  head_nacional_franquia: {
    resumo: "Direção da rede de franquias em escala nacional.",
    foco: ["Comparativos", "Ranking", "Forecast", "Workflows"],
    indicadores: ["Faturamento nacional", "Variação entre franqueados"],
  },
  analista_performance: {
    resumo: "Construir análises, importar dados e validar qualidade.",
    foco: ["Importação", "Comparativos", "Forecast"],
    indicadores: ["Qualidade do dado", "Cobertura de importação"],
  },
  gerente_performance: {
    resumo: "Owner do sistema: regras, workflows, parâmetros e governança.",
    foco: ["Workflows", "Parâmetros", "Usuários & Perfis"],
    indicadores: ["Adoção", "Acurácia Forecast", "Workflows ativos"],
  },
  projetista: {
    resumo: "Manter amostras, mostruario e movimentacoes atualizadas, apoiando demandas de exposicao e obra.",
    foco: ["Amostras", "Mostruario", "Rotina", "Manutencao"],
    indicadores: ["Amostras inativas", "Movimentacoes", "Necessidade de troca", "Pendencias de exposicao"],
  },
  admin: {
    resumo: "Administração técnica do sistema.",
    foco: ["Tudo"],
    indicadores: ["Saúde geral"],
  },
};

// Explicação por módulo
export type ModuloDoc = {
  titulo: string;
  paraQueServe: string;
  quemUsa: string;
  porQueImporta: string;
  obrigatorios?: string[];
  regras: string[];
  errosComuns: string[];
  comoLer?: string;
  link: string;
};

export const MODULOS_DOC: ModuloDoc[] = [
  {
    titulo: "Follow-up de Orçamentos",
    paraQueServe: "Evitar que oportunidades fiquem esquecidas na carteira.",
    quemUsa: "Vendedores, Coordenadores e Gerentes.",
    porQueImporta: "Quanto mais rápido o contato, maior a conversão e menor o risco de perda para concorrência.",
    obrigatorios: ["Data do orçamento", "Status do follow-up", "Próxima ação"],
    regras: [
      "Todo orçamento novo deve ter contato inicial em até D+2.",
      "Atualizar status após cada contato com o cliente.",
      "Encerrar como perdido com motivo estruturado.",
    ],
    errosComuns: ["Não atualizar status após contato", "Deixar orçamento sem próxima ação"],
    comoLer: "Verde: dentro do prazo. Amarelo: vencendo. Vermelho: crítico (>15d sem retorno).",
    link: "/orcamentos/follow-up",
  },
  {
    titulo: "Especificadores",
    paraQueServe: "Gerenciar a base de influenciadores de venda como ativo estratégico.",
    quemUsa: "Vendedores e Gerentes.",
    porQueImporta: "Perder relacionamento com especificadores impacta diretamente orçamento, venda e conversão.",
    obrigatorios: ["Tipo de profissional", "Loja vinculada", "Vendedor responsável"],
    regras: [
      "Registrar todos os contatos realizados.",
      "Atualizar status do relacionamento periodicamente.",
      "Acompanhar inatividade — sem contato há >60d gera risco.",
      "Registrar visitas, eventos, almoços e treinamentos.",
      "Medir retorno de cada ação (ROI de eventos).",
    ],
    errosComuns: ["Não registrar interações informais", "Esquecer aniversariantes"],
    link: "/especificadores/ativos",
  },
  {
    titulo: "Transferência de Relacionamento",
    paraQueServe: "Realocar especificadores entre vendedores sem perder o histórico.",
    quemUsa: "Coordenadores e Gerentes.",
    porQueImporta: "Transferência mal feita derruba produção do especificador. Avaliamos 30/60/90/180d depois.",
    regras: ["Registrar motivo da transferência.", "Acompanhar avaliação pós-transferência."],
    errosComuns: ["Transferir sem comunicar o cliente"],
    link: "/especificadores/transferencias",
  },
  {
    titulo: "Forecast de Vendas",
    paraQueServe: "Projetar vendas dos próximos meses com regressão e ajuste sazonal.",
    quemUsa: "Gerentes, Heads, Performance.",
    porQueImporta: "Antecipar meta, planejar estoque e ações comerciais.",
    regras: ["Mínimo 2 meses de histórico.", "Reavaliar mensalmente; MAPE mede a acurácia da rodada anterior."],
    errosComuns: ["Confiar 100% no número sem considerar eventos pontuais"],
    comoLer: "Linha cheia = histórico real. Tracejada = projeção. Faixa = banda otimista/pessimista (±1.5σ).",
    link: "/performance/forecast",
  },
  {
    titulo: "Workflows (Automações)",
    paraQueServe: "Criar regras Quando → Se → Então sem código.",
    quemUsa: "Gerente de Performance e Admin.",
    porQueImporta: "Reduz trabalho manual repetitivo (alertas, tarefas, notificações).",
    regras: ["Iniciar sempre em modo simulação.", "Só ativar após validar execuções simuladas."],
    errosComuns: ["Ativar workflow sem testar — pode gerar dezenas de tarefas falsas"],
    link: "/admin/workflows",
  },
  {
    titulo: "Importação de Dados",
    paraQueServe: "Carregar vendas, orçamentos, especificadores e clientes em lote via Excel/CSV.",
    quemUsa: "Analista de Performance.",
    porQueImporta: "Mantém base atualizada e alimenta indicadores e forecast.",
    regras: ["Validar arquivo antes da importação.", "Acompanhar histórico de erros."],
    errosComuns: ["Importar arquivo com colunas trocadas", "Ignorar registros com erro"],
    link: "/importacao/historico",
  },
];

export const MODULOS_DOC_COMPLETO: ModuloDoc[] = [
  ...MODULOS_DOC,
  {
    titulo: "Atendimento da Vez",
    paraQueServe: "Controlar a fila justa dos consultores e registrar os atendimentos do dia.",
    quemUsa: "Consultores, Assistente de Vendas e Gerente.",
    porQueImporta: "Garante distribuicao equilibrada dos novos atendimentos e alimenta historico gerencial.",
    obrigatorios: ["Consultor", "Tipo de atendimento", "Canal", "Gerou orcamento"],
    regras: ["Contam para prioridade: Novo, WhatsApp e Tel/E-mail.", "Nao contam: Retorno, RO, NO, Folga, Fora e Ferias.", "Empate prioriza quem estava mais abaixo na fila anterior.", "Domingos sao ignorados."],
    errosComuns: ["Registrar retorno como novo", "Nao informar se gerou orcamento", "Esquecer folga ou ferias do vendedor"],
    comoLer: "Menor total valido fica com maior prioridade no proximo dia.",
    link: "/operacao/atendimento-da-vez",
  },
  {
    titulo: "Saude da Loja",
    paraQueServe: "Mostrar uma nota executiva de 0 a 100 por loja.",
    quemUsa: "Gerente, Head Nacional, Performance e Admin.",
    porQueImporta: "Resume se a loja precisa de acao em carteira, rotina, compras, manutencao, estoque ou planejamento.",
    regras: ["A nota combina comercial, carteira, operacao e planejamento.", "Pesos podem ser ajustados em Parametrizacao Filial.", "Abaixo de 60 fica critica; entre 60 e 79 fica em atencao."],
    errosComuns: ["Olhar apenas venda e ignorar pendencias operacionais", "Nao transformar gap em plano de acao"],
    comoLer: "Verde: saudavel. Amarelo: atencao. Vermelho: critica.",
    link: "/performance/saude-lojas",
  },
  {
    titulo: "Plano de Acao",
    paraQueServe: "Transformar gaps da Saude da Loja em acao com responsavel, prazo e evidencia.",
    quemUsa: "Gerente, Assistente, Head e Performance.",
    porQueImporta: "Evita que diagnostico vire apenas relatorio. Cada problema ganha dono e prazo.",
    obrigatorios: ["Titulo", "Responsavel", "Prioridade", "Prazo"],
    regras: ["Toda acao critica precisa de prazo.", "Ao concluir, registrar evidencia.", "Planos cancelados devem ter justificativa."],
    errosComuns: ["Criar plano generico sem responsavel", "Concluir sem evidencia"],
    link: "/performance/plano-acao",
  },
  {
    titulo: "Parametrizacao da Filial",
    paraQueServe: "Permitir que a loja ajuste regras locais sem depender de planilha ou codigo.",
    quemUsa: "Gerente da loja, Head, Performance e Admin.",
    porQueImporta: "Cada filial pode ter rotina, prazos e pesos de saude alinhados com sua operacao.",
    regras: ["Use Padrao global para regra geral.", "Use Filial especifica para excecao local.", "Alteracoes sao registradas na auditoria."],
    errosComuns: ["Alterar peso sem criterio gerencial", "Usar regra local quando deveria ser padrao global"],
    link: "/admin/parametrizacao-filial",
  },
  {
    titulo: "Auditoria",
    paraQueServe: "Registrar alteracoes sensiveis feitas no sistema.",
    quemUsa: "Admin, Head e Gerente de Performance.",
    porQueImporta: "Da rastreabilidade para parametros, planos de acao, metas e regras.",
    regras: ["Alteracoes criticas devem gerar registro.", "Nao excluir historico operacional.", "Usar auditoria para investigar divergencia."],
    errosComuns: ["Alterar parametro sem explicar contexto", "Usar usuario compartilhado"],
    link: "/admin/auditoria",
  },
  {
    titulo: "Materiais e Compras",
    paraQueServe: "Controlar estoque interno e fluxo de compra de materiais da loja.",
    quemUsa: "Assistente de Vendas, Gerente e Administracao.",
    porQueImporta: "Reduz esquecimento de etapas, evita estoque critico e ajuda a nao ficar devendo fornecedor.",
    regras: ["Produto deve ter estoque minimo e maximo.", "Compra segue checklist do fluxo oficial.", "Compra aberta por muitos dias vira alerta."],
    errosComuns: ["Comprar sem fornecedor cadastrado", "Receber material sem abrir chamado da NF", "Nao atualizar estoque ao finalizar"],
    link: "/operacao/materiais",
  },
  {
    titulo: "Manutencao Preventiva",
    paraQueServe: "Controlar manutencoes recorrentes da loja, como ar-condicionado, filtro, extintor, cafe e higienizacao.",
    quemUsa: "Gerente e Assistente de Vendas.",
    porQueImporta: "Evita vencimentos legais, interrupcao da loja e esquecimento de servicos externos.",
    obrigatorios: ["Item", "Periodicidade", "Fornecedor", "Ultima execucao", "Proxima execucao"],
    regras: ["Proxima execucao vencida gera alerta.", "Fornecedor e telefone devem estar preenchidos.", "Periodicidade deve seguir contrato ou legislacao."],
    errosComuns: ["Cadastrar manutencao sem proxima data", "Nao atualizar apos o servico ser feito"],
    link: "/operacao/manutencao",
  },
  {
    titulo: "Metas de Vendedores",
    paraQueServe: "Cadastrar e medir metas por vendedor em valor e percentual.",
    quemUsa: "Gerente e Head.",
    porQueImporta: "Permite acompanhar gap por vendedor, B2B, B2C, mix, conversao e periodo.",
    regras: ["Pode medir mensal, trimestral, semestral e anual.", "B2B considera orcamento com especificador.", "B2C considera orcamento sem especificador."],
    errosComuns: ["Misturar meta B2B e B2C sem separar carteira", "Nao revisar meta por periodo"],
    link: "/performance/metas-vendedores",
  },
  {
    titulo: "Planejamento Executivo",
    paraQueServe: "Mostrar se todas as lojas fizeram FCA ou planejamento no periodo.",
    quemUsa: "Head Nacional, Gerentes e Performance.",
    porQueImporta: "Da visao nacional de disciplina de gestao e mostra qual loja nao entregou.",
    regras: ["Loja propria ativa precisa ter planejamento no periodo filtrado.", "Pode filtrar semanal, mensal ou ambos.", "Exporta PDF, Excel e CSV."],
    errosComuns: ["Criar planejamento fora do periodo", "Nao concluir FCA apos executar plano"],
    link: "/performance/planejamento-executivo",
  },
  {
    titulo: "7 Fases SGP",
    paraQueServe: "Acompanhar a maturidade do ERP em sete frentes.",
    quemUsa: "Admin, Gerente, Head e Performance.",
    porQueImporta: "Ajuda a saber o que ja esta implantado e o que falta para o sistema operar como gestao completa.",
    regras: ["Fase ativa precisa ter uso real.", "Plano de acao fecha o ciclo de melhoria.", "Auditoria protege governanca."],
    errosComuns: ["Criar fase sem usar no dia a dia", "Parametrizar sem revisar indicador"],
    link: "/admin/fases-sgp",
  },
];

// KPIs explicados
export const INDICADORES = [
  { nome: "Taxa de Conversão", formula: "Vendas / Orçamentos do período", boa: "≥ 30%", ruim: "< 15%" },
  { nome: "Ticket Médio", formula: "Faturamento / nº de pedidos", boa: "Acima da média da loja", ruim: "Queda > 10% mês a mês" },
  { nome: "Especificadores Ativos", formula: "Especificadores com ≥1 orçamento nos últimos 90d", boa: "Crescente", ruim: "Queda mês a mês" },
  { nome: "Sem retorno", formula: "Orçamentos sem contato > 7d", boa: "0", ruim: ">10% da carteira" },
  { nome: "MAPE Forecast", formula: "Erro percentual médio absoluto do forecast vs realizado", boa: "< 10%", ruim: "> 25%" },
  { nome: "Índice de Transferência", formula: "% transferências classificadas como Melhorou ou Estável", boa: "> 70%", ruim: "< 50%" },
];

export const REGRAS = [
  "Todo orçamento deve ter contato em até D+2.",
  "Toda interação relevante (ligação, WhatsApp, visita) deve ser registrada.",
  "Especificador sem contato há 60d vira 'Em Risco'; 120d vira 'Inativo'.",
  "Transferência de carteira deve ter motivo registrado.",
  "Status de follow-up deve ser atualizado após cada contato.",
  "Workflows novos começam em simulação — ativar apenas após validação.",
];

export const FAQ = [
  { q: "Como começo o dia?", a: "Abra 'Meu Dia'. Lá aparecem follow-ups de hoje, vencidos, críticos e aniversariantes." },
  { q: "Onde registro uma ligação?", a: "Relacionamento → Interações → Nova interação. Selecione o especificador e o tipo de contato." },
  { q: "Por que um especificador sumiu da minha lista?", a: "Pode ter virado Em Risco ou Inativo, ou ter sido transferido. Verifique em /especificadores/em-risco." },
  { q: "Como medir se um evento valeu a pena?", a: "Agenda → ROI de Eventos. Mostra participantes × orçamentos × vendas geradas em 30/60/90/180d." },
  { q: "Forecast parece errado, e agora?", a: "Veja o MAPE da rodada anterior. Se > 25%, revise base histórica e eventos atípicos." },
  { q: "Como crio uma automação?", a: "Configurações → Workflows → Novo workflow. Inicie em simulação." },
];
