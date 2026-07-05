import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/relacionamento/")({
  beforeLoad: () => { throw redirect({ to: "/relacionamento/interacoes" }); },
});
