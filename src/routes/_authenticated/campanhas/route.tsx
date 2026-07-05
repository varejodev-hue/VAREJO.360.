import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/campanhas")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs moduleKey="campanhas"
        title="Campanhas"
        description="Promoções, motor de oportunidades e reativação de carteira"
        tabs={[
          { to: "/campanhas", label: "Campanhas" },
          { to: "/campanhas/oportunidades", label: "Oportunidades" },
        ]}
      />
      <Outlet />
    </>
  );
}
