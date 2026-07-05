import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/lib/global-filters";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/data-states";
import { AlertTriangle, RefreshCw, Check, X, Bell, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv-export";

function exportarCSV(rows: Alerta[]) {
  const data = rows.map((a) => ({
    severidade: a.severidade,
    tipo: a.tipo,
    especificador: a.especificadores?.nome ?? "",
    loja: a.lojas?.nome ?? "",
    titulo: a.titulo,
    detalhe: a.detalhe ?? "",
    metrica: a.metrica ?? "",
    periodo_inicio: a.periodo_inicio ?? "",
    periodo_fim: a.periodo_fim ?? "",
    status: a.status,
    criado_em: new Date(a.created_at).toLocaleString("pt-BR"),
  }));
  downloadCSV(`alertas-especificadores-${new Date().toISOString().slice(0, 10)}`, data);
}

export const Route = createFileRoute("/_authenticated/especificadores/alertas")({
  component: AlertasPage,
});

type Alerta = {
  id: string;
  especificador_id: string;
  loja_id: string | null;
  tipo: "baixa_conversao" | "queda_valor" | "inativo" | "troca_vendedor" | "em_risco";
  severidade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "resolvido" | "ignorado";
  titulo: string;
  detalhe: string | null;
  metrica: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  resolved_at: string | null;
  created_at: string;
  especificadores?: { nome: string } | null;
  lojas?: { nome: string } | null;
};

const TIPO_LABEL: Record<Alerta["tipo"], string> = {
  baixa_conversao: "Baixa conversão",
  queda_valor: "Queda de faturamento",
  inativo: "Inatividade",
  troca_vendedor: "Troca de vendedor",
  em_risco: "Em risco",
};

const SEV_CLS: Record<Alerta["severidade"], string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  alta: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critica: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function AlertasPage() {
  const { inicioISO, fimISO, lojaId } = useGlobalFilters();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"aberto" | "resolvido" | "ignorado">("aberto");
  const [tipo, setTipo] = useState<string>("all");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["esp-alertas", status, lojaId],
    queryFn: async () => {
      let q = supabase
        .from("especificadores_alertas")
        .select("*, especificadores(nome), lojas(nome)")
        .eq("status", status)
        .order("severidade", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Alerta[];
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gerar_alertas_especificadores", {
        p_inicio: inicioISO,
        p_fim: fimISO,
        p_loja: lojaId ?? undefined,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} alertas processados`);
      qc.invalidateQueries({ queryKey: ["esp-alertas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar alertas"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, novo }: { id: string; novo: "resolvido" | "ignorado" | "aberto" }) => {
      const patch: any = { status: novo };
      if (novo === "resolvido") patch.resolved_at = new Date().toISOString();
      if (novo === "aberto") patch.resolved_at = null;
      const { error } = await supabase.from("especificadores_alertas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esp-alertas"] }),
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar"),
  });

  const rows = useMemo(() => {
    let r = data ?? [];
    if (tipo !== "all") r = r.filter((a) => a.tipo === tipo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      r = r.filter(
        (a) =>
          (a.especificadores?.nome ?? "").toLowerCase().includes(q) ||
          (a.titulo ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [data, tipo, busca]);

  const counts = useMemo(() => {
    const c = { critica: 0, alta: 0, media: 0, baixa: 0 };
    (data ?? []).forEach((a) => { c[a.severidade]++; });
    return c;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Alertas de Especificadores"
        description="Alertas automáticos de baixa conversão, queda de faturamento, inatividade e troca de vendedor."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>
          <RefreshCw className={cn("h-4 w-4 mr-2", gerar.isPending && "animate-spin")} />
          {gerar.isPending ? "Gerando..." : "Gerar alertas do período"}
        </Button>
        <Button variant="outline" onClick={() => exportarCSV(rows)} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
        <div className="ml-auto flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{counts.critica} críticos</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />{counts.alta} altos</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{counts.media} médios</span>
        </div>
      </div>

      <Card className="p-4 mb-4 flex flex-wrap gap-3 items-center">
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="aberto">Abertos</TabsTrigger>
            <TabsTrigger value="resolvido">Resolvidos</TabsTrigger>
            <TabsTrigger value="ignorado">Ignorados</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar especificador ou título..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Severidade", "Tipo", "Especificador", "Loja", "Detalhe", "Criado em", ""].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState icon={Bell} title="Sem alertas" description="Clique em 'Gerar alertas do período' para varrer a base." />
                </td></tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <Badge className={cn("font-normal border-transparent", SEV_CLS[a.severidade])}>
                      <AlertTriangle className="h-3 w-3 mr-1" />{a.severidade}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">{TIPO_LABEL[a.tipo]}</td>
                  <td className="p-3 font-medium">{a.especificadores?.nome ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{a.lojas?.nome ?? "—"}</td>
                  <td className="p-3">
                    <div className="font-medium">{a.titulo}</div>
                    {a.detalhe && <div className="text-xs text-muted-foreground">{a.detalhe}</div>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {status === "aberto" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: a.id, novo: "resolvido" })}>
                          <Check className="h-4 w-4 mr-1" />Resolver
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: a.id, novo: "ignorado" })}>
                          <X className="h-4 w-4 mr-1" />Ignorar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: a.id, novo: "aberto" })}>
                        Reabrir
                      </Button>
                    )}
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
