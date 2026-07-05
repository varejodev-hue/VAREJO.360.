import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/inteligencia")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs moduleKey="inteligencia"
        title="Inteligência Comercial"
        description="Mix, conversão e oportunidades"
        tabs={[
          { to: "/inteligencia/mix", label: "Mix de produtos" },
        ]}
      />
      <Outlet />
    </>
  );
}
