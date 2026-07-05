import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/performance")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs
        moduleKey="performance"
        title="Performance"
        description="Indicadores de meta, conversao, gap, saude das lojas e plano de acao."
        tabs={[
          { to: "/performance/lojas", label: "Lojas", help: "Analisa resultado, volume e comportamento comercial por loja." },
          { to: "/performance/saude-lojas", label: "Saude da Loja", help: "Nota executiva de 0 a 100 cruzando comercial, carteira, rotina, compras, manutencao, estoque e planejamento." },
          { to: "/performance/plano-acao", label: "Plano de Acao", help: "Transforma gaps da Saude da Loja em responsavel, prazo, prioridade, status e evidencia." },
          { to: "/performance/gap-lojas", label: "Gap por Loja", help: "Compara meta anual, vendido, atingimento, gap financeiro, crescimento e projecao por loja." },
          { to: "/performance/metas-vendedores", label: "Metas Vendedores", help: "Permite parametrizar e medir metas por vendedor em total, B2B, B2C, mix e conversao." },
          { to: "/performance/planejamento-executivo", label: "Planejamento Executivo", help: "Mostra para o head quais lojas fizeram FCA ou planejamento e quais estao pendentes." },
          { to: "/performance/vendedores", label: "Vendedores", help: "Avalia produtividade, venda, carteira e desempenho individual da equipe." },
          { to: "/performance/ranking", label: "Ranking", help: "Ranking de entrada de orcamento por loja e por vendedor, com comparativo de mes ou ano anterior." },
          { to: "/performance/comparativos", label: "Comparativos", help: "Compara periodos, lojas e indicadores para entender evolucao e desvio." },
          { to: "/performance/perfil-lojas", label: "Perfil de Lojas", help: "Leitura analitica do perfil comercial e operacional de cada loja." },
          { to: "/performance/forecast", label: "Forecast", help: "Projeta vendas futuras usando historico, tendencia e sazonalidade." },
        ]}
      />
      <Outlet />
    </>
  );
}
