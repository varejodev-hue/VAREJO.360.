import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shop Varejo — Performance Comercial" },
      { name: "description", content: "Plataforma de gestão de orçamentos, especificadores e rastreabilidade comercial para lojas próprias e franquias." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary" />
            <span className="font-semibold">Shop Varejo</span>
          </div>
          <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
        </div>
      </header>
      <section className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
            Performance comercial para <span className="text-primary">lojas próprias e franquias</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Controle de orçamentos, acompanhamento de especificadores e rastreabilidade ponta a ponta — uma plataforma única para sua rede.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Acessar plataforma</Link></Button>
          </div>
        </div>
      </section>
      <footer className="border-t bg-background py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Shop Varejo — Plataforma interna
      </footer>
    </div>
  );
}
