import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/regioes")({
  component: () => (
    <CrudPage
      table="regioes"
      title="Regiões"
      description="Agrupamento geográfico de lojas."
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "uf", label: "UF", type: "text" },
      ]}
    />
  ),
});
