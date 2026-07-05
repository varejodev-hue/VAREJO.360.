import { createFileRoute } from "@tanstack/react-router";
import { EspecificadoresSegmentList } from "@/components/especificadores-list";

export const Route = createFileRoute("/_authenticated/especificadores/ativos")({
  component: () => <EspecificadoresSegmentList segmento="ativos" />,
});
