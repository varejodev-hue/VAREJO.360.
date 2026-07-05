import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import type { ReactNode } from "react";

export function PlaceholderPage({
  title,
  description,
  bullets,
  phase = "Fase 2",
}: {
  title: string;
  description: string;
  bullets?: string[];
  phase?: string;
  action?: ReactNode;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Construction className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium text-foreground">Tela em construção · {phase}</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Esta tela faz parte do roadmap aprovado. A casca de navegação já está pronta — o conteúdo
            será entregue na próxima fase.
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="text-xs text-muted-foreground mt-4 space-y-1 max-w-sm mx-auto text-left list-disc list-inside">
              {bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
