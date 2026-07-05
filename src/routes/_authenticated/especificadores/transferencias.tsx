import { createFileRoute } from "@tanstack/react-router";
import { TransferenciasPage } from "@/components/pages/transferencias-page";

export const Route = createFileRoute("/_authenticated/especificadores/transferencias")({
  component: TransferenciasPage,
});
