import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listUsers, createUser, updateUserRole, updateUserScope, setUserActive, deleteUser, grantSelfAdmin, ROLE_OPTIONS,
} from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsersAdmin,
});

function UsersAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const updRole = useServerFn(updateUserRole);
  const setActive = useServerFn(setUserActive);
  const del = useServerFn(deleteUser);
  const claim = useServerFn(grantSelfAdmin);
  const updScope = useServerFn(updateUserScope);

  const lojas = useQuery({ queryKey: ["scope-lojas"], queryFn: async () => (await supabase.from("lojas").select("id,nome").order("nome")).data ?? [] });
  const regioes = useQuery({ queryKey: ["scope-regioes"], queryFn: async () => (await supabase.from("regioes").select("id,nome").order("nome")).data ?? [] });
  const vendedores = useQuery({ queryKey: ["scope-vendedores"], queryFn: async () => (await supabase.from("vendedores").select("id,nome,loja_id,ativo").order("nome")).data ?? [] });

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => list(), retry: false });
  const [open, setOpen] = useState(false);

  const isForbidden = users.error && String((users.error as Error).message).toLowerCase().includes("acesso negado");

  const createM = useMutation({
    mutationFn: (data: any) => create({ data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setOpen(false); toast.success("Usuário criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const claimM = useMutation({
    mutationFn: () => claim({}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Você agora é administrador. Recarregue se necessário."); },
    onError: (e: any) => toast.error(e.message),
  });

  if (users.isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  if (isForbidden) {
    return (
      <div>
        <PageHeader title="Usuários & Perfis" />
        <div className="rounded-lg border bg-card p-8 text-center max-w-xl mx-auto">
          <ShieldAlert className="h-10 w-10 mx-auto text-primary mb-3" />
          <h2 className="font-semibold">Acesso restrito a administradores</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Se este é o primeiro acesso ao sistema, você pode se tornar o administrador inicial.
            Após isso, somente outros admins poderão promover novos usuários.
          </p>
          <Button onClick={() => claimM.mutate()} disabled={claimM.isPending}>
            {claimM.isPending ? "Promovendo..." : "Tornar-me administrador inicial"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Usuários & Perfis"
        description="Crie acessos, atribua perfis hierárquicos e gerencie status."
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo usuário</Button>}
      />
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((u: any) => {
              const currentRole = u.roles?.[0] ?? "";
              async function saveScope(next: { lojaId?: string | null; regiaoId?: string | null }) {
                await updScope({
                  data: {
                    userId: u.id,
                    lojaId: next.lojaId !== undefined ? next.lojaId : (u.loja_id ?? null),
                    regiaoId: next.regiaoId !== undefined ? next.regiaoId : (u.regiao_id ?? null),
                    vendedorId: u.vendedor_id ?? null,
                  },
                });
                qc.invalidateQueries({ queryKey: ["admin-users"] });
                toast.success("Escopo atualizado");
              }
              async function saveVendedor(vendedorId: string | null) {
                await updScope({
                  data: {
                    userId: u.id,
                    lojaId: u.loja_id ?? null,
                    regiaoId: u.regiao_id ?? null,
                    vendedorId,
                  },
                });
                qc.invalidateQueries({ queryKey: ["admin-users"] });
                toast.success("Escopo atualizado");
              }
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={currentRole}
                      onValueChange={async (role) => {
                        await updRole({ data: { userId: u.id, role: role as any } });
                        qc.invalidateQueries({ queryKey: ["admin-users"] });
                        toast.success("Perfil atualizado");
                      }}
                    >
                      <SelectTrigger className="w-56"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={u.vendedor_id ?? "__none"} onValueChange={(v) => saveVendedor(v === "__none" ? null : v)}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="â€”" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">â€” Nenhum â€”</SelectItem>
                        {(vendedores.data ?? [])
                          .filter((v) => !u.loja_id || !v.loja_id || v.loja_id === u.loja_id)
                          .map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}{v.ativo === false ? " (inativo)" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={u.loja_id ?? "__none"} onValueChange={(v) => saveScope({ lojaId: v === "__none" ? null : v })}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Nenhuma —</SelectItem>
                        {(lojas.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={u.regiao_id ?? "__none"} onValueChange={(v) => saveScope({ regiaoId: v === "__none" ? null : v })}>
                      <SelectTrigger className="w-36"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Nenhuma —</SelectItem>
                        {(regioes.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.ativo}
                      onCheckedChange={async (v) => {
                        await setActive({ data: { userId: u.id, ativo: v } });
                        qc.invalidateQueries({ queryKey: ["admin-users"] });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      onClick={async () => {
                        if (!confirm(`Remover ${u.email}?`)) return;
                        try { await del({ data: { userId: u.id } }); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Removido"); }
                        catch (e: any) { toast.error(e.message); }
                      }}
                    ><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(users.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum usuário ainda.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <NewUserForm onSubmit={(v) => createM.mutate(v)} submitting={createM.isPending} />
        </DialogContent>
      </Dialog>

      {(users.data ?? []).filter((u: any) => u.roles?.includes("admin")).length === 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Ainda não há um administrador. <button onClick={() => claimM.mutate()} className="underline">Tornar-me administrador inicial</button>.
        </p>
      )}
    </div>
  );
}

function NewUserForm({ onSubmit, submitting }: { onSubmit: (v: any) => void; submitting: boolean }) {
  const [v, setV] = useState({ nome: "", email: "", password: "", role: "vendedor" });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}
    >
      <div className="space-y-1.5"><Label>Nome</Label><Input required value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>E-mail</Label><Input required type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label>Senha provisória</Label>
        <Input
          required
          type="text"
          minLength={8}
          pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
          title="Mínimo 8 caracteres, com letra, número e símbolo"
          value={v.password}
          onChange={(e) => setV({ ...v, password: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Mín. 8 caracteres, com letra, número e símbolo. Senhas já vazadas (HIBP) são rejeitadas.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Perfil</Label>
        <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar usuário"}</Button></DialogFooter>
    </form>
  );
}
