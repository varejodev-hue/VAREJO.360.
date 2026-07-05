import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SGP_MODULE_LABEL, SGP_PERMISSIONS, SGP_ROLE_LABEL, type SgpRole } from "@/lib/sgp-permissions";
import { Check, Minus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/permissoes-sgp")({
  component: PermissoesSgp,
});

const roles: SgpRole[] = [
  "admin",
  "head_nacional_loja_propria",
  "head_nacional_franquia",
  "gerente_performance",
  "gerente_regional_franquia",
  "gerente_loja",
  "analista_performance",
  "assistente_venda",
  "projetista",
  "vendedor",
];
const actions = [
  ["podeVer", "Ver"],
  ["podeCriar", "Criar"],
  ["podeEditar", "Editar"],
  ["podeExcluir", "Excluir"],
  ["podeAprovar", "Aprovar"],
  ["podeConfigurar", "Config."],
] as const;

function PermissoesSgp() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {roles.map((role) => {
          const first = SGP_PERMISSIONS.find((p) => p.role === role);
          return (
            <Card key={role}>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Nivel {first?.nivel}</div>
                <div className="mt-1 text-sm font-semibold">{SGP_ROLE_LABEL[role]}</div>
                <div className="mt-2 text-xs text-muted-foreground">{roleDescription(role)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Matriz de permissoes por perfil</h2>
            <p className="text-xs text-muted-foreground">
              Base para separar visao, relatorios e edicao por hierarquia. A regra tambem existe na migration do banco.
            </p>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Modulo</TableHead>
                  {actions.map(([, label]) => <TableHead key={label} className="text-center">{label}</TableHead>)}
                  <TableHead>Regra operacional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SGP_PERMISSIONS.map((perm) => (
                  <TableRow key={`${perm.role}-${perm.modulo}`}>
                    <TableCell>
                      <Badge variant="secondary">{perm.perfil}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{SGP_MODULE_LABEL[perm.modulo]}</TableCell>
                    {actions.map(([field]) => (
                      <TableCell key={field} className="text-center">
                        {perm[field] ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-muted-foreground max-w-[320px]">{perm.observacao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function roleDescription(role: SgpRole) {
  return {
    admin: "Acesso total e suporte tecnico.",
    head_nacional_loja_propria: "Visao nacional das lojas proprias.",
    head_nacional_franquia: "Visao nacional da rede de franquias.",
    gerente_performance: "Governanca de indicadores e parametros.",
    gerente_regional_franquia: "Gestao regional das franquias.",
    gerente_loja: "Gestao completa da filial.",
    analista_performance: "Analise, qualidade de dados e relatorios.",
    assistente_venda: "Administracao operacional do dia a dia.",
    projetista: "Amostras, mostruario e demandas de exposicao.",
    vendedor: "Atendimento, amostras e propria produtividade.",
  }[role];
}
