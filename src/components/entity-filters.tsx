import { useQuery } from "@tanstack/react-query";
import { Users, UserCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  show?: Array<"vendedor" | "especificador">;
  className?: string;
};

export function EntityFilters({
  show = ["vendedor", "especificador"],
  className,
}: Props) {
  const {
    vendedorId,
    setVendedorId,
    especificadorId,
    setEspecificadorId,
    lojaId,
  } = useGlobalFilters();

  const vendedores = useQuery({
    queryKey: ["entity-filters", "vendedores", lojaId],
    queryFn: async () => {
      let q = supabase.from("vendedores").select("id, nome").order("nome");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: show.includes("vendedor"),
    staleTime: 5 * 60 * 1000,
  });

  const especificadores = useQuery({
    queryKey: ["entity-filters", "especificadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("especificadores")
        .select("id, nome")
        .order("nome")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: show.includes("especificador"),
    staleTime: 5 * 60 * 1000,
  });

  const hasActive =
    (show.includes("vendedor") && vendedorId) ||
    (show.includes("especificador") && especificadorId);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {show.includes("vendedor") && (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={vendedorId ?? "__all"}
            onValueChange={(v) => setVendedorId(v === "__all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os vendedores</SelectItem>
              {(vendedores.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {show.includes("especificador") && (
        <div className="flex items-center gap-1.5">
          <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={especificadorId ?? "__all"}
            onValueChange={(v) =>
              setEspecificadorId(v === "__all" ? null : v)
            }
          >
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue placeholder="Todos os especificadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os especificadores</SelectItem>
              {(especificadores.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (show.includes("vendedor")) setVendedorId(null);
            if (show.includes("especificador")) setEspecificadorId(null);
          }}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}
