import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ModuleTabs } from "@/components/module-tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const [{ data: isAdmin }, { data: isGerente }, { data: isHeadPropria }, { data: isHeadFranquia }, { data: isPerformance }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "gerente_loja" }),
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "head_nacional_loja_propria" }),
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "head_nacional_franquia" }),
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "gerente_performance" }),
    ]);
    if (!isAdmin && !isGerente && !isHeadPropria && !isHeadFranquia && !isPerformance) throw redirect({ to: "/dashboard" });
  },
  component: Layout,
});

function Layout() {
  return (
    <>
      <ModuleTabs
        moduleKey="admin"
        title="Administracao"
        description="Usuarios, parametros, fases e governanca do sistema"
        tabs={[
          { to: "/admin/fases-sgp", label: "7 Fases SGP", help: "Roteiro de maturidade do sistema: parametrizacao, dashboard por perfil, alertas, auditoria, filial, plano de acao e permissoes." },
          { to: "/admin/usuarios", label: "Usuarios & Perfis", help: "Cria, ativa, vincula e define perfil de usuarios por hierarquia." },
          { to: "/admin/parametrizacao-filial", label: "Parametrizacao Filial", help: "Permite ajustar regras da filial e pesos da Saude da Loja por escopo global ou loja especifica." },
          { to: "/admin/parametros", label: "Parametros", help: "Parametros globais do sistema e regras automaticas." },
          { to: "/admin/auditoria", label: "Auditoria", help: "Historico de alteracoes sensiveis para rastreabilidade." },
          { to: "/admin/permissoes-sgp", label: "Permissoes SGP", help: "Matriz de acesso por perfil, modulo e acao." },
          { to: "/admin/workflows", label: "Workflows", help: "Automacoes quando/se/entao para tarefas e alertas recorrentes." },
          { to: "/admin/cadastros", label: "Cadastros", help: "Area de cadastros estruturais usados pelo ERP." },
        ]}
      />
      <Outlet />
    </>
  );
}
