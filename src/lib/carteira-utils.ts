export function fmtBRL(n: number | null | undefined) {
  return (Number(n ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
export function fmtInt(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("pt-BR");
}
export function fmtPct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(1)}%`;
}
export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  acompanhamento: { label: "Em acompanhamento", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  em_risco: { label: "Em risco", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  inativo: { label: "Inativo", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  sem_responsavel: { label: "Sem responsável", cls: "bg-zinc-100 text-zinc-800 border-zinc-200" },
  compartilhado: { label: "Compartilhado", cls: "bg-violet-100 text-violet-800 border-violet-200" },
};

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));
