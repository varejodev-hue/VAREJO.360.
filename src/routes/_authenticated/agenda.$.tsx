import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/agenda/$")({
  beforeLoad: ({ params }) => {
    const seg = (params._splat ?? "").split("/")[0] ?? "";
    const to = seg === "roi" ? "/relacionamento/roi" : "/relacionamento/agenda";
    throw redirect({ to });
  },
  component: () => null,
});
