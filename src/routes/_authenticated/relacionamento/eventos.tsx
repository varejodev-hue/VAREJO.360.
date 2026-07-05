import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relacionamento/eventos")({
  component: Eventos,
});

function Eventos() {
  return (
    <div className="rounded-lg border bg-card p-12 text-center">
      <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <h2 className="text-lg font-semibold">Eventos</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Cadastre eventos, treinamentos e ações de relacionamento. Em breve.
      </p>
    </div>
  );
}
