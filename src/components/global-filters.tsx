import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Store, Radio, X, GitCompareArrows, Users, UserCircle2, SlidersHorizontal, Ruler, Layers, Tag, DollarSign, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useGlobalFilters, type Canal, type FaixaValor, FAIXAS_VALOR, TAMANHOS } from "@/lib/global-filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

const PRESETS: { key: string; label: string; days?: number; kind?: "trimestre" | "semestre" }[] = [
  { key: "30", label: "Últimos 30 dias", days: 30 },
  { key: "90", label: "Últimos 90 dias", days: 90 },
  { key: "180", label: "Últimos 180 dias", days: 180 },
  { key: "365", label: "Últimos 12 meses", days: 365 },
  { key: "trimestre", label: "Trimestre atual", kind: "trimestre" },
  { key: "semestre", label: "Semestre atual", kind: "semestre" },
];

const CANAIS: { value: Canal; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "loja", label: "Loja física" },
  { value: "engenharia", label: "Engenharia" },
];

export function GlobalFilters({ className }: { className?: string }) {
  const {
    dataInicio, dataFim, setDataInicio, setDataFim, setPeriodo, setPresetTrimestre, setPresetSemestre,
    lojaId, setLojaId,
    canal, setCanal,
    vendedorId, setVendedorId,
    especificadorId, setEspecificadorId,
    tamanho, setTamanho,
    linha, setLinha,
    categoriaId, setCategoriaId,
    faixaValor, setFaixaValor,
    resetAll,
  } = useGlobalFilters();
  const [comparar, setComparar] = useState(false);

  const lojas = useQuery({
    queryKey: ["gf", "lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const vendedores = useQuery({
    queryKey: ["gf", "vendedores", lojaId],
    queryFn: async () => {
      let q = supabase.from("vendedores").select("id, nome").order("nome");
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const especificadores = useQuery({
    queryKey: ["gf", "especificadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("especificadores").select("id, nome").order("nome").limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const categorias = useQuery({
    queryKey: ["gf", "categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const linhas = useQuery({
    queryKey: ["gf", "linhas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("linha").not("linha", "is", null).limit(1000);
      if (error) throw error;
      const unique = Array.from(new Set((data ?? []).map((r: { linha: string | null }) => r.linha).filter(Boolean) as string[])).sort();
      return unique;
    },
    staleTime: 5 * 60 * 1000,
  });

  const lojaNome = lojaId ? lojas.data?.find((l) => l.id === lojaId)?.nome : null;
  const vendedorNome = vendedorId ? vendedores.data?.find((v) => v.id === vendedorId)?.nome : null;

  const extraCount = (especificadorId ? 1 : 0) + (canal !== "todos" ? 1 : 0) + (tamanho ? 1 : 0) + (linha ? 1 : 0) + (categoriaId ? 1 : 0) + (faixaValor !== "all" ? 1 : 0);
  const activeCount = (lojaId ? 1 : 0) + (vendedorId ? 1 : 0) + extraCount;
  const hasActive = activeCount > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 -mx-2 px-2 py-1.5",
        className,
      )}
    >
      {/* Período — Início / Fim com presets */}
      <div className="inline-flex items-center rounded-md border border-input bg-background h-8 px-1.5 gap-1">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="date"
          value={dataInicio}
          max={dataFim}
          onChange={(e) => setDataInicio(e.target.value)}
          className="h-6 bg-transparent text-xs px-1 outline-none focus:ring-0 [color-scheme:light] dark:[color-scheme:dark]"
          aria-label="Data inicial"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <input
          type="date"
          value={dataFim}
          min={dataInicio}
          onChange={(e) => setDataFim(e.target.value)}
          className="h-6 bg-transparent text-xs px-1 outline-none focus:ring-0 [color-scheme:light] dark:[color-scheme:dark]"
          aria-label="Data final"
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="ml-0.5 inline-flex items-center gap-0.5 h-6 px-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Períodos rápidos"
              aria-label="Períodos rápidos"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  if (p.kind === "trimestre") setPresetTrimestre();
                  else if (p.kind === "semestre") setPresetSemestre();
                  else if (p.days) setPeriodo(p.days);
                }}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted text-foreground"
              >
                {p.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button
          onClick={() => setComparar((v) => !v)}
          className={cn(
            "ml-0.5 inline-flex items-center justify-center h-6 w-6 rounded transition-colors",
            comparar ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          title="Comparar com período anterior"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Loja chip */}
      <ChipSelect
        icon={Store}
        active={!!lojaId}
        label={lojaNome ?? "Todas as lojas"}
        onClear={() => setLojaId(null)}
        value={lojaId ?? "__all"}
        onChange={(v) => setLojaId(v === "__all" ? null : v)}
        options={[{ value: "__all", label: "Todas as lojas" }, ...(lojas.data ?? []).map((l) => ({ value: l.id, label: l.nome }))]}
      />

      {/* Vendedor chip */}
      <ChipSelect
        icon={Users}
        active={!!vendedorId}
        label={vendedorNome ?? "Todos os vendedores"}
        onClear={() => setVendedorId(null)}
        value={vendedorId ?? "__all"}
        onChange={(v) => setVendedorId(v === "__all" ? null : v)}
        options={[{ value: "__all", label: "Todos os vendedores" }, ...(vendedores.data ?? []).map((v) => ({ value: v.id, label: v.nome }))]}
      />

      {/* Mais filtros */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs rounded-md",
              extraCount > 0 ? "text-primary bg-primary/10 hover:bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Mais
            {extraCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                {extraCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros avançados</span>
            {extraCount > 0 && (
              <button
                onClick={() => {
                  setEspecificadorId(null); setCanal("todos"); setTamanho(null); setLinha(null); setCategoriaId(null); setFaixaValor("all");
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>

          <FilterField label="Especificador" icon={UserCircle2}>
            <Select value={especificadorId ?? "__all"} onValueChange={(v) => setEspecificadorId(v === "__all" ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos os especificadores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os especificadores</SelectItem>
                {(especificadores.data ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Categoria" icon={Tag}>
            <Select value={categoriaId ?? "__all"} onValueChange={(v) => setCategoriaId(v === "__all" ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as categorias</SelectItem>
                {(categorias.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Tamanho" icon={Ruler}>
            <div className="flex flex-wrap gap-1">
              <PillButton active={!tamanho} onClick={() => setTamanho(null)}>Todos</PillButton>
              {TAMANHOS.map((t) => (
                <PillButton key={t} active={tamanho === t} onClick={() => setTamanho(tamanho === t ? null : t)}>{t}</PillButton>
              ))}
            </div>
          </FilterField>

          <FilterField label="Linha" icon={Layers}>
            <Select value={linha ?? "__all"} onValueChange={(v) => setLinha(v === "__all" ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas as linhas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as linhas</SelectItem>
                {(linhas.data ?? []).length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem linhas cadastradas</div>}
                {(linhas.data ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Faixa de valor" icon={DollarSign}>
            <Select value={faixaValor} onValueChange={(v) => setFaixaValor(v as FaixaValor)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAIXAS_VALOR.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Canal" icon={Radio}>
            <div className="flex flex-wrap gap-1">
              {CANAIS.map((c) => (
                <PillButton key={c.value} active={canal === c.value} onClick={() => setCanal(c.value)}>{c.label}</PillButton>
              ))}
            </div>
          </FilterField>
        </PopoverContent>
      </Popover>

      {hasActive && (
        <button
          onClick={resetAll}
          className="ml-auto inline-flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Limpar {activeCount}
        </button>
      )}
    </div>
  );
}

function ChipSelect({
  icon: Icon, active, label, onClear, value, onChange, options,
}: {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  label: string;
  onClear: () => void;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      className={cn(
        "group inline-flex items-center rounded-md transition-colors h-8",
        active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground",
      )}
    >
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "h-8 border-0 bg-transparent text-xs gap-1.5 px-2.5 shadow-none focus:ring-0 focus:ring-offset-0",
            "[&>svg:last-child]:opacity-60",
          )}
        >
          <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
          <span className="max-w-[140px] truncate font-medium">{label}</span>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="h-8 w-6 -ml-1 inline-flex items-center justify-center text-primary/70 hover:text-primary"
          aria-label="Limpar filtro"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

function FilterField({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      {children}
    </div>
  );
}
