import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/agenda/")({
  beforeLoad: () => {
    throw redirect({ to: "/relacionamento/agenda" });
  },
  component: () => null,
});
