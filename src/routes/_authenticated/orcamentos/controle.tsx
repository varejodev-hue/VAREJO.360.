import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, Search, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { useGlobalFilters } from "@/lib/global-filters";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamentos/controle")({
  component: ControleVendedor,
});

type Row = {
  id: string;
  numero: string;
  numero_pedido: string | null;
  data_orcamento: string;
  previsao_fechamento: string | null;
  proximo_followup: string | null;
  valor_orcado: number;
  valor_vendido: number;
  status: string;
  ar_status: string | null;
  ar_pago_em: string | null;
  ar_valor_pago: number | null;
  temperatura: string | null;
  motivo_atual: string | null;
  proxima_acao: string | null;
  loja_id: string | null;
  vendedor_id: string | null;
  lojas: { nome: string } | null;
  vendedores: { nome: string } | null;
  clientes: { nome: string } | null;
};

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtDate(s: string | null) {
  if (!s) return "-";
  return new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR");
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / 86400000);
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86400000);
}

const temperaturaOptions = [
  { value: "auto", label: "Automática" },
  { value: "quente", label: "Quente" },
  { value: "atencao", label: "Atenção" },
  { value: "parado", label: "Parado" },
  { value: "risco_perda", label: "Risco de perda" },
  { value: "fechamento_proximo", label: "Fechamento próximo" },
];

const motivoOptions = [
  { value: "nao_informado", label: "Não informado" },
  { value: "aguardando_cliente", label: "Aguardando cliente" },
  { value: "aguardando_arquiteto", label: "Aguardando arquiteto" },
  { value: "preco", label: "Preço" },
  { value: "prazo", label: "Prazo" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "falta_produto", label: "Falta produto" },
  { value: "aguardando_pagamento", label: "Aguardando pagamento" },
  { value: "negociacao", label: "Negociação" },
  { value: "sem_retorno", label: "Sem retorno" },
];

const acaoOptions = [
  { value: "auto", label: "Automática" },
  { value: "ligar_hoje", label: "Ligar hoje" },
  { value: "enviar_whatsapp", label: "Enviar WhatsApp" },
  { value: "confirmar_decisao", label: "Confirmar decisão" },
  { value: "cobrar_especificador", label: "Cobrar especificador" },
  { value: "validar_ar", label: "Validar AR" },
  { value: "revisar_condicao", label: "Revisar condição" },
  { value: "agendar_visita", label: "Agendar visita" },
  { value: "sem_acao", label: "Sem ação" },
];

function optionLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? "Automática";
}

function temperaturaSugerida(r: Pick<Row, "data_orcamento" | "previsao_fechamento" | "ar_status">) {
  const idade = daysSince(r.data_orcamento);
  const vence = daysUntil(r.previsao_fechamento);
  if (r.ar_status === "pendente" || r.ar_status === "divergente") return "atencao";
  if (vence !== null && vence >= 0 && vence <= 3) return "fechamento_proximo";
  if (idade >= 90) return "risco_perda";
  if (idade >= 45) return "parado";
  if (!r.previsao_fechamento && idade >= 7) return "atencao";
  return "quente";
}

function acaoSugerida(r: Pick<Row, "data_orcamento" | "previsao_fechamento" | "ar_status" | "motivo_atual">) {
  const idade = daysSince(r.data_orcamento);
  const vence = daysUntil(r.previsao_fechamento);
  if (r.ar_status === "pendente" || r.ar_status === "divergente") return "validar_ar";
  if (r.motivo_atual === "aguardando_arquiteto") return "cobrar_especificador";
  if (r.motivo_atual === "preco" || r.motivo_atual === "concorrencia") return "revisar_condicao";
  if (vence !== null && vence >= 0 && vence <= 3) return "confirmar_decisao";
  if (idade >= 45) return "ligar_hoje";
  return "enviar_whatsapp";
}

