import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";
import { TurnoverFiltersProvider } from "@/lib/turnover-filters";

export const Route = createFileRoute("/_authenticated/turnover")({
  component: Layout,
});

function Layout() {
  return (
    <TurnoverFiltersProvider>
      <ModuleTabs moduleKey="turnover"
        title="Turnover × Carteira"
        description="Impacto da saída/afastamento de vendedores na carteira de especificadores"
        tabs={[
          { to: "/turnover/visao-geral", label: "Visão geral" },
          { to: "/turnover/vendedores", label: "Vendedores" },
          { to: "/turnover/especificadores", label: "Especificadores" },
          { to: "/turnover/alertas", label: "Alertas" },
          { to: "/turnover/parametros", label: "Parâmetros" },
        ]}
      />
      <Outlet />
    </TurnoverFiltersProvider>
  );
}
