import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/importacao")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs moduleKey="importacao"
        title="Importação"
        description="Carregue planilhas de orçamentos, vendas e cadastros"
        tabs={[
          { to: "/importacao/orcamentos", label: "Orçamentos" },
          { to: "/importacao/vendas", label: "Vendas" },
          { to: "/importacao/ar", label: "AR Pago" },
          { to: "/importacao/clientes", label: "Clientes" },
          { to: "/importacao/especificadores", label: "Especificadores" },
          { to: "/importacao/historico", label: "Histórico" },
        ]}
      />
      <Outlet />
    </>
  );
}
