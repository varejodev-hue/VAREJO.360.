import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/especificadores")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs moduleKey="especificadores"
        title="Especificadores"
        description="Ativação, retenção e rastreabilidade"
        tabs={[
          { to: "/especificadores/minha-carteira", label: "Minha Carteira" },
          { to: "/especificadores/ativos", label: "Ativos" },
          { to: "/especificadores/conversao", label: "Conversão 360°" },
          { to: "/especificadores/em-risco", label: "Em Risco" },
          { to: "/especificadores/alertas", label: "Alertas" },
          { to: "/especificadores/rankings", label: "Rankings" },
          { to: "/especificadores/inativos", label: "Inativos" },
          { to: "/especificadores/recuperados", label: "Recuperados" },
          { to: "/especificadores/transferencias", label: "Transferências" },
          { to: "/especificadores/rastreabilidade", label: "Rastreabilidade" },
        ]}
      />
      <Outlet />
    </>
  );
}
