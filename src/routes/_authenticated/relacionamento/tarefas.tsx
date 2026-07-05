import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";

export const Route = createFileRoute("/_authenticated/relacionamento/tarefas")({
  component: () => (
    <CrudPage
      table="tasks"
      title="Tarefas / Follow-ups"
      description="Tarefas pendentes do vendedor — base do Meu Dia. Lembretes de follow-up (D+2, D+7, D+15, D+30) e contatos manuais."
      orderBy="due_at"
      fields={[
        { name: "titulo", label: "Título", type: "text", required: true },
        { name: "tipo", label: "Tipo", type: "select", required: true, options: [
          { value: "followup", label: "Follow-up" },
          { value: "ligacao", label: "Ligação" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "email", label: "E-mail" },
          { value: "visita", label: "Visita" },
          { value: "aniversario", label: "Aniversário" },
          { value: "outro", label: "Outro" },
        ]},
        { name: "due_at", label: "Vencimento", type: "text", required: true },
        { name: "status", label: "Status", type: "select", required: true, defaultValue: "pendente", options: [
          { value: "pendente", label: "Pendente" },
          { value: "em_andamento", label: "Em andamento" },
          { value: "concluida", label: "Concluída" },
          { value: "cancelada", label: "Cancelada" },
        ]},
        { name: "especificador_id", label: "Especificador", type: "select", options: () => loadOptions("especificadores"), showInTable: false },
        { name: "vendedor_id", label: "Vendedor", type: "select", options: () => loadOptions("vendedores"), showInTable: false },
        { name: "descricao", label: "Descrição", type: "text", showInTable: false },
      ]}
    />
  ),
});
