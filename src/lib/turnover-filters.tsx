import { type ReactNode } from "react";
import { useGlobalFilters } from "@/lib/global-filters";

export type TurnoverFilters = {
  dataInicio: string;
  dataFim: string;
  lojaId: string | null;
};

type Ctx = TurnoverFilters & {
  setDataInicio: (v: string) => void;
  setDataFim: (v: string) => void;
  setLojaId: (v: string | null) => void;
};

export function TurnoverFiltersProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useTurnoverFilters(): Ctx {
  const g = useGlobalFilters();
  return {
    dataInicio: g.dataInicio,
    dataFim: g.dataFim,
    lojaId: g.lojaId,
    setDataInicio: g.setDataInicio,
    setDataFim: g.setDataFim,
    setLojaId: g.setLojaId,
  };
}

// Filtros agora vêm da barra global no topo — evita duplicação.
export function TurnoverFiltersBar() {
  return null;
}
