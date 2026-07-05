import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, loadOptions } from "@/components/crud-page";
import { supabase } from "@/integrations/supabase/client";

let lojaCanalMap: Record<string, string> | null = null;
async function getLojaCanalMap() {
  if (lojaCanalMap) return lojaCanalMap;
  const { data } = await supabase.from("lojas").select("id, canal");
  lojaCanalMap = Object.fromEntries((data ?? []).map((l: any) => [l.id, l.canal]));
  return lojaCanalMap;
}
// Pré-carrega para o predicate síncrono
getLojaCanalMap();

export const Route = createFileRoute("/_authenticated/cadastros/vendedores")({
  component: () => (
    <CrudPage
      table="vendedores"
      title="Vendedores"
      description="Equipe comercial vinculada às lojas."
      filters={[
        { field: "loja_id", label: "Filtrar por loja", options: () => loadOptions("lojas") },
        {
          field: "canal",
          label: "Canal",
          options: [
            { value: "loja_propria", label: "Própria" },
            { value: "franquia", label: "Franquia" },
          ],
          predicate: (row, value) => (lojaCanalMap?.[row.loja_id] ?? "") === value,
        },
        {
          field: "ativo",
          label: "Status",
          options: [
            { value: "true", label: "Ativos" },
            { value: "false", label: "Inativos" },
          ],
        },
      ]}
      fields={[
        { name: "nome", label: "Nome", type: "text", required: true },
        { name: "matricula", label: "Matrícula", type: "text" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone", type: "text" },
        { name: "loja_id", label: "Loja", type: "select", options: () => loadOptions("lojas") },
        { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
      ]}
    />
  ),
});
