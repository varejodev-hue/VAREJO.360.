import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/cadastros/categorias")({
  component: () => (
    <CrudPage
      table="categorias"
      title="Categorias de Produto"
      description="Hierarquia de categorias (Revestimentos → 60x60, Louças → Cubas, etc.). Deixe 'Categoria pai' em branco para categorias raiz."
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "parent_id", label: "Categoria pai", type: "select", options: () => loadOptions("categorias") },
        { name: "ordem", label: "Ordem", type: "number", defaultValue: 0 },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
