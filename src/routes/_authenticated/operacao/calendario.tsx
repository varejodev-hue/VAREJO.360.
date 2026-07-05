import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarRange, CheckSquare, Clock, ShoppingCart, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacao/calendario")({
  component: CalendarioOperacional,
});

type Evento = {
  id: string;
  data: string;
  titulo: string;
  detalhe: string;
  tipo: "manutencao" | "rotina" | "compra" | "followup" | "planejamento";
  status: "vencido" | "hoje" | "futuro";
  to: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function CalendarioOperacional() {
  const { lojaId, vendedorId } = useGlobalFilters();

  const eventos = useQuery({
    queryKey: ["operacao-calendario", lojaId, vendedorId],
    queryFn: async () => {
      const hoje = todayISO();
      const fim = addDays(30);
      const db = supabase as any;

      const [manutencoes, rotinas, compras, planejamentos, tasks] = await Promise.all([
        (() => {
          let q = db.from("operacao_manutencoes_preventivas").select("*").not("proxima_execucao", "is", null).lte("proxima_execucao", fim).order("proxima_execucao");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_rotinas").select("*").not("prazo", "is", null).neq("status", "concluido").lte("prazo", fim).order("prazo");
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_compras").select("*").neq("status", "encerrado").order("created_at", { ascending: false }).limit(80);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = db.from("operacao_planejamentos").select("*").neq("status", "concluido").neq("status", "cancelado").lte("periodo_inicio", fim).order("periodo_inicio").limit(80);
          if (lojaId) q = q.eq("loja_id", lojaId);
          return q;
        })(),
        (() => {
          let q = supabase.from("tasks").select("*").eq("status", "pendente").lte("due_at", `${fim}T23:59:59`).order("due_at").limit(120);
          if (lojaId) q = q.eq("loja_id", lojaId);
          if (vendedorId) q = q.eq("vendedor_id", vendedorId);
          return q;
        })(),
      ]);

      const errors = [manutencoes, rotinas, compras, planejamentos, tasks].map((r: any) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];

      const rows: Evento[] = [];
      const status = (data: string): Evento["status"] => data < hoje ? "vencido" : data === hoje ? "hoje" : "futuro";

      for (const m of manutencoes.data ?? []) {
        rows.push({
          id: `man-${m.id}`,
          data: m.proxima_execucao,
          titulo: m.item,
          detalhe: `${m.categoria ?? "Manutenção"} · ${m.fornecedor ?? "fornecedor a definir"}`,
          tipo: "manutencao",
          status: status(m.proxima_execucao),
          to: "/operacao/manutencao",
        });
      }

      for (const r of rotinas.data ?? []) {
        rows.push({
          id: `rot-${r.id}`,
          data: r.prazo,
          titulo: r.titulo,
          detalhe: `${r.responsavel_perfil ?? "perfil"} · prioridade ${r.prioridade}`,
          tipo: "rotina",
          status: status(r.prazo),
          to: "/operacao/rotina",
        });
      }

      for (const c of compras.data ?? []) {
        const data = c.updated_at?.slice(0, 10) ?? c.created_at?.slice(0, 10) ?? hoje;
        rows.push({
          id: `comp-${c.id}`,
          data,
          titulo: c.material,
          detalhe: `Compra · ${c.etapa_atual}`,
          tipo: "compra",
          status: status(data),
          to: "/operacao/materiais",
        });
      }

      for (const p of planejamentos.data ?? []) {
        const data = p.periodo_inicio ?? p.periodo_fim ?? hoje;
        rows.push({
          id: `plan-${p.id}`,
          data,
          titulo: p.titulo,
          detalhe: `Planejamento ${p.tipo} - fecha em ${p.periodo_fim}`,
          tipo: "planejamento",
          status: status(data),
          to: "/operacao/planejamento",
        });
      }

      for (const t of tasks.data ?? []) {
        const data = t.due_at.slice(0, 10);
        rows.push({
          id: `task-${t.id}`,
          data,
          titulo: t.titulo,
          detalhe: `Follow-up · ${t.tipo}`,
          tipo: "followup",
          status: status(data),
          to: "/meu-dia",
        });
      }

      return rows.sort((a, b) => a.data.localeCompare(b.data));
    },
  });

  const grouped = (eventos.data ?? []).reduce((map, e) => {
    (map[e.data] ??= []).push(e);
    return map;
  }, {} as Record<string, Evento[]>);

  const dias = Object.entries(grouped);

  return (
    <div>
      <PageHeader
        title="Calendário da Loja"
        description="Agenda operacional dos próximos 30 dias: manutenção, rotina, compras e follow-ups."
      />

      <Card>
        <CardContent className="p-0">
          {eventos.isLoading && <div className="p-8 text-center text-muted-foreground">Carregando calendário...</div>}
          {!eventos.isLoading && dias.length === 0 && (
            <div className="p-8 text-center">
              <CalendarDays className="h-9 w-9 mx-auto text-primary mb-2" />
              <div className="text-sm font-medium">Sem eventos nos próximos 30 dias</div>
              <div className="text-xs text-muted-foreground mt-1">Cadastre rotinas, preventivas ou follow-ups para alimentar o calendário.</div>
            </div>
          )}
          <div className="divide-y">
            {dias.map(([dia, items]) => (
              <div key={dia} className="grid md:grid-cols-[150px_1fr] gap-0">
                <div className={cn("p-4 border-r bg-muted/30", dia === todayISO() && "bg-primary/5")}>
                  <div className="text-sm font-semibold capitalize">{fmtDay(dia)}</div>
                  <div className="text-xs text-muted-foreground">{items.length} item(ns)</div>
                </div>
                <div className="divide-y">
                  {items.map((e) => (
                    <div key={e.id} className="p-4 flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", iconBg(e.status))}>
                        <TipoIcon tipo={e.tipo} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.titulo}</div>
                        <div className="text-xs text-muted-foreground truncate">{e.detalhe}</div>
                      </div>
                      <Badge variant="outline" className={cn("capitalize", badgeCls(e.status))}>{e.status}</Badge>
                      <Link to={e.to as any}><Button size="sm" variant="ghost">Abrir</Button></Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TipoIcon({ tipo }: { tipo: Evento["tipo"] }) {
  const cls = "h-4 w-4";
  if (tipo === "manutencao") return <Wrench className={cls} />;
  if (tipo === "rotina") return <CheckSquare className={cls} />;
  if (tipo === "compra") return <ShoppingCart className={cls} />;
  if (tipo === "planejamento") return <CalendarRange className={cls} />;
  return <Clock className={cls} />;
}

function iconBg(status: Evento["status"]) {
  if (status === "vencido") return "bg-[var(--status-critical-soft)] text-[var(--status-critical)]";
  if (status === "hoje") return "bg-[var(--status-attention-soft)] text-[var(--status-attention)]";
  return "bg-primary/10 text-primary";
}

function badgeCls(status: Evento["status"]) {
  if (status === "vencido") return "border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] text-[var(--status-critical)]";
  if (status === "hoje") return "border-[var(--status-attention)]/30 bg-[var(--status-attention-soft)] text-[var(--status-attention)]";
  return "border-primary/30 bg-primary/10 text-primary";
}
