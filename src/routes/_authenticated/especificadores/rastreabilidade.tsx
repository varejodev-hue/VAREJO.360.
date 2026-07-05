import { createFileRoute } from "@tanstack/react-router";
import { RastreabilidadePage } from "@/components/pages/rastreabilidade-page";

export const Route = createFileRoute("/_authenticated/especificadores/rastreabilidade")({
  component: RastreabilidadePage,
});
