import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/especificadores")({
  component: () => (
    <CrudPage
      table="especificadores"
      title="Especificadores"
      description="Arquitetos, designers e profissionais que indicam vendas."
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "profissao", label: "Profissão", type: "text" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone", type: "text" },
        { name: "documento", label: "CPF/CNPJ", type: "text", showInTable: false },
        { name: "cidade", label: "Cidade", type: "text" },
        { name: "uf", label: "UF", type: "text" },
        { name: "observacoes", label: "Observações", type: "text", showInTable: false },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
