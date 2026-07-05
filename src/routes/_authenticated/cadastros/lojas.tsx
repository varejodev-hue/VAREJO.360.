import { createFileRoute, Link } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cadastros/lojas")({
  component: () => (
    <CrudPage
      table="lojas"
      title="Lojas"
      description="Lojas próprias e franquias da rede."
      fields={[
        { name: "codigo", label: "Código", type: "text", required: true },
        {
          name: "nome",
          label: "Nome",
          type: "text",
          required: true,
          render: (value, row) => (
            <Link
              to="/cadastros/lojas/$id"
              params={{ id: row.id }}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {value}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ),
        },
        {
          name: "tipo", label: "Tipo", type: "select", required: true, defaultValue: "propria",
          options: [
            { value: "propria", label: "Loja Própria" },
            { value: "franquia", label: "Franquia" },
          ],
        },
        {
          name: "canal", label: "Canal", type: "select", required: true,
          options: [
            { value: "loja_propria", label: "Loja Própria" },
            { value: "franquia", label: "Franquia" },
            { value: "nao_classificado", label: "Não classificado" },
          ],
        },
        { name: "regiao_id", label: "Região", type: "select", options: () => loadOptions("regioes"), showInTable: false },
        { name: "cidade", label: "Cidade", type: "text" },
        { name: "uf", label: "UF", type: "text" },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
