import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/relacionamento/interacoes")({
  component: () => (
    <CrudPage
      table="interacoes"
      title="Interações com Especificadores"
      description="Registro de ligações, visitas, eventos, almoços, treinamentos e demais ações de relacionamento."
      orderBy="data_interacao"
      fields={[
        { name: "especificador_id", label: "Especificador", type: "select", required: true, options: () => loadOptions("especificadores") },
        { name: "tipo", label: "Tipo", type: "select", required: true, options: [
          { value: "ligacao", label: "Ligação" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "email", label: "E-mail" },
          { value: "visita", label: "Visita" },
          { value: "reuniao", label: "Reunião" },
          { value: "evento", label: "Evento" },
          { value: "almoco", label: "Almoço" },
          { value: "treinamento", label: "Treinamento" },
          { value: "outro", label: "Outro" },
        ]},
        { name: "data_interacao", label: "Data", type: "text", required: true },
        { name: "vendedor_id", label: "Vendedor", type: "select", options: () => loadOptions("vendedores"), showInTable: false },
        { name: "loja_id", label: "Loja", type: "select", options: () => loadOptions("lojas"), showInTable: false },
        { name: "observacao", label: "Observação", type: "text" },
        { name: "proxima_acao", label: "Próxima ação", type: "text", showInTable: false },
        { name: "proxima_data", label: "Próxima data", type: "text", showInTable: false },
      ]}
    />
  ),
});
