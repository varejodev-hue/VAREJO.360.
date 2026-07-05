import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { REGRAS } from "@/lib/help-content";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda/regras")({
  component: () => (
    <Card><CardContent className="p-6">
      <ul className="space-y-3">
        {REGRAS.map((r) => (
          <li key={r} className="flex items-start gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </CardContent></Card>
  ),
});
