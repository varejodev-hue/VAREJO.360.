import { createFileRoute, redirect } from "@tanstack/react-router";

const MAP: Record<string, string> = {
  parametros: "/admin/parametros",
  workflows: "/admin/workflows",
};

export const Route = createFileRoute("/_authenticated/configuracoes/$")({
  beforeLoad: ({ params }) => {
    const seg = (params._splat ?? "").split("/")[0] ?? "";
    throw redirect({ to: MAP[seg] ?? "/admin" });
  },
  component: () => null,
});
