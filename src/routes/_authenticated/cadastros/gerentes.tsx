import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/gerentes")({
  component: () => (
    <CrudPage
      table="gerentes"
      title="Gerentes"
      description="Gerentes de loja, regionais e nacionais."
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone", type: "text" },
        {
          name: "escopo", label: "Escopo", type: "select", required: true, defaultValue: "loja",
          options: [
            { value: "loja", label: "Loja" },
            { value: "regional", label: "Regional" },
            { value: "nacional", label: "Nacional" },
          ],
        },
        { name: "loja_id", label: "Loja", type: "select", options: () => loadOptions("lojas"), showInTable: false },
        { name: "regiao_id", label: "Região", type: "select", options: () => loadOptions("regioes"), showInTable: false },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
