export type SgpRole =
  | "admin"
  | "head_nacional_loja_propria"
  | "head_nacional_franquia"
  | "gerente_regional_franquia"
  | "gerente_performance"
  | "analista_performance"
  | "gerente_loja"
  | "assistente_venda"
  | "vendedor"
  | "projetista";
export type SgpModulo =
  | "dashboard"
  | "atendimento"
  | "rotina"
  | "amostras"
  | "materiais_compras"
  | "manutencao"
  | "relatorios"
  | "configuracoes";

export type SgpPermission = {
  role: SgpRole;
  perfil: string;
  nivel: number;
  modulo: SgpModulo;
  podeVer: boolean;
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeAprovar: boolean;
  podeConfigurar: boolean;
  observacao: string;
};

export const SGP_ROLE_LABEL: Record<SgpRole, string> = {
  admin: "Gerente / Admin",
  head_nacional_loja_propria: "Head Nacional Loja Propria",
  head_nacional_franquia: "Head Nacional Franquia",
  gerente_regional_franquia: "Gerente Regional Franquia",
  gerente_performance: "Gerente de Performance",
  analista_performance: "Analista de Performance",
  gerente_loja: "Gerente",
  assistente_venda: "Assistente de Vendas",
  vendedor: "Consultor",
  projetista: "Projetista",
};

export const SGP_MODULE_LABEL: Record<SgpModulo, string> = {
  dashboard: "Dashboards",
  atendimento: "Atendimento da Vez",
  rotina: "Rotina e Responsabilidades",
  amostras: "Amostras e Mostruario",
  materiais_compras: "Materiais e Compras",
  manutencao: "Manutencao",
  relatorios: "Relatorios",
  configuracoes: "Configuracoes",
};

const full = { podeVer: true, podeCriar: true, podeEditar: true, podeExcluir: true, podeAprovar: true, podeConfigurar: true };
const none = { podeVer: false, podeCriar: false, podeEditar: false, podeExcluir: false, podeAprovar: false, podeConfigurar: false };

function p(role: SgpRole, nivel: number, modulo: SgpModulo, flags: Partial<Omit<SgpPermission, "role" | "perfil" | "nivel" | "modulo" | "observacao">>, observacao: string): SgpPermission {
  return {
    role,
    perfil: SGP_ROLE_LABEL[role],
    nivel,
    modulo,
    ...none,
    ...flags,
    observacao,
  };
}

