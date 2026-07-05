import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, MapPin, Users, UserCog, Briefcase, GraduationCap, UserSquare2, Package, Layers, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/cadastros")({
  component: CadastrosIndex,
});

const cadastros = [
  { to: "/cadastros/lojas", label: "Lojas", icon: Store, desc: "Unidades, regiões e gestores" },
  { to: "/cadastros/regioes", label: "Regiões", icon: MapPin, desc: "Agrupamentos de lojas" },
  { to: "/cadastros/vendedores", label: "Vendedores", icon: Users, desc: "Equipe comercial" },
  { to: "/cadastros/coordenadores", label: "Coordenadores", icon: UserCog, desc: "Gestores intermediários" },
  { to: "/cadastros/gerentes", label: "Gerentes", icon: Briefcase, desc: "Gestores de loja" },
  { to: "/cadastros/especificadores", label: "Especificadores", icon: GraduationCap, desc: "Arquitetos e designers" },
  { to: "/cadastros/clientes", label: "Clientes", icon: UserSquare2, desc: "Base de clientes finais" },
  { to: "/cadastros/produtos", label: "Produtos", icon: Package, desc: "Catálogo e SKUs" },
  { to: "/cadastros/categorias", label: "Categorias", icon: Layers, desc: "Categorização de produtos" },
] as const;

function CadastrosIndex() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {cadastros.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
        >
          <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <c.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm flex items-center gap-1.5">
              {c.label}
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
