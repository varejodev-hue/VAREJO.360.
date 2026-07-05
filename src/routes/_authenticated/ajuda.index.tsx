import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODULOS_DOC_COMPLETO } from "@/lib/help-content";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda/")({
  component: Guia,
});

function Guia() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {MODULOS_DOC_COMPLETO.map((m) => (
        <Card key={m.titulo}>
          <CardHeader><CardTitle className="text-base flex items-center justify-between">
            {m.titulo}
            <Link to={m.link} className="text-xs font-normal text-primary inline-flex items-center gap-1">Abrir <ArrowRight className="h-3 w-3" /></Link>
          </CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section label="Para que serve" text={m.paraQueServe} />
            <Section label="Quem usa" text={m.quemUsa} />
            <Section label="Por que importa" text={m.porQueImporta} />
            {m.obrigatorios && (
              <div>
                <Label>Campos obrigatórios</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">{m.obrigatorios.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}</div>
              </div>
            )}
            <div>
              <Label>Regras</Label>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">{m.regras.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <div>
              <Label>Erros comuns</Label>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-muted-foreground">{m.errosComuns.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
            {m.comoLer && <Section label="Como interpretar" text={m.comoLer} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{children}</div>;
}
function Section({ label, text }: { label: string; text: string }) {
  return <div><Label>{label}</Label><p className="mt-0.5">{text}</p></div>;
}
