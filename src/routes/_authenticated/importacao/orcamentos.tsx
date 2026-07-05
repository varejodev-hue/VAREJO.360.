import { createFileRoute } from "@tanstack/react-router";
import { ImportacaoForm } from "@/components/importacao-form";

export const Route = createFileRoute("/_authenticated/importacao/orcamentos")({
  component: () => <ImportacaoForm mode="orcamento" />,
});
