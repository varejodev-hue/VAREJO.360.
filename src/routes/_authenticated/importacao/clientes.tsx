import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-shell";
import { CadastroImporter } from "@/components/cadastro-importer";
import { importClientes } from "@/lib/cadastros-import.functions";

export const Route = createFileRoute("/_authenticated/importacao/clientes")({
  component: Page,
});

function Page() {
  const run = useServerFn(importClientes);
  return (
    <div>
      <PageHeader title="Importar Clientes" description="Cadastre ou atualize clientes/compradores finais em massa." />
      <CadastroImporter
        titulo="Clientes"
        colunas={["Nome*", "Email", "Telefone", "Documento", "Cidade", "UF"]}
        modeloNome="modelo-clientes.xlsx"
        modeloRows={[
          { Nome: "Construtora ABC", Email: "contato@abc.com", Telefone: "(11) 4000-0000", Documento: "12.345.678/0001-90", Cidade: "São Paulo", UF: "SP" },
        ]}
        onImport={run}
      />
    </div>
  );
}
