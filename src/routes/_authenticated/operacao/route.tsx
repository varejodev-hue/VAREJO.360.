import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";

export const Route = createFileRoute("/_authenticated/operacao")({
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs
        moduleKey="operacao"
        title="Operacao da Loja"
        description="Atendimento da vez, rotina, amostras, materiais, compras e manutencao da filial."
        tabs={[
          { to: "/operacao/alertas", label: "Alertas", help: "Centraliza pendencias criticas: manutencao, rotina, compra, estoque, amostra, follow-up, AR e planejamento." },
          { to: "/operacao/calendario", label: "Calendario", help: "Mostra vencimentos e compromissos operacionais por data." },
          { to: "/operacao/planejamento", label: "Planejamento", help: "Local do gerente registrar FCA semanal ou mensal, plano de acao e indicadores." },
          { to: "/operacao/atendimento-da-vez", label: "Atendimento da Vez", help: "Controla a fila justa dos consultores, contabilizando somente atendimentos validos para prioridade." },
          { to: "/operacao/rotina", label: "Rotina", help: "Organiza responsabilidades diarias, semanais e mensais por perfil, com substituicao e evidencia." },
          { to: "/operacao/amostras", label: "Amostras", help: "Controla cadastro, emprestimo, devolucao, atraso e inativacao de amostras." },
          { to: "/operacao/materiais", label: "Materiais e Compras", help: "Controla estoque interno, minimo, maximo, sugestao de compra e checklist do fluxo de compras." },
          { to: "/operacao/manutencao", label: "Manutencao", help: "Agenda manutencoes preventivas, fornecedores, periodicidade, proxima execucao e itens vencidos." },
        ]}
      />
      <Outlet />
    </>
  );
}
