import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tourPorPerfil, RESPONSABILIDADES, ROLE_LABEL, type TourStep } from "@/lib/help-content";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export function OnboardingModal() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [passo, setPasso] = useState(0);

  function localKey(id: string) {
    return `v360:onboarding:${id}`;
  }

  function localDone(id: string) {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(localKey(id)) === "done";
  }

  function markLocalDone(id: string | null | undefined) {
    if (!id || typeof window === "undefined") return;
    window.localStorage.setItem(localKey(id), "done");
  }

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: role } = useQuery({
    enabled: !!userId,
    queryKey: ["me-role", userId],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId!).maybeSingle();
      return data?.role ?? null;
    },
  });

  const { data: status } = useQuery({
    enabled: !!userId,
    queryKey: ["onboarding", userId],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_status").select("*").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    if (localDone(userId)) return;
    if (status === undefined) return; // ainda carregando
    const precisa = status === null || (!status.concluido && !status.dispensado);
    if (precisa) {
      setOpen(true);
      setPasso(status?.passo ?? 0);
    }
  }, [userId, status]);

  const upsert = useMutation({
    mutationFn: async (patch: { passo?: number; concluido?: boolean; dispensado?: boolean }) => {
      if (!userId) return;
      const { error } = await supabase.from("onboarding_status").upsert({
        user_id: userId,
        passo: patch.passo ?? status?.passo ?? 0,
        concluido: patch.concluido ?? status?.concluido ?? false,
        dispensado: patch.dispensado ?? status?.dispensado ?? false,
        concluido_em: patch.concluido ? new Date().toISOString() : status?.concluido_em ?? null,
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", userId] }),
  });

  const steps: TourStep[] = tourPorPerfil(role);
  const resp = RESPONSABILIDADES[role ?? "vendedor"] ?? RESPONSABILIDADES.vendedor;
  const total = steps.length + 1; // +1 do passo de boas-vindas

  function avancar() {
    const p = passo + 1;
    if (p >= total) {
      markLocalDone(userId);
      upsert.mutate({ passo: p, concluido: true });
      setOpen(false);
    } else {
      setPasso(p);
      upsert.mutate({ passo: p });
    }
  }

  function dispensar() {
    markLocalDone(userId);
    upsert.mutate({ dispensado: true });
    setOpen(false);
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dispensar()}>
      <DialogContent className="max-w-xl">
        {passo === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />Bem-vindo ao Varejo 360
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                Seu perfil: <Badge variant="secondary">{ROLE_LABEL[role ?? ""] ?? "Usuário"}</Badge>
              </p>
              <p className="text-muted-foreground">{resp.resumo}</p>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Suas telas-chave</div>
                <div className="flex flex-wrap gap-1.5">
                  {resp.foco.map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Indicadores que você acompanha</div>
                <ul className="list-disc pl-5 space-y-0.5">{resp.indicadores.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
              <p className="text-xs text-muted-foreground pt-2">Vou te mostrar agora as {steps.length} telas mais importantes da sua rotina.</p>
            </div>
          </>
        ) : (
          <Tour step={steps[passo - 1]} index={passo} total={total - 1} />
        )}
        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Passo {passo + 1} de {total}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={dispensar}>Pular</Button>
            <Button onClick={avancar}>
              {passo + 1 >= total ? <><CheckCircle2 className="h-4 w-4 mr-1" />Concluir</> : <>Próximo<ArrowRight className="h-4 w-4 ml-1" /></>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tour({ step, index, total }: { step: TourStep; index: number; total: number }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{index}/{total} · {step.titulo}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <p>{step.descricao}</p>
        <Link to={step.link} className="inline-flex items-center gap-1 text-primary underline">
          Abrir {step.titulo} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </>
  );
}
