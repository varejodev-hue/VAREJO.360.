import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { INDICADORES } from "@/lib/help-content";

export const Route = createFileRoute("/_authenticated/ajuda/indicadores")({
  component: () => (
    <Card><CardContent className="p-0">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr><th className="text-left p-3">Indicador</th><th className="text-left p-3">Fórmula</th><th className="text-left p-3">Bom</th><th className="text-left p-3">Atenção</th></tr>
        </thead>
        <tbody>
          {INDICADORES.map((i) => (
            <tr key={i.nome} className="border-t">
              <td className="p-3 font-medium">{i.nome}</td>
              <td className="p-3 text-muted-foreground">{i.formula}</td>
              <td className="p-3 text-green-700">{i.boa}</td>
              <td className="p-3 text-red-700">{i.ruim}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardContent></Card>
  ),
});
