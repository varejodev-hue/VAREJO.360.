import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/coordenadores")({
  component: () => (
    <CrudPage
      table="coordenadores"
      title="Coordenadores"
      description="Coordenadores de loja."
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone", type: "text" },
        { name: "loja_id", label: "Loja", type: "select", options: () => loadOptions("lojas") },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
