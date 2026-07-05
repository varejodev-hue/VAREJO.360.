import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, MessageCircle, Search, UserCheck, UserX, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useGlobalFilters } from "@/lib/global-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/especificadores/minha-carteira")({
  component: MinhaCarteiraEspecificadores,
});

type OrcRow = {
  especificador_id: string;
  data_orcamento: string;
  valor_orcado: number;
  valor_vendido: number;
  status: string;
  loja_id: string | null;
  vendedor_id: string | null;
  especificadores: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    profissao: string | null;
    ativo: boolean;
  } | null;
  vendedores: { nome: string } | null;
  lojas: { nome: string } | null;
};

type CarteiraRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  profissao: string | null;
  ativo: boolean;
  loja_id: string | null;
  loja_nome: string;
  vendedor_id: string | null;
  vendedor_nome: string;
  ultimo_orcamento: string | null;
  ultimo_contato: string | null;
  qtd_orcamentos: number;
  qtd_vendas: number;
  valor_orcado: number;
  valor_vendido: number;
  conversao: number;
  dias_sem_mov: number;
  estado: EstadoParceria;
  proxima_acao: string;
};

type EstadoParceria = "parceria_ativa" | "relacionamento_quente" | "atencao" | "risco" | "inativo" | "sem_venda";

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtDate(s: string | null) {
  if (!s) return "-";
  return new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function daysSince(iso: string | null) {
  if (!iso) return 99999;
  return Math.floor((Date.now() - new Date(`${iso.slice(0, 10)}T00:00:00`).getTime()) / 86400000);
}

function estadoParceria(row: Pick<CarteiraRow, "dias_sem_mov" | "valor_vendido" | "qtd_vendas" | "ativo">): EstadoParceria {
  if (!row.ativo || row.dias_sem_mov >= 180) return "inativo";
  if (row.qtd_vendas === 0 && row.valor_vendido === 0) return "sem_venda";
  if (row.dias_sem_mov <= 60 && row.qtd_vendas > 0) return "parceria_ativa";
  if (row.dias_sem_mov <= 60) return "relacionamento_quente";
  if (row.dias_sem_mov <= 120) return "atencao";
  return "risco";
}

function proximaAcao(row: Pick<CarteiraRow, "estado" | "dias_sem_mov" | "qtd_vendas">) {
  if (row.estado === "inativo") return "Retomar relacionamento";
  if (row.estado === "risco") return "Ligar hoje";
  if (row.estado === "atencao") return "Enviar WhatsApp";
  if (row.estado === "sem_venda") return "Mapear oportunidade";
  if (row.dias_sem_mov > 30) return "Fazer check-in";
  return "Manter relacionamento";
}

function MinhaCarteiraEspecificadores() {
  const qc = useQueryClient();
  const currentUser = useCurrentUser();
  const userId = currentUser.data?.id;
  const { lojaId, vendedorId } = useGlobalFilters();
  const [busca, setBusca] = useState("");

  const profile = useQuery({
    queryKey: ["esp-minha-carteira-profile", userId],
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

  const orcamentos = useQuery({
    queryKey: ["esp-minha-carteira-orcamentos", lojaEfetiva, vendedorEfetivo],
    enabled: !roleVendedor || !!profile.data,
    queryFn: async () => {
      let q = (supabase as any)
        .from("orcamentos")
        .select("especificador_id,data_orcamento,valor_orcado,valor_vendido,status,loja_id,vendedor_id,especificadores(id,nome,telefone,email,profissao,ativo),vendedores(nome),lojas(nome)")
        .not("especificador_id", "is", null)
        .order("data_orcamento", { ascending: false })
        .limit(20000);
      if (lojaEfetiva) q = q.eq("loja_id", lojaEfetiva);
      if (vendedorEfetivo) q = q.eq("vendedor_id", vendedorEfetivo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrcRow[];
    },
  });

  const interacoes = useQuery({
    queryKey: ["esp-minha-carteira-interacoes", lojaEfetiva, vendedorEfetivo],
    enabled: !roleVendedor || !!profile.data,
    queryFn: async () => {
      let q = (supabase as any)
        .from("interacoes")
        .select("especificador_id,data_interacao,tipo,vendedor_id,loja_id")
        .order("data_interacao", { ascending: false })
        .limit(5000);
      if (lojaEfetiva) q = q.eq("loja_id", lojaEfetiva);
      if (vendedorEfetivo) q = q.eq("vendedor_id", vendedorEfetivo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ especificador_id: string; data_interacao: string; tipo: string; vendedor_id: string | null; loja_id: string | null }>;
    },
  });

  const registrarContato = useMutation({
    mutationFn: async (row: CarteiraRow) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("interacoes").insert({
        especificador_id: row.id,
        vendedor_id: row.vendedor_id ?? vendedorEfetivo,
        loja_id: row.loja_id ?? lojaEfetiva,
        owner_id: auth.user?.id ?? null,
        tipo: "whatsapp",
        observacao: "Contato rápido registrado pela Minha Carteira.",
        proxima_acao: row.proxima_acao,
        proxima_data: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["esp-minha-carteira-interacoes"] });
      toast.success("Contato registrado na parceria.");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao registrar contato."),
  });

  const rows = useMemo(() => {
    const lastContact = new Map<string, string>();
    for (const i of interacoes.data ?? []) {
      if (!lastContact.has(i.especificador_id)) lastContact.set(i.especificador_id, i.data_interacao);
    }

    const map = new Map<string, CarteiraRow>();
    for (const o of orcamentos.data ?? []) {
      if (!o.especificador_id || !o.especificadores) continue;
      const cur = map.get(o.especificador_id) ?? {
        id: o.especificador_id,
        nome: o.especificadores.nome,
        telefone: o.especificadores.telefone,
        email: o.especificadores.email,
        profissao: o.especificadores.profissao,
        ativo: o.especificadores.ativo,
        loja_id: o.loja_id,
        loja_nome: o.lojas?.nome ?? "-",
        vendedor_id: o.vendedor_id,
        vendedor_nome: o.vendedores?.nome ?? "-",
        ultimo_orcamento: null,
        ultimo_contato: lastContact.get(o.especificador_id) ?? null,
        qtd_orcamentos: 0,
        qtd_vendas: 0,
        valor_orcado: 0,
        valor_vendido: 0,
        conversao: 0,
        dias_sem_mov: 99999,
        estado: "inativo" as EstadoParceria,
        proxima_acao: "",
      };
      cur.qtd_orcamentos += 1;
      cur.valor_orcado += Number(o.valor_orcado || 0);
      cur.valor_vendido += Number(o.valor_vendido || 0);
      if (Number(o.valor_vendido || 0) > 0 || o.status === "vendido") cur.qtd_vendas += 1;
      if (!cur.ultimo_orcamento || o.data_orcamento > cur.ultimo_orcamento) cur.ultimo_orcamento = o.data_orcamento;
      map.set(o.especificador_id, cur);
    }

    return [...map.values()].map((r) => {
      const dias = daysSince(r.ultimo_orcamento);
      const estado = estadoParceria({ ...r, dias_sem_mov: dias });
      return {
        ...r,
        dias_sem_mov: dias,
        conversao: r.qtd_orcamentos ? r.qtd_vendas / r.qtd_orcamentos : 0,
        estado,
        proxima_acao: proximaAcao({ ...r, estado, dias_sem_mov: dias }),
      };
    }).sort((a, b) => {
      const peso: Record<EstadoParceria, number> = { risco: 0, atencao: 1, inativo: 2, sem_venda: 3, relacionamento_quente: 4, parceria_ativa: 5 };
      return peso[a.estado] - peso[b.estado] || b.valor_vendido - a.valor_vendido;
    });
  }, [orcamentos.data, interacoes.data]);

  const filtered = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      r.nome.toLowerCase().includes(t) ||
      r.vendedor_nome.toLowerCase().includes(t) ||
      r.loja_nome.toLowerCase().includes(t) ||
      (r.profissao ?? "").toLowerCase().includes(t),
    );
  }, [rows, busca]);

  const kpi = useMemo(() => ({
    total: rows.length,
    ativas: rows.filter((r) => r.estado === "parceria_ativa" || r.estado === "relacionamento_quente").length,
    atencao: rows.filter((r) => r.estado === "atencao").length,
    risco: rows.filter((r) => r.estado === "risco" || r.estado === "inativo").length,
    semVenda: rows.filter((r) => r.estado === "sem_venda").length,
    vendido: rows.reduce((s, r) => s + r.valor_vendido, 0),
  }), [rows]);

  const semVinculo = roleVendedor && !vendedorEfetivo;

  return (
    <div>
      <PageHeader
        title="Minha Carteira de Especificadores"
        description="Estado das parcerias, risco de perda e próximos contatos para não deixar relacionamento esfriar."
      />

      {semVinculo && (
        <Card className="mb-4 border-[var(--status-attention)]/30 bg-[var(--status-attention-soft)]">
          <CardContent className="p-4 text-sm">Seu usuário ainda não está vinculado a um vendedor. Peça ao gerente para vincular em Usuários & Perfis.</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Mini label="Carteira" value={kpi.total.toLocaleString("pt-BR")} />
        <Mini label="Ativas" value={kpi.ativas.toLocaleString("pt-BR")} tone="healthy" />
        <Mini label="Atenção" value={kpi.atencao.toLocaleString("pt-BR")} tone="attention" />
        <Mini label="Risco/Inativas" value={kpi.risco.toLocaleString("pt-BR")} tone={kpi.risco > 0 ? "critical" : "healthy"} />
        <Mini label="Sem venda" value={kpi.semVenda.toLocaleString("pt-BR")} tone={kpi.semVenda > 0 ? "attention" : "healthy"} />
        <Mini label="Vendido" value={fmtMoney(kpi.vendido)} tone="healthy" />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <WalletCards className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Parcerias da carteira</div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar especificador, vendedor, loja..." className="h-8 pl-7 w-80" />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Especificador", "Estado", "Última mov.", "Último contato", "Conversão", "Vendido", "Próxima ação", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orcamentos.isLoading || interacoes.isLoading) && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando carteira...</td></tr>}
              {!orcamentos.isLoading && !interacoes.isLoading && filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum especificador encontrado nos filtros atuais.</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <div className="font-medium">{r.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{r.profissao ?? "-"} · {r.vendedor_nome} · {r.loja_nome}</div>
                    {(r.telefone || r.email) && <div className="text-[11px] text-muted-foreground">{r.telefone ?? r.email}</div>}
                  </td>
                  <td className="p-3"><EstadoBadge estado={r.estado} /></td>
                  <td className="p-3">
                    <div>{fmtDate(r.ultimo_orcamento)}</div>
                    <div className="text-[11px] text-muted-foreground">{r.dias_sem_mov >= 99999 ? "-" : `${r.dias_sem_mov} dias sem mov.`}</div>
                  </td>
                  <td className="p-3">{fmtDate(r.ultimo_contato)}</td>
                  <td className="p-3">
                    <div className="tabular-nums">{fmtPct(r.conversao)}</div>
                    <div className="text-[11px] text-muted-foreground">{r.qtd_vendas}/{r.qtd_orcamentos} vendas</div>
                  </td>
                  <td className="p-3 tabular-nums font-medium">{fmtMoney(r.valor_vendido)}</td>
                  <td className="p-3"><Badge variant="secondary">{r.proxima_acao}</Badge></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => registrarContato.mutate(r)} disabled={registrarContato.isPending}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> Contato
                      </Button>
                      <Link to="/orcamentos/controle">
                        <Button size="sm" variant="ghost">Orçamentos</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "healthy" | "attention" | "critical" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", tone && `text-[var(--status-${tone})]`)}>{value}</div>
    </CardContent></Card>
  );
}

function EstadoBadge({ estado }: { estado: EstadoParceria }) {
  const map: Record<EstadoParceria, { label: string; cls: string; icon: any }> = {
    parceria_ativa: { label: "Parceria ativa", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", icon: CheckCircle2 },
    relacionamento_quente: { label: "Quente", cls: "border-primary/30 bg-primary/10 text-primary", icon: UserCheck },
    atencao: { label: "Atenção", cls: "border-[var(--status-attention)]/30 bg-[var(--status-attention-soft)] text-[var(--status-attention)]", icon: AlertTriangle },
    risco: { label: "Risco", cls: "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]", icon: AlertTriangle },
    inativo: { label: "Inativo", cls: "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]", icon: UserX },
    sem_venda: { label: "Sem venda", cls: "border-muted-foreground/20 text-muted-foreground", icon: WalletCards },
  };
  const item = map[estado];
  const Icon = item.icon;
  return <Badge variant="outline" className={cn("gap-1 whitespace-nowrap", item.cls)}><Icon className="h-3 w-3" />{item.label}</Badge>;
}
