import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaLayout,
});

const TABS = [
  { to: "/ajuda", label: "Guia" },
  { to: "/ajuda/indicadores", label: "Indicadores" },
  { to: "/ajuda/regras", label: "Regras" },
  { to: "/ajuda/faq", label: "Dúvidas Frequentes" },
  { to: "/ajuda/novidades", label: "Novidades" },
  { to: "/ajuda/historico", label: "Histórico" },
];

function AjudaLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <PageHeader title="Central de Ajuda" description="Guia do sistema, indicadores, regras, FAQ e novidades." />
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const active = t.to === "/ajuda" ? path === "/ajuda" : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
