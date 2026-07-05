import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/produtos")({
  component: () => (
    <CrudPage
      table="produtos"
      title="Produtos"
      description="Catálogo de produtos comercializados."
      fields={[
        { name: "sku", label: "SKU", type: "text", required: true },
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "categoria_id", label: "Categoria", type: "select", options: () => loadOptions("categorias") },
        { name: "categoria", label: "Categoria (legado)", type: "text", showInTable: false },
        { name: "preco", label: "Preço (R$)", type: "number" },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});

