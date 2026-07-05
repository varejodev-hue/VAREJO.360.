import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/clientes")({
  component: () => (
    <CrudPage
      table="clientes"
      title="Clientes"
      description="Clientes finais atendidos pela rede."
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "documento", label: "CPF/CNPJ", type: "text" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone", type: "text" },
        { name: "cidade", label: "Cidade", type: "text" },
        { name: "uf", label: "UF", type: "text" },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
