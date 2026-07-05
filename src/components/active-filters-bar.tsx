import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActiveFiltersBar() {
  const f = useGlobalFilters();

  const lojas = useQuery({
    queryKey: ["af-lojas"],
    queryFn: async () => (await supabase.from("lojas").select("id,nome")).data ?? [],
  });
  const vendedores = useQuery({
    queryKey: ["af-vendedores"],
    queryFn: async () => (await supabase.from("vendedores").select("id,nome")).data ?? [],
  });
  const especificadores = useQuery({
    queryKey: ["af-especificadores"],
    queryFn: async () => (await supabase.from("especificadores").select("id,nome")).data ?? [],
  });
  const regioes = useQuery({
    queryKey: ["af-regioes"],
    queryFn: async () => (await supabase.from("regioes").select("id,nome")).data ?? [],
  });

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (f.lojaId) {
    const nome = lojas.data?.find((x) => x.id === f.lojaId)?.nome ?? "Loja";
    chips.push({ key: "loja", label: `Loja: ${nome}`, onRemove: () => f.setLojaId(null) });
  }
  if (f.vendedorId) {
    const nome = vendedores.data?.find((x) => x.id === f.vendedorId)?.nome ?? "Vendedor";
    chips.push({ key: "vendedor", label: `Vendedor: ${nome}`, onRemove: () => f.setVendedorId(null) });
  }
  if (f.especificadorId) {
    const nome = especificadores.data?.find((x) => x.id === f.especificadorId)?.nome ?? "Especificador";
    chips.push({ key: "especificador", label: `Especificador: ${nome}`, onRemove: () => f.setEspecificadorId(null) });
  }
  if (f.regiaoId) {
    const nome = regioes.data?.find((x) => x.id === f.regiaoId)?.nome ?? "Região";
    chips.push({ key: "regiao", label: `Região: ${nome}`, onRemove: () => f.setRegiaoId(null) });
  }
  if (f.canal && f.canal !== "todos") {
    chips.push({ key: "canal", label: `Canal: ${f.canal}`, onRemove: () => f.setCanal("todos") });
  }
  if (f.status) {
    chips.push({ key: "status", label: `Status: ${f.status}`, onRemove: () => f.setStatus(null) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 lg:px-6 py-2 border-b bg-muted/30">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Filtros ativos:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.onRemove}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs hover:bg-primary/20 transition-colors"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={f.resetAll}>
        Limpar tudo
      </Button>
    </div>
  );
}
