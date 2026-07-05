import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/especificadores/")({
  beforeLoad: () => { throw redirect({ to: "/especificadores/minha-carteira" }); },
});
