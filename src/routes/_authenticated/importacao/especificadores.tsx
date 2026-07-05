import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-shell";
import { CadastroImporter } from "@/components/cadastro-importer";
import { importEspecificadores } from "@/lib/cadastros-import.functions";

export const Route = createFileRoute("/_authenticated/importacao/especificadores")({
  component: Page,
});

function Page() {
  const run = useServerFn(importEspecificadores);
  return (
    <div>
      <PageHeader title="Importar Especificadores" description="Atualize ou cadastre arquitetos/designers em massa." />
      <CadastroImporter
        titulo="Especificadores"
        colunas={["Nome*", "Email", "Telefone", "Cidade", "UF", "Profissão", "Documento", "Observações"]}
        modeloNome="modelo-especificadores.xlsx"
        modeloRows={[
          { Nome: "Maria Arquiteta", Email: "maria@exemplo.com", Telefone: "(11) 99999-0000", Cidade: "São Paulo", UF: "SP", Profissão: "Arquiteta", Documento: "123.456.789-00", Observações: "" },
        ]}
        onImport={run}
      />
    </div>
  );
}
