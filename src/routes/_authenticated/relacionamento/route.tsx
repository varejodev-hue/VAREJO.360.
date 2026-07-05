import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/relacionamento")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs moduleKey="relacionamento"
        title="Relacionamento"
        description="Interações, agenda e ROI de eventos"
        tabs={[
          { to: "/relacionamento/interacoes", label: "Interações" },
          { to: "/relacionamento/agenda", label: "Agenda Comercial" },
          { to: "/relacionamento/eventos", label: "Eventos" },
          { to: "/relacionamento/roi", label: "ROI" },
        ]}
      />
      <Outlet />
    </>
  );
}
