import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, DoorOpen, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProfileFila = {
  id: string;
  nome: string;
  loja_id: string | null;
  vendedor_id: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function QueueEntryBanner() {
  const qc = useQueryClient();
  const currentUser = useCurrentUser();
  const userId = currentUser.data?.id;
  const hoje = useMemo(() => todayISO(), []);

  const perfil = useQuery({
    queryKey: ["fila-login-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: profile, error: pError }, { data: roles, error: rError }] = await Promise.all([
        (supabase as any).from("profiles").select("id,nome,loja_id,vendedor_id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      if (pError) throw pError;
      if (rError) throw rError;
      return { profile: profile as ProfileFila | null, roles: (roles ?? []).map((r) => r.role as string) };
    },
    staleTime: 60_000,
  });

  const isVendedor = perfil.data?.roles.includes("vendedor");
  const profile = perfil.data?.profile;

  const statusFila = useQuery({
    queryKey: ["fila-login-status", profile?.loja_id, profile?.vendedor_id, hoje],
    enabled: !!profile?.loja_id && !!profile?.vendedor_id && !!isVendedor,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operacao_fila_consultores")
        .select("id,status,ordem")
        .eq("loja_id", profile!.loja_id)
        .eq("vendedor_id", profile!.vendedor_id)
        .eq("data_operacao", hoje)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: string; ordem: number } | null;
    },
    staleTime: 30_000,
  });

  const entrarFila = useMutation({
    mutationFn: async () => {
      if (!profile?.loja_id || !profile?.vendedor_id) throw new Error("Vincule loja e vendedor ao seu usuário para entrar na fila.");
      const { data: filaDia, error: filaError } = await (supabase as any)
        .from("operacao_fila_dias")
        .upsert({ loja_id: profile.loja_id, data_operacao: hoje, status: "aberta", criado_por: userId }, { onConflict: "loja_id,data_operacao" })
        .select("id")
        .single();
      if (filaError) throw filaError;

      const { data: atual, error: maxError } = await (supabase as any)
        .from("operacao_fila_consultores")
        .select("ordem")
        .eq("loja_id", profile.loja_id)
        .eq("data_operacao", hoje)
        .order("ordem", { ascending: false })
        .limit(1);
      if (maxError) throw maxError;
      const proximaOrdem = Number(atual?.[0]?.ordem ?? 0) + 1;

      const { error } = await (supabase as any)
        .from("operacao_fila_consultores")
        .upsert({
          fila_dia_id: filaDia.id,
          loja_id: profile.loja_id,
          vendedor_id: profile.vendedor_id,
          data_operacao: hoje,
          ordem: proximaOrdem,
          status: "disponivel",
        }, { onConflict: "loja_id,data_operacao,vendedor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fila-login-status"] });
      toast.success("Você entrou na fila de atendimento de hoje.");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível entrar na fila."),
  });

  if (!isVendedor || perfil.isLoading) return null;

  const semVinculo = !profile?.loja_id || !profile?.vendedor_id;
  const jaEntrou = !!statusFila.data;

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
      jaEntrou ? "border-emerald-500/25 bg-emerald-500/5" : "border-primary/25 bg-primary/5",
    )}>
      <div className="flex items-start gap-3 min-w-0">
        <div className={cn(
          "mt-0.5 h-9 w-9 rounded-md flex items-center justify-center shrink-0",
          jaEntrou ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/15 text-primary",
        )}>
          {jaEntrou ? <CheckCircle2 className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {jaEntrou ? "Você já está na fila de atendimento" : "Vai entrar na fila de atendimento hoje?"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {semVinculo
              ? "Seu acesso ainda precisa estar vinculado a uma loja e a um cadastro de vendedor."
              : jaEntrou
                ? `Posição atual: ${statusFila.data?.ordem ?? "-"} · status ${statusFila.data?.status ?? "disponivel"}.`
                : "Ao entrar, o sistema acompanha a ordem da vez e aplica a regra de prioridade automaticamente."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {jaEntrou && <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Fila ativa</Badge>}
        {semVinculo ? (
          <Link to="/admin/usuarios"><Button size="sm" variant="outline">Vincular usuário</Button></Link>
        ) : jaEntrou ? (
          <Link to="/operacao/atendimento-da-vez"><Button size="sm" variant="outline">Ver fila</Button></Link>
        ) : (
          <Button size="sm" onClick={() => entrarFila.mutate()} disabled={entrarFila.isPending}>
            {entrarFila.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Entrar na fila
          </Button>
        )}
      </div>
    </div>
  );
}
