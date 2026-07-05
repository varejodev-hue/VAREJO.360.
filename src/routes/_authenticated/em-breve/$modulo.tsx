import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/em-breve/$modulo")({
  loader: ({ params }) => {
    const mod = MODULOS[params.modulo];
    if (!mod) throw notFound();
    return mod;
  },
  component: EmBrevePage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Módulo não encontrado.</div>
  ),
});

export const MODULOS: Record<string, { titulo: string; descricao: string; recursos: string[] }> = {
  nps: { titulo: "NPS", descricao: "Pesquisa de satisfação de clientes e especificadores, com acompanhamento de promotores, neutros e detratores.", recursos: ["Envio automático após venda", "Painel de respostas", "Tendência por loja e vendedor"] },
  complementos: { titulo: "Complementos", descricao: "Gestão de produtos complementares para aumento de ticket médio.", recursos: ["Sugestão automática por categoria", "Taxa de anexação", "Impacto no ticket"] },
  "mix-produtos": { titulo: "Mix de Produtos", descricao: "Análise de mix vendido por loja, vendedor e especificador.", recursos: ["Curva ABC", "Penetração por categoria", "Comparativo entre lojas"] },
  "performance-regional": { titulo: "Performance Regional", descricao: "Indicadores consolidados por região e franqueado.", recursos: ["Ranking de regiões", "Comparativo de canais", "Heatmap de performance"] },
  ia: { titulo: "Inteligência Artificial", descricao: "Recomendações automáticas e análise preditiva.", recursos: ["Previsão de churn de especificadores", "Sugestão de ações", "Análise de causas"] },
  "plano-acao": { titulo: "Plano de Ação Automático", descricao: "Geração automática de planos de ação a partir dos indicadores.", recursos: ["Tarefas por vendedor", "Acompanhamento de execução", "Resultados mensuráveis"] },
  api: { titulo: "Integração API", descricao: "Integração com ERPs, sistemas de orçamento e BI.", recursos: ["Webhooks de venda", "Importação automática", "Tokens por franquia"] },
  crm: { titulo: "CRM Comercial", descricao: "Gestão de pipeline, follow-ups e oportunidades.", recursos: ["Funil por vendedor", "Atividades", "Histórico de contatos"] },
  eventos: { titulo: "Gestão de Eventos com Especificadores", descricao: "Planejamento e acompanhamento de eventos de relacionamento.", recursos: ["Convites e RSVPs", "ROI por evento", "Lista de presença"] },
  arquitetos: { titulo: "Gestão de Arquitetos", descricao: "Módulo dedicado para arquitetos e escritórios parceiros.", recursos: ["Cadastro de escritórios", "Equipes vinculadas", "Comissionamento"] },
  metas: { titulo: "Metas", descricao: "Definição e acompanhamento de metas por loja, vendedor e período.", recursos: ["Metas mensais", "% atingimento em tempo real", "Histórico"] },
  forecast: { titulo: "Forecast Comercial", descricao: "Projeção de vendas baseada em pipeline e sazonalidade.", recursos: ["Forecast mensal", "Cenários otimista/pessimista", "Curva projetada"] },
};

function EmBrevePage() {
  const mod = Route.useLoaderData();
  return (
    <div>
      <PageHeader
        title={mod.titulo}
        description="Módulo em desenvolvimento."
        action={
          <Link to="/dashboard">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Button>
          </Link>
        }
      />
      <Card className="p-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex h-14 w-14 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <div className="text-lg font-semibold mb-1">Em Desenvolvimento</div>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">{mod.descricao}</p>
        <div className="text-left max-w-md mx-auto">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2"><Sparkles className="h-3 w-3" /> Recursos previstos</div>
          <ul className="space-y-1.5 text-sm">
            {mod.recursos.map((r: string) => (
              <li key={r} className="flex items-start gap-2"><span className="text-primary mt-1">•</span><span>{r}</span></li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
