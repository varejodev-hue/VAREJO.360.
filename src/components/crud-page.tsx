import { useState, type ReactNode } from "react";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";

export type FieldType = "text" | "email" | "number" | "switch" | "select";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[] | (() => Promise<{ value: string; label: string }[]>);
  defaultValue?: any;
  showInTable?: boolean;
  render?: (value: any, row: any) => ReactNode;
};

export type CrudFilter = {
  field: string;
  label: string;
  options: { value: string; label: string }[] | (() => Promise<{ value: string; label: string }[]>);
  predicate?: (row: any, value: string) => boolean;
};

export function CrudPage({
  table,
  title,
  description,
  fields,
  orderBy = "created_at",
  filters,
}: {
  table: string;
  title: string;
  description?: string;
  fields: Field[];
  orderBy?: string;
  filters?: CrudFilter[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const pageSize = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from(table as any)
          .select("*")
          .order(orderBy, { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }
      return all;
    },
  });

  const filteredData = (list.data ?? []).filter((row) => {
    for (const [field, val] of Object.entries(filterValues)) {
      if (!val || val === "__all__") continue;
      const f = filters?.find((x) => x.field === field);
      if (f?.predicate) {
        if (!f.predicate(row, val)) return false;
        continue;
      }
      const cell = row[field];
      if (String(cell) !== val) return false;
    }
    return true;
  });

  const upsert = useMutation({
    mutationFn: async (values: any) => {
      if (editing?.id) {
        const { error } = await supabase.from(table as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      setOpen(false);
      setEditing(null);
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  function startCreate() { setEditing(null); setOpen(true); }
  function startEdit(row: any) { setEditing(row); setOpen(true); }

  const tableFields = fields.filter((f) => f.showInTable !== false);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        }
      />
      {filters && filters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          {filters.map((f) => (
            <FilterSelect
              key={f.field}
              filter={f}
              value={filterValues[f.field] ?? "__all__"}
              onChange={(v: string) => setFilterValues((s) => ({ ...s, [f.field]: v }))}
            />
          ))}
          {Object.values(filterValues).some((v) => v && v !== "__all__") && (
            <Button variant="ghost" size="sm" onClick={() => setFilterValues({})}>Limpar filtros</Button>
          )}
        </div>
      )}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {tableFields.map((f) => <TableHead key={f.name}>{f.label}</TableHead>)}
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={tableFields.length + 1} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!list.isLoading && filteredData.length === 0 && (
              <TableRow><TableCell colSpan={tableFields.length + 1} className="text-center py-10 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            )}
            {filteredData.map((row) => (
              <TableRow key={row.id}>
                {tableFields.map((f) => (
                  <TableCell key={f.name}>{renderCell(f, row[f.name], row)}</TableCell>
                ))}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover este registro?")) del.mutate(row.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>


      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} — {title}</DialogTitle></DialogHeader>
          <CrudForm
            key={editing?.id ?? "new"}
            fields={fields}
            initial={editing}
            draftKey={editing ? null : `crud:${table}:new`}
            onSubmit={(v) => upsert.mutate(v)}
            submitting={upsert.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderCell(f: Field, value: any, row: any): ReactNode {
  if (f.render) return f.render(value, row);
  if (f.type === "switch") return value ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>;
  if (f.type === "select" && Array.isArray(f.options)) {
    const opt = f.options.find((o) => o.value === value);
    return opt?.label ?? value ?? "—";
  }
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  return String(value);
}

function CrudForm({
  fields, initial, onSubmit, submitting, draftKey,
}: { fields: Field[]; initial: any | null; onSubmit: (v: any) => void; submitting: boolean; draftKey: string | null }) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const base: any = {};
    for (const f of fields) base[f.name] = initial?.[f.name] ?? f.defaultValue ?? (f.type === "switch" ? true : "");
    return base;
  });

  const { restored, clearDraft } = useFormDraft(draftKey, values, setValues);

  function set(name: string, v: any) { setValues((s) => ({ ...s, [name]: v })); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {};
    for (const f of fields) {
      let v = values[f.name];
      if (v === "") v = null;
      if (f.type === "number" && v !== null && v !== undefined) v = Number(v);
      payload[f.name] = v;
    }
    onSubmit(payload);
    clearDraft();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {restored && (
        <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span>Rascunho restaurado automaticamente.</span>
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => {
              clearDraft();
              const base: any = {};
              for (const f of fields) base[f.name] = initial?.[f.name] ?? f.defaultValue ?? (f.type === "switch" ? true : "");
              setValues(base);
            }}
          >
            Descartar
          </button>
        </div>
      )}
      {fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
          <FieldInput field={f} value={values[f.name]} onChange={(v) => set(f.name, v)} />
        </div>
      ))}
      <DialogFooter className="pt-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const opts = useQuery({
    queryKey: ["fieldopts", field.name],
    queryFn: async () => (typeof field.options === "function" ? await field.options() : field.options ?? []),
    enabled: field.type === "select",
  });

  if (field.type === "switch") {
    return <Switch checked={!!value} onCheckedChange={onChange} />;
  }
  if (field.type === "select") {
    return (
      <Select value={value ?? ""} onValueChange={(v) => onChange(v === "__null__" ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          {!field.required && <SelectItem value="__null__">— vazio —</SelectItem>}
          {(opts.data ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={field.name}
      type={field.type === "number" ? "number" : field.type}
      required={field.required}
      step={field.type === "number" ? "any" : undefined}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FilterSelect({ filter, value, onChange }: { filter: CrudFilter; value: string; onChange: (v: string) => void }) {
  const opts = useQuery({
    queryKey: ["crud-filter", filter.field],
    queryFn: async () => (typeof filter.options === "function" ? await filter.options() : filter.options ?? []),
  });
  return (
    <div className="space-y-1.5 min-w-[200px]">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {(opts.data ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export async function loadOptions(table: string, labelField = "nome", valueField = "id") {
  const { data } = await supabase.from(table as any).select(`${valueField}, ${labelField}`).order(labelField);
  return (data ?? []).map((r: any) => ({ value: r[valueField], label: r[labelField] }));
}
