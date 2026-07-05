import { createFileRoute } from "@tanstack/react-router";
import { ImportacaoForm } from "@/components/importacao-form";

export const Route = createFileRoute("/_authenticated/importacao/vendas")({
  component: () => <ImportacaoForm mode="venda" />,
});