export const SGP_PERMISSIONS: SgpPermission[] = [
  ...(["dashboard", "atendimento", "rotina", "amostras", "materiais_compras", "manutencao", "relatorios", "configuracoes"] as SgpModulo[])
    .map((modulo) => p("admin", 100, modulo, full, "Acesso total.")),

  p("head_nacional_loja_propria", 98, "dashboard", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Visao consolidada de todas as lojas proprias."),
  p("head_nacional_loja_propria", 98, "atendimento", { podeVer: true }, "Acompanha produtividade e distribuicao por filial."),
  p("head_nacional_loja_propria", 98, "rotina", { podeVer: true, podeAprovar: true, podeConfigurar: true }, "Define padroes nacionais sem executar rotina diaria."),
  p("head_nacional_loja_propria", 98, "amostras", { podeVer: true, podeAprovar: true }, "Acompanha indicadores e padronizacao entre lojas."),
  p("head_nacional_loja_propria", 98, "materiais_compras", { podeVer: true, podeAprovar: true, podeConfigurar: true }, "Acompanha custos, fornecedores e politica de compras."),
  p("head_nacional_loja_propria", 98, "manutencao", { podeVer: true, podeAprovar: true, podeConfigurar: true }, "Acompanha preventivas criticas e padrao nacional."),
  p("head_nacional_loja_propria", 98, "relatorios", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Relatorios consolidados multi-loja."),
  p("head_nacional_loja_propria", 98, "configuracoes", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Parametrizacao nacional das lojas proprias."),

  p("head_nacional_franquia", 96, "dashboard", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Visao consolidada da rede de franquias."),
  p("head_nacional_franquia", 96, "atendimento", { podeVer: true }, "Acompanha indicadores de atendimento por franquia."),
  p("head_nacional_franquia", 96, "rotina", { podeVer: true, podeAprovar: true, podeConfigurar: true }, "Define padroes recomendados para a rede."),
  p("head_nacional_franquia", 96, "amostras", { podeVer: true, podeAprovar: true }, "Acompanha mostruario e amostras por franquia."),
  p("head_nacional_franquia", 96, "materiais_compras", { podeVer: true, podeAprovar: true }, "Acompanha consumo e fornecedores em nivel nacional."),
  p("head_nacional_franquia", 96, "manutencao", { podeVer: true, podeAprovar: true }, "Acompanha preventivas e riscos operacionais da rede."),
  p("head_nacional_franquia", 96, "relatorios", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Relatorios consolidados da rede."),
  p("head_nacional_franquia", 96, "configuracoes", { podeVer: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Parametrizacao nacional da franquia."),

  p("gerente_regional_franquia", 85, "dashboard", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true }, "Visao consolidada das lojas da regiao."),
  p("gerente_regional_franquia", 85, "atendimento", { podeVer: true }, "Acompanha fila e produtividade regional."),
  p("gerente_regional_franquia", 85, "rotina", { podeVer: true, podeAprovar: true }, "Acompanha aderencia da rotina nas lojas."),
  p("gerente_regional_franquia", 85, "amostras", { podeVer: true, podeAprovar: true }, "Acompanha indicadores regionais de amostras."),
  p("gerente_regional_franquia", 85, "materiais_compras", { podeVer: true, podeAprovar: true }, "Acompanha compras e pendencias regionais."),
  p("gerente_regional_franquia", 85, "manutencao", { podeVer: true, podeAprovar: true }, "Acompanha preventivas e riscos regionais."),
  p("gerente_regional_franquia", 85, "relatorios", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true }, "Relatorios regionais."),
  p("gerente_regional_franquia", 85, "configuracoes", { podeVer: true }, "Consulta parametros, sem administrar usuarios da filial."),

  p("gerente_performance", 88, "dashboard", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Governanca de indicadores e performance."),
  p("gerente_performance", 88, "atendimento", { podeVer: true }, "Analisa produtividade e canais."),
  p("gerente_performance", 88, "rotina", { podeVer: true, podeConfigurar: true }, "Parametriza indicadores e padroes de acompanhamento."),
  p("gerente_performance", 88, "amostras", { podeVer: true }, "Analisa indicadores de devolucao e atraso."),
  p("gerente_performance", 88, "materiais_compras", { podeVer: true }, "Analisa custo, consumo e estoque critico."),
  p("gerente_performance", 88, "manutencao", { podeVer: true }, "Analisa SLA e preventivas."),
  p("gerente_performance", 88, "relatorios", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Cria e padroniza relatorios."),
  p("gerente_performance", 88, "configuracoes", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Owner de parametros, workflows e governanca."),

  p("analista_performance", 65, "dashboard", { podeVer: true, podeCriar: true, podeEditar: true }, "Analise e qualidade dos indicadores."),
  p("analista_performance", 65, "atendimento", { podeVer: true }, "Analisa canal de entrada e produtividade."),
  p("analista_performance", 65, "rotina", { podeVer: true }, "Consulta aderencia da rotina."),
  p("analista_performance", 65, "amostras", { podeVer: true }, "Analisa amostras emprestadas e atrasos."),
  p("analista_performance", 65, "materiais_compras", { podeVer: true }, "Analisa consumo e estoque critico."),
  p("analista_performance", 65, "manutencao", { podeVer: true }, "Analisa SLA e preventivas."),
  p("analista_performance", 65, "relatorios", { podeVer: true, podeCriar: true, podeEditar: true }, "Monta bases e relatorios."),
  p("analista_performance", 65, "configuracoes", { podeVer: true }, "Consulta parametros sem alterar regras."),

  p("gerente_loja", 90, "dashboard", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Visao gerencial da filial."),
  p("gerente_loja", 90, "atendimento", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Acompanha e corrige registros."),
  p("gerente_loja", 90, "rotina", full, "Inclui, modifica e exclui responsabilidades por funcao."),
  p("gerente_loja", 90, "amostras", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true }, "Acompanha indicadores e excecoes."),
  p("gerente_loja", 90, "materiais_compras", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Aprova cotacoes e acompanha pendencias."),
  p("gerente_loja", 90, "manutencao", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Define calendario preventivo."),
  p("gerente_loja", 90, "relatorios", { podeVer: true, podeCriar: true, podeEditar: true, podeAprovar: true, podeConfigurar: true }, "Exporta relatorios da filial."),
  p("gerente_loja", 90, "configuracoes", full, "Gerencia usuarios, perfis e parametros da filial."),

  p("assistente_venda", 70, "dashboard", { podeVer: true }, "Visao operacional."),
  p("assistente_venda", 70, "atendimento", { podeVer: true, podeCriar: true, podeEditar: true }, "Administra fila e corrige registros operacionais."),
  p("assistente_venda", 70, "rotina", { podeVer: true, podeCriar: true, podeEditar: true }, "Executa e acompanha rotina."),
  p("assistente_venda", 70, "amostras", { podeVer: true, podeCriar: true, podeEditar: true }, "Administra emprestimos e devolucoes."),
  p("assistente_venda", 70, "materiais_compras", { podeVer: true, podeCriar: true, podeEditar: true }, "Controla estoque, cotacao e checklist de compra."),
  p("assistente_venda", 70, "manutencao", { podeVer: true, podeCriar: true, podeEditar: true }, "Abre e acompanha manutencoes."),
  p("assistente_venda", 70, "relatorios", { podeVer: true, podeCriar: true }, "Relatorios operacionais."),
  p("assistente_venda", 70, "configuracoes", none, "Sem acesso a configuracoes."),

  p("vendedor", 50, "dashboard", { podeVer: true }, "Visao do proprio desempenho."),
  p("vendedor", 50, "atendimento", { podeVer: true, podeCriar: true, podeEditar: true }, "Registra atendimentos e status de orcamento."),
  p("vendedor", 50, "rotina", { podeVer: true, podeEditar: true }, "Consulta e conclui responsabilidades do perfil."),
  p("vendedor", 50, "amostras", { podeVer: true, podeCriar: true, podeEditar: true }, "Registra emprestimo e devolucao de amostras."),
  p("vendedor", 50, "materiais_compras", none, "Sem rotina de compras."),
  p("vendedor", 50, "manutencao", none, "Sem rotina de manutencao."),
  p("vendedor", 50, "relatorios", { podeVer: true }, "Consulta relatorios do proprio perfil."),
  p("vendedor", 50, "configuracoes", none, "Sem acesso."),

  p("projetista", 55, "dashboard", { podeVer: true }, "Visao operacional do mostruario."),
  p("projetista", 55, "atendimento", { podeVer: true }, "Consulta fila quando necessario."),
  p("projetista", 55, "rotina", { podeVer: true, podeEditar: true }, "Consulta e atualiza responsabilidades do perfil."),
  p("projetista", 55, "amostras", { podeVer: true, podeCriar: true, podeEditar: true }, "Cadastra, edita e inativa amostras."),
  p("projetista", 55, "materiais_compras", none, "Sem rotina de compras."),
  p("projetista", 55, "manutencao", { podeVer: true, podeCriar: true, podeEditar: true }, "Registra demandas ligadas a obra e mostruario."),
  p("projetista", 55, "relatorios", { podeVer: true }, "Consulta mostruario e amostras."),
  p("projetista", 55, "configuracoes", none, "Sem acesso."),
];

export function getSgpPermissions(role: string | null | undefined) {
  return SGP_PERMISSIONS.filter((p) => p.role === role);
}

export function canSgp(role: string | null | undefined, modulo: SgpModulo, action: "ver" | "criar" | "editar" | "excluir" | "aprovar" | "configurar") {
  const perm = SGP_PERMISSIONS.find((p) => p.role === role && p.modulo === modulo);
  if (!perm) return false;
  const field = {
    ver: "podeVer",
    criar: "podeCriar",
    editar: "podeEditar",
    excluir: "podeExcluir",
    aprovar: "podeAprovar",
    configurar: "podeConfigurar",
  }[action] as keyof SgpPermission;
  return Boolean(perm[field]);
}
