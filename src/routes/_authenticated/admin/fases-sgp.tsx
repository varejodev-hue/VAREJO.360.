import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, Gauge, Route as RouteIcon, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/fases-sgp")({
  component: FasesSgp,
});

const FASES = [
  { id: 1, titulo: "Parametrizacao da Saude", objetivo: "Definir pesos e limites dos indicadores por filial.", to: "/admin/parametrizacao-filial" },
  { id: 2, titulo: "Dashboard por Perfil", objetivo: "Separar visao inicial por vendedor, gerente, assistente e head.", to: "/dashboard" },
  { id: 3, titulo: "Alertas Automaticos", objetivo: "Priorizar pendencias criticas no topo da rotina.", to: "/operacao/alertas" },
  { id: 4, titulo: "Auditoria", objetivo: "Registrar alteracoes sensiveis e manter rastreabilidade.", to: "/admin/auditoria" },
  { id: 5, titulo: "Configuracao da Filial", objetivo: "Permitir que cada loja ajuste regras de rotina, atendimento e prazos.", to: "/admin/parametrizacao-filial" },
  { id: 6, titulo: "Plano de Acao", objetivo: "Transformar gaps da Saude da Loja em responsavel, prazo e evidencia.", to: "/performance/plano-acao" },
  { id: 7, titulo: "Permissoes por Acao", objetivo: "Refinar quem pode criar, editar, aprovar, exportar e configurar.", to: "/admin/permissoes-sgp" },
];

function FasesSgp() {
  const { data } = useQuery({
    queryKey: ["fases-sgp-resumo"],
    queryFn: async () => {
      const db = supabase as any;
      const [params, planos, auditoria] = await Promise.all([
        db.from("sgp_parametros_filial").select("id", { count: "exact", head: true }),
        db.from("sgp_planos_acao").select("id", { count: "exact", head: true }).neq("status", "cancelado"),
        db.from("sgp_auditoria").select("id", { count: "exact", head: true }),
      ]);
      return {
        params: params.count ?? 0,
        planos: planos.count ?? 0,
        auditoria: auditoria.count ?? 0,
      };
    },
  });

  const concluida = (id: number) => {
    if ([2, 3, 7].includes(id)) return true;
    if ([1, 5].includes(id)) return (data?.params ?? 0) > 0;
    if (id === 4) return (data?.auditoria ?? 0) > 0;
    if (id === 6) return (data?.planos ?? 0) > 0;
    return false;
  };
  const feitas = FASES.filter((f) => concluida(f.id)).length;

  return (
    <div>
      <PageHeader
        title="7 Fases do SGP"
        description="Roteiro de maturidade para sair da base operacional e chegar em gestao executiva por rotina, indicador e responsabilidade."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Mini label="Fases" value="7" />
        <Mini label="Ativas" value={String(feitas)} />
        <Mini label="Planos de acao" value={String(data?.planos ?? 0)} />
        <Mini label="Auditorias" value={String(data?.auditoria ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {FASES.map((fase) => {
          const done = concluida(fase.id);
          return (
            <Card key={fase.id}>
              <CardContent className="p-5 flex gap-4">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Fase {fase.id}</Badge>
                    <Badge variant={done ? "default" : "secondary"}>{done ? "Ativa" : "Preparada"}</Badge>
                  </div>
                  <div className="mt-2 font-semibold">{fase.titulo}</div>
                  <div className="text-sm text-muted-foreground mt-1">{fase.objetivo}</div>
                  <Link to={fase.to as any}>
                    <Button variant="outline" size="sm" className="mt-4">
                      Abrir fase
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardContent className="p-5 grid md:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-3"><Gauge className="h-5 w-5 text-primary" /><span>A fase 1 alimenta a nota de Saude da Loja.</span></div>
          <div className="flex gap-3"><RouteIcon className="h-5 w-5 text-primary" /><span>A fase 6 transforma gap em execucao.</span></div>
          <div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><span>A fase 7 protege a hierarquia e os dados.</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </CardContent></Card>
  );
}
