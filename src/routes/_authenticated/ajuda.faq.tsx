import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { FAQ } from "@/lib/help-content";

export const Route = createFileRoute("/_authenticated/ajuda/faq")({
  component: () => (
    <Card><CardContent className="p-4">
      <Accordion type="single" collapsible>
        {FAQ.map((f, i) => (
          <AccordionItem key={i} value={`q${i}`}>
            <AccordionTrigger className="text-sm text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </CardContent></Card>
  ),
});
