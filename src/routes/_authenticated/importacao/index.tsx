import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/importacao/")({
  beforeLoad: () => { throw redirect({ to: "/importacao/orcamentos" }); },
});
