import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/relacionamento/agenda")({
  component: () => (
    <CrudPage
      table="eventos"
      title="Agenda Comercial"
      description="Eventos, visitas, almoços, treinamentos e ações de relacionamento."
      orderBy="data_evento"
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "tipo", label: "Tipo", type: "select", required: true, options: [
          { value: "evento", label: "Evento" },
          { value: "visita", label: "Visita" },
          { value: "almoco", label: "Almoço" },
          { value: "treinamento", label: "Treinamento" },
          { value: "happy_hour", label: "Happy Hour" },
          { value: "cafe", label: "Café" },
          { value: "reuniao", label: "Reunião" },
          { value: "outro", label: "Outro" },
        ]},
        { name: "data_evento", label: "Data/Hora", type: "text", required: true },
        { name: "loja_id", label: "Loja", type: "select", options: () => loadOptions("lojas") },
        { name: "responsavel_id", label: "Responsável", type: "select", options: () => loadOptions("vendedores"), showInTable: false },
        { name: "investimento", label: "Investimento (R$)", type: "number" },
        { name: "observacao", label: "Observação", type: "text", showInTable: false },
      ]}
    />
  ),
});
