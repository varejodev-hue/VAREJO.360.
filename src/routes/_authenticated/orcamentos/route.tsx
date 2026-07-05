import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs
        moduleKey="orcamentos"
        title="Orcamentos"
        description="Gestao completa do funil comercial, carteira, follow-up, conversao e perdas."
        tabs={[
          { to: "/orcamentos/controle", label: "Controle do Vendedor", help: "Tela de produtividade do vendedor: carteira aberta, follow-ups, previsao de fechamento, AR e proxima acao." },
          { to: "/orcamentos/carteira", label: "Carteira", help: "Lista e consulta dos orcamentos por vendedor, loja, cliente, especificador e status." },
          { to: "/orcamentos/follow-up", label: "Follow-up", help: "Acompanha contatos pendentes, vencidos e proximas acoes para nao perder oportunidades." },
          { to: "/orcamentos/conversao", label: "Conversao", help: "Mede quantos orcamentos viram venda e ajuda a entender gargalos do funil." },
          { to: "/orcamentos/perdidos", label: "Perdidos", help: "Analisa orcamentos perdidos, motivos e oportunidades de melhoria." },
        ]}
      />
      <Outlet />
    </>
  );
}
