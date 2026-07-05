import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/performance/")({
  beforeLoad: () => { throw redirect({ to: "/performance/lojas" }); },
});
