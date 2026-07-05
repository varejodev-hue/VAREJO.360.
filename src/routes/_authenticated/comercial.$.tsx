import { createFileRoute, redirect } from "@tanstack/react-router";

// Compat: rotas antigas /comercial/* → novos caminhos canônicos
const MAP: Record<string, string> = {
  orcamentos: "/orcamentos/carteira",
  especificadores: "/especificadores/ativos",
  vendedores: "/performance/vendedores",
  transferencias: "/especificadores/transferencias",
  rastreabilidade: "/especificadores/rastreabilidade",
  chat: "/inteligencia/mix",
  importar: "/importacao/orcamentos",
};

export const Route = createFileRoute("/_authenticated/comercial/$")({
  beforeLoad: ({ params }) => {
    const seg = (params._splat ?? "").split("/")[0] ?? "";
    const to = MAP[seg] ?? "/dashboard";
    throw redirect({ to });
  },
  component: () => null,
});
