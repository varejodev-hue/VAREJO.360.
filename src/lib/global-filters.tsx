import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Periodo = number;
export type Canal = "todos" | "loja" | "engenharia" | "ecommerce" | "corporativo";
export type FaixaValor = "all" | "ate25" | "25a50" | "50a100" | "100a250" | "acima250";

export const FAIXAS_VALOR: { value: FaixaValor; label: string; min: number; max: number | null }[] = [
  { value: "all", label: "Todas as faixas", min: 0, max: null },
  { value: "ate25", label: "Até R$ 25 mil", min: 0, max: 25000 },
  { value: "25a50", label: "R$ 25 a 50 mil", min: 25000, max: 50000 },
  { value: "50a100", label: "R$ 50 a 100 mil", min: 50000, max: 100000 },
  { value: "100a250", label: "R$ 100 a 250 mil", min: 100000, max: 250000 },
  { value: "acima250", label: "Acima de R$ 250 mil", min: 250000, max: null },
];

export const TAMANHOS = ["20x120", "45x120", "60x120", "80x80", "90x90", "120x120", "Lastras", "Pequenos Formatos", "Outros"];

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function todayISO() { return toISO(new Date()); }
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISO(d);
}
function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}
function normalizeRange(next: Partial<Persisted>, prev: Persisted): { dataInicio: string; dataFim: string } {
  let dataInicio = isISODate(next.dataInicio) ? next.dataInicio : isISODate(prev.dataInicio) ? prev.dataInicio : daysAgoISO(90);
  let dataFim = isISODate(next.dataFim) ? next.dataFim : isISODate(prev.dataFim) ? prev.dataFim : todayISO();

  if (new Date(`${dataInicio}T00:00:00`).getTime() > new Date(`${dataFim}T00:00:00`).getTime()) {
    if (next.dataInicio !== undefined && next.dataFim === undefined) dataFim = dataInicio;
    else dataInicio = dataFim;
  }

  return { dataInicio, dataFim };
}
export function trimestreAtual(): { inicio: string; fim: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const inicio = new Date(now.getFullYear(), q * 3, 1);
  const fim = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { inicio: toISO(inicio), fim: toISO(fim) };
}
export function semestreAtual(): { inicio: string; fim: string } {
  const now = new Date();
  const s = now.getMonth() < 6 ? 0 : 1;
  const inicio = new Date(now.getFullYear(), s * 6, 1);
  const fim = new Date(now.getFullYear(), s * 6 + 6, 0);
  return { inicio: toISO(inicio), fim: toISO(fim) };
}

type Ctx = {
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  dataInicio: string;
  dataFim: string;
  setDataInicio: (iso: string) => void;
  setDataFim: (iso: string) => void;
  setRange: (inicio: string, fim: string) => void;
  setPresetTrimestre: () => void;
  setPresetSemestre: () => void;
  lojaId: string | null;
  setLojaId: (id: string | null) => void;
  canal: Canal;
  setCanal: (c: Canal) => void;
  regiaoId: string | null;
  setRegiaoId: (id: string | null) => void;
  vendedorId: string | null;
  setVendedorId: (id: string | null) => void;
  especificadorId: string | null;
  setEspecificadorId: (id: string | null) => void;
  status: string | null;
  setStatus: (s: string | null) => void;
  tamanho: string | null;
  setTamanho: (s: string | null) => void;
  linha: string | null;
  setLinha: (s: string | null) => void;
  categoriaId: string | null;
  setCategoriaId: (s: string | null) => void;
  faixaValor: FaixaValor;
  setFaixaValor: (f: FaixaValor) => void;
  inicioISO: string;
  fimISO: string;
  resetAll: () => void;
};

const GlobalFiltersContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sv:global-filters:v4";

type Persisted = {
  dataInicio?: string;
  dataFim?: string;
  lojaId?: string | null;
  canal?: Canal;
  regiaoId?: string | null;
  vendedorId?: string | null;
  especificadorId?: string | null;
  status?: string | null;
  tamanho?: string | null;
  linha?: string | null;
  categoriaId?: string | null;
  faixaValor?: FaixaValor;
};

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>({
    dataInicio: daysAgoISO(90),
    dataFim: todayISO(),
    lojaId: null,
    canal: "todos",
    regiaoId: null,
    vendedorId: null,
    especificadorId: null,
    status: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState((s) => ({ ...s, ...(JSON.parse(raw) as Persisted) }));
    } catch { /* ignore */ }
  }, []);

  function update(next: Partial<Persisted>) {
    setState((prev) => {
      const merged = { ...prev, ...next, ...normalizeRange(next, prev) };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  }

  const { dataInicio, dataFim } = normalizeRange({}, state);
  const periodo = useMemo(() => {
    const ms = new Date(`${dataFim}T00:00:00`).getTime() - new Date(`${dataInicio}T00:00:00`).getTime();
    return Math.max(1, Math.round(ms / 86400000));
  }, [dataInicio, dataFim]);

  const value: Ctx = {
    periodo,
    setPeriodo: (p) => update({ dataInicio: daysAgoISO(p), dataFim: todayISO() }),
    dataInicio,
    dataFim,
    setDataInicio: (iso) => { if (isISODate(iso)) update({ dataInicio: iso }); },
    setDataFim: (iso) => { if (isISODate(iso)) update({ dataFim: iso }); },
    setRange: (inicio, fim) => { if (isISODate(inicio) && isISODate(fim)) update({ dataInicio: inicio, dataFim: fim }); },
    setPresetTrimestre: () => { const r = trimestreAtual(); update({ dataInicio: r.inicio, dataFim: r.fim }); },
    setPresetSemestre: () => { const r = semestreAtual(); update({ dataInicio: r.inicio, dataFim: r.fim }); },
    lojaId: state.lojaId ?? null,
    setLojaId: (id) => update({ lojaId: id }),
    canal: (state.canal ?? "todos") as Canal,
    setCanal: (c) => update({ canal: c }),
    regiaoId: state.regiaoId ?? null,
    setRegiaoId: (id) => update({ regiaoId: id }),
    vendedorId: state.vendedorId ?? null,
    setVendedorId: (id) => update({ vendedorId: id }),
    especificadorId: state.especificadorId ?? null,
    setEspecificadorId: (id) => update({ especificadorId: id }),
    status: state.status ?? null,
    setStatus: (s) => update({ status: s }),
    tamanho: state.tamanho ?? null,
    setTamanho: (s) => update({ tamanho: s }),
    linha: state.linha ?? null,
    setLinha: (s) => update({ linha: s }),
    categoriaId: state.categoriaId ?? null,
    setCategoriaId: (s) => update({ categoriaId: s }),
    faixaValor: (state.faixaValor ?? "all") as FaixaValor,
    setFaixaValor: (f) => update({ faixaValor: f }),
    inicioISO: dataInicio,
    fimISO: dataFim,
    resetAll: () => update({ lojaId: null, canal: "todos", regiaoId: null, vendedorId: null, especificadorId: null, status: null, tamanho: null, linha: null, categoriaId: null, faixaValor: "all" }),
  };

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = useContext(GlobalFiltersContext);
  if (!ctx) throw new Error("useGlobalFilters must be used inside GlobalFiltersProvider");
  return ctx;
}