function ControleVendedor() {
  const qc = useQueryClient();
  const currentUser = useCurrentUser();
  const userId = currentUser.data?.id;
  const { inicioISO, lojaId, vendedorId, especificadorId } = useGlobalFilters();
  const [q, setQ] = useState("");

  const profile = useQuery({
    queryKey: ["controle-vendedor-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: p, error: pError }, { data: roles, error: rError }] = await Promise.all([
        (supabase as any).from("profiles").select("loja_id,vendedor_id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      if (pError) throw pError;
      if (rError) throw rError;
      return { profile: p as { loja_id: string | null; vendedor_id: string | null } | null, roles: (roles ?? []).map((r) => r.role as string) };
    },
  });

  const roleVendedor = profile.data?.roles.includes("vendedor");
  const vendedorEfetivo = vendedorId || (roleVendedor ? profile.data?.profile?.vendedor_id : null);
  const lojaEfetiva = lojaId || (roleVendedor ? profile.data?.profile?.loja_id : null);

  const rowsQuery = useQuery({
    queryKey: ["controle-vendedor", inicioISO, lojaEfetiva, vendedorEfetivo, especificadorId],
    enabled: !roleVendedor || !!profile.data,
    queryFn: async () => {
      let qry = (supabase as any)
        .from("orcamentos")
        .select("id,numero,numero_pedido,data_orcamento,previsao_fechamento,proximo_followup,valor_orcado,valor_vendido,status,ar_status,ar_pago_em,ar_valor_pago,temperatura,motivo_atual,proxima_acao,loja_id,vendedor_id,lojas(nome),vendedores(nome),clientes(nome)")
        .in("status", ["orcado", "parcial"])
        .gte("data_orcamento", inicioISO)
        .order("data_orcamento", { ascending: false })
        .limit(700);
      if (lojaEfetiva) qry = qry.eq("loja_id", lojaEfetiva);
      if (vendedorEfetivo) qry = qry.eq("vendedor_id", vendedorEfetivo);
      if (especificadorId) qry = qry.eq("especificador_id", especificadorId);
      const { data, error } = await qry;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["controle-vendedor-tasks", lojaEfetiva, vendedorEfetivo],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      let qry = supabase
        .from("tasks")
        .select("id,due_at,vendedor_id,loja_id,orcamento_id")
        .eq("status", "pendente")
        .eq("tipo", "followup")
        .lte("due_at", `${hoje}T23:59:59`);
      if (lojaEfetiva) qry = qry.eq("loja_id", lojaEfetiva);
      if (vendedorEfetivo) qry = qry.eq("vendedor_id", vendedorEfetivo);
      const { data, error } = await qry;
      if (error) throw error;
      return data ?? [];
    },
  });

  const gerarFollowups = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gerar_followups_orcamentos_sgp" as any);
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["controle-vendedor"] });
      qc.invalidateQueries({ queryKey: ["controle-vendedor-tasks"] });
      toast.success(`${n} follow-up(s) criados ou atualizados.`);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar follow-ups."),
  });

  const salvarPrevisao = useMutation({
    mutationFn: async ({ id, previsao }: { id: string; previsao: string | null }) => {
      const { error } = await (supabase as any)
        .from("orcamentos")
        .update({ previsao_fechamento: previsao || null })
        .eq("id", id);
      if (error) throw error;
      await supabase.rpc("gerar_followups_orcamentos_sgp" as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controle-vendedor"] });
      toast.success("Previsão atualizada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar previsão."),
  });

  const salvarClassificacao = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Row, "temperatura" | "motivo_atual" | "proxima_acao">> }) => {
      const { error } = await (supabase as any)
        .from("orcamentos")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controle-vendedor"] });
      toast.success("Carteira atualizada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar carteira."),
  });

  const rows = rowsQuery.data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.numero?.toLowerCase().includes(s) ||
      r.numero_pedido?.toLowerCase().includes(s) ||
      r.clientes?.nome?.toLowerCase().includes(s) ||
      r.vendedores?.nome?.toLowerCase().includes(s) ||
      r.lojas?.nome?.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const kpi = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.valor_orcado || 0), 0);
    const arPago = rows.reduce((s, r) => s + Number(r.ar_valor_pago || 0), 0);
    const previsao7d = rows.filter((r) => {
      const d = daysUntil(r.previsao_fechamento);
      return d !== null && d >= 0 && d <= 7;
    });
    const semPrevisao = rows.filter((r) => !r.previsao_fechamento).length;
    const risco = rows.filter((r) => {
      const t = r.temperatura && r.temperatura !== "auto" ? r.temperatura : temperaturaSugerida(r);
      return t === "risco_perda" || t === "parado";
    }).length;
    return { total, arPago, previsao7d: previsao7d.length, semPrevisao, risco };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Controle do Vendedor"
        description="Carteira aberta, rotina de follow-up, previsão de fechamento e AR da carteira."
        action={
          <Button onClick={() => gerarFollowups.mutate()} disabled={gerarFollowups.isPending}>
            <RefreshCw className={cn("h-4 w-4 mr-2", gerarFollowups.isPending && "animate-spin")} />
            Gerar follow-ups
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Mini label="Carteira aberta" value={fmtMoney(kpi.total)} sub={`${rows.length.toLocaleString("pt-BR")} orçamentos`} />
        <Mini label="Follow-ups vencidos/hoje" value={(tasksQuery.data?.length ?? 0).toLocaleString("pt-BR")} tone={(tasksQuery.data?.length ?? 0) > 0 ? "attention" : "healthy"} />
        <Mini label="Fechamento em 7 dias" value={kpi.previsao7d.toLocaleString("pt-BR")} />
        <Mini label="Sem previsão" value={kpi.semPrevisao.toLocaleString("pt-BR")} tone={kpi.semPrevisao > 0 ? "critical" : "healthy"} />
        <Mini label="Parados/risco" value={kpi.risco.toLocaleString("pt-BR")} tone={kpi.risco > 0 ? "critical" : "healthy"} />
        <Mini label="AR pago" value={fmtMoney(kpi.arPago)} tone="healthy" />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <WalletCards className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Carteira para ação</div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar orçamento, pedido, cliente..." className="h-8 pl-7 w-72" />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Orçamento", "Cliente", "Vendedor", "Prioridade", "Motivo", "Próxima ação", "Previsão", "Follow/AR", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsQuery.isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Carregando carteira...</td></tr>}
              {!rowsQuery.isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum orçamento em aberto nos filtros atuais.</td></tr>}
              {filtered.map((r) => {
                const idade = daysSince(r.data_orcamento);
                const vence = daysUntil(r.previsao_fechamento);
                const ar = r.ar_status ?? "nao_informado";
                const temperatura = r.temperatura && r.temperatura !== "auto" ? r.temperatura : temperaturaSugerida(r);
                const proximaAcao = r.proxima_acao && r.proxima_acao !== "auto" ? r.proxima_acao : acaoSugerida(r);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <div className="font-mono text-xs">{r.numero}</div>
                      <div className="text-[11px] text-muted-foreground">{r.lojas?.nome ?? "-"}{r.numero_pedido ? ` · pedido ${r.numero_pedido}` : ""}</div>
                    </td>
                    <td className="p-3">{r.clientes?.nome ?? "-"}</td>
                    <td className="p-3 text-muted-foreground">{r.vendedores?.nome ?? "-"}</td>
                    <td className="p-3">
                      <div className="space-y-1.5">
                        <TemperaturaBadge value={temperatura} />
                        <div className="text-[11px] text-muted-foreground">{idade}d · {fmtMoney(Number(r.valor_orcado || 0))}</div>
                        <Select value={r.temperatura ?? "auto"} onValueChange={(v) => salvarClassificacao.mutate({ id: r.id, patch: { temperatura: v } })}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {temperaturaOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="p-3">
                      <Select value={r.motivo_atual ?? "nao_informado"} onValueChange={(v) => salvarClassificacao.mutate({ id: r.id, patch: { motivo_atual: v } })}>
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {motivoOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1.5">
                        <Badge variant="secondary" className="whitespace-nowrap">{optionLabel(acaoOptions, proximaAcao)}</Badge>
                        <Select value={r.proxima_acao ?? "auto"} onValueChange={(v) => salvarClassificacao.mutate({ id: r.id, patch: { proxima_acao: v } })}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {acaoOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          defaultValue={r.previsao_fechamento ?? ""}
                          className="h-8 w-36"
                          onBlur={(e) => {
                            const next = e.target.value || null;
                            if (next !== (r.previsao_fechamento ?? null)) salvarPrevisao.mutate({ id: r.id, previsao: next });
                          }}
                        />
                        {vence !== null && vence <= 3 && vence >= 0 && <AlertTriangle className="h-4 w-4 text-[var(--status-attention)]" />}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        {fmtDate(r.proximo_followup)}
                      </div>
                      <ArBadge status={ar} />
                      {r.ar_pago_em && <div className="text-[11px] text-muted-foreground mt-1">{fmtDate(r.ar_pago_em)}</div>}
                    </td>
                    <td className="p-3 text-right">
                      <Link to="/orcamentos/$numero" params={{ numero: r.numero }}>
                        <Button size="sm" variant="ghost">Abrir</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "healthy" | "attention" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone && `text-[var(--status-${tone})]`)}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}

function TemperaturaBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    quente: { label: "Quente", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
    atencao: { label: "Atenção", cls: "border-[var(--status-attention)]/30 bg-[var(--status-attention-soft)] text-[var(--status-attention)]" },
    parado: { label: "Parado", cls: "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]" },
    risco_perda: { label: "Risco de perda", cls: "border-[var(--status-critical)]/40 bg-[var(--status-critical-soft)] text-[var(--status-critical)]" },
    fechamento_proximo: { label: "Fechamento próximo", cls: "border-primary/30 bg-primary/10 text-primary" },
  };
  const item = map[value] ?? map.quente;
  return <Badge variant="outline" className={cn("whitespace-nowrap", item.cls)}>{item.label}</Badge>;
}

function ArBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon?: ReactNode }> = {
    pago: { label: "Pago", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
    parcial: { label: "Parcial", cls: "border-[var(--status-attention)]/30 bg-[var(--status-attention-soft)] text-[var(--status-attention)]" },
    pendente: { label: "Pendente", cls: "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]" },
    divergente: { label: "Divergente", cls: "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]" },
    nao_informado: { label: "Não informado", cls: "border-muted-foreground/20 text-muted-foreground" },
  };
  const item = map[status] ?? map.nao_informado;
  return <Badge variant="outline" className={cn("gap-1", item.cls)}>{item.icon}{item.label}</Badge>;
}
