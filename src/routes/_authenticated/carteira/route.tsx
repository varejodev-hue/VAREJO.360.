import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/carteira")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs moduleKey="carteira"
        title="Carteira de Especificadores"
        description="Distribuição, status e gestão de relacionamento por loja e vendedor"
        tabs={[
          { to: "/carteira/visao-geral", label: "Visão geral" },
          { to: "/carteira/por-loja", label: "Por loja" },
          { to: "/carteira/por-vendedor", label: "Por vendedor" },
          { to: "/carteira/sem-responsavel", label: "Sem responsável" },
          { to: "/carteira/distribuir", label: "Distribuir" },
          { to: "/carteira/historico", label: "Histórico" },
        ]}
      />
      <Outlet />
    </>
  );
}
