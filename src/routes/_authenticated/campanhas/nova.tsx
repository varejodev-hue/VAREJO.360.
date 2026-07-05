import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/campanhas/nova")({
  component: NovaCampanha,
});

type ParsedRow = { codigo_produto: string; preco_promocional: number | null; desconto_pct: number | null };

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  // detect delimiter
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  const idxCodigo = headers.findIndex((h) => h.startsWith("cod"));
  const idxPreco = headers.findIndex((h) => h.includes("preco") || h.includes("preço"));
  const idxDesc = headers.findIndex((h) => h.includes("desc"));
  if (idxCodigo === -1) throw new Error("Coluna 'codigo' não encontrada no CSV.");
  return lines.slice(1).map((line) => {
    const cols = line.split(delim).map((c) => c.trim());
    const codigo = cols[idxCodigo];
    const precoRaw = idxPreco >= 0 ? cols[idxPreco]?.replace(",", ".") : "";
    const descRaw = idxDesc >= 0 ? cols[idxDesc]?.replace(",", ".") : "";
    return {
      codigo_produto: codigo,
      preco_promocional: precoRaw ? Number(precoRaw) : null,
      desconto_pct: descRaw ? Number(descRaw) : null,
    };
  }).filter((r) => r.codigo_produto);
}

function NovaCampanha() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState("");
  const [itens, setItens] = useState<ParsedRow[]>([]);
  const [csvName, setCsvName] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result || ""));
        setItens(rows);
        toast.success(`${rows.length} itens carregados.`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    };
    reader.readAsText(file);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome é obrigatório.");
      if (!dataFim) throw new Error("Data fim é obrigatória.");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: camp, error } = await supabase
        .from("campanhas")
        .insert({
          nome,
          descricao: descricao || null,
          data_inicio: dataInicio,
          data_fim: dataFim,
          status: "ativa",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (itens.length) {
        const payload = itens.map((i) => ({
          campanha_id: camp.id,
          codigo_produto: i.codigo_produto,
          preco_promocional: i.preco_promocional,
          desconto_pct: i.desconto_pct,
        }));
        const { error: e2 } = await supabase.from("campanha_itens").insert(payload);
        if (e2) throw e2;
        await supabase.rpc("recalcular_oportunidades_campanha", { _campanha_id: camp.id });
      }
      return camp.id as string;
    },
    onSuccess: (id) => {
      toast.success("Campanha criada e oportunidades calculadas.");
      navigate({ to: "/campanhas/$id", params: { id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nova campanha"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/campanhas" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Campanha Outubro 2026" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="di">Início</Label>
              <Input id="di" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="df">Fim</Label>
              <Input id="df" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Itens promocionais (CSV)</Label>
            <p className="text-xs text-muted-foreground">
              Colunas: <code>codigo;preco_promocional;desconto_pct</code> — informe preço OU desconto.
            </p>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1" /> Selecionar CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                </label>
              </Button>
              {csvName && (
                <span className="text-xs text-muted-foreground">
                  {csvName} — <strong>{itens.length}</strong> itens
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/campanhas" })}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Salvando…" : "Criar campanha"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
