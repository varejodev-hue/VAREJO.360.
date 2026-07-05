import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  beforeLoad: () => { throw redirect({ to: "/orcamentos/carteira" }); },
});
