import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Store, Users, GraduationCap, FileSpreadsheet, Upload,
  ArrowRightLeft, Building2, MapPin, Package, Sparkles, ShieldCheck,
  Wallet, Activity, Target, AlertTriangle, UserCheck, UserX, RefreshCw,
  Trophy, BarChart3, Database, History, ClipboardList, CheckSquare, Wrench,
  CalendarDays, CalendarRange,
} from "lucide-react";
import { AiChatDrawer } from "./ai-chat-drawer";

type NavCmd = { label: string; to: string; icon: React.ComponentType<{ className?: string }>; group: string };

const COMMANDS: NavCmd[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, group: "Navegar" },

  { label: "Alertas Operacionais", to: "/operacao/alertas", icon: AlertTriangle, group: "Operacao da Loja" },
  { label: "Calendario da Loja", to: "/operacao/calendario", icon: CalendarDays, group: "Operacao da Loja" },
  { label: "Planejamento do Gerente", to: "/operacao/planejamento", icon: CalendarRange, group: "Operacao da Loja" },
  { label: "Atendimento da Vez", to: "/operacao/atendimento-da-vez", icon: ClipboardList, group: "Operacao da Loja" },
  { label: "Rotina da Loja", to: "/operacao/rotina", icon: CheckSquare, group: "Operacao da Loja" },
  { label: "Amostras", to: "/operacao/amostras", icon: Package, group: "Operacao da Loja" },
  { label: "Materiais e Compras", to: "/operacao/materiais", icon: Package, group: "Operacao da Loja" },
  { label: "Manutencao Preventiva", to: "/operacao/manutencao", icon: Wrench, group: "Operacao da Loja" },

  { label: "Controle do Vendedor", to: "/orcamentos/controle", icon: Wallet, group: "Orçamentos" },
  { label: "Carteira de Orçamentos", to: "/orcamentos/carteira", icon: Wallet, group: "Orçamentos" },
  { label: "Follow-up", to: "/orcamentos/follow-up", icon: Activity, group: "Orçamentos" },
  { label: "Funil de Conversão", to: "/orcamentos/conversao", icon: Target, group: "Orçamentos" },
  { label: "Orçamentos Perdidos", to: "/orcamentos/perdidos", icon: AlertTriangle, group: "Orçamentos" },

  { label: "Minha Carteira de Especificadores", to: "/especificadores/minha-carteira", icon: Wallet, group: "Especificadores" },
  { label: "Especificadores Ativos", to: "/especificadores/ativos", icon: UserCheck, group: "Especificadores" },
  { label: "Em Risco", to: "/especificadores/em-risco", icon: AlertTriangle, group: "Especificadores" },
  { label: "Inativos", to: "/especificadores/inativos", icon: UserX, group: "Especificadores" },
  { label: "Recuperados", to: "/especificadores/recuperados", icon: RefreshCw, group: "Especificadores" },
  { label: "Transferência de Carteira", to: "/especificadores/transferencias", icon: ArrowRightLeft, group: "Especificadores" },
  { label: "Rastreabilidade", to: "/especificadores/rastreabilidade", icon: Building2, group: "Especificadores" },

  { label: "Performance — Lojas", to: "/performance/lojas", icon: Store, group: "Performance" },
  { label: "Saude da Loja", to: "/performance/saude-lojas", icon: Activity, group: "Performance" },
  { label: "Plano de Acao", to: "/performance/plano-acao", icon: CheckSquare, group: "Performance" },
  { label: "Gap por Loja", to: "/performance/gap-lojas", icon: Target, group: "Performance" },
  { label: "Metas Vendedores", to: "/performance/metas-vendedores", icon: Users, group: "Performance" },
  { label: "Planejamento Executivo", to: "/performance/planejamento-executivo", icon: CalendarRange, group: "Performance" },
  { label: "Performance — Vendedores", to: "/performance/vendedores", icon: Users, group: "Performance" },
  { label: "Ranking", to: "/performance/ranking", icon: Trophy, group: "Performance" },
  { label: "Comparativos", to: "/performance/comparativos", icon: BarChart3, group: "Performance" },

  { label: "Importar Orçamentos", to: "/importacao/orcamentos", icon: Upload, group: "Importação" },
  { label: "Importar Vendas", to: "/importacao/vendas", icon: Database, group: "Importação" },
  { label: "Importar AR Pago", to: "/importacao/ar", icon: Upload, group: "Importação" },
  { label: "Histórico de Importações", to: "/importacao/historico", icon: History, group: "Importação" },

  { label: "Lojas", to: "/cadastros/lojas", icon: Store, group: "Cadastros" },
  { label: "Regiões", to: "/cadastros/regioes", icon: MapPin, group: "Cadastros" },
  { label: "Vendedores", to: "/cadastros/vendedores", icon: Users, group: "Cadastros" },
  { label: "Especificadores", to: "/cadastros/especificadores", icon: GraduationCap, group: "Cadastros" },
  { label: "Clientes", to: "/cadastros/clientes", icon: Users, group: "Cadastros" },
  { label: "Produtos", to: "/cadastros/produtos", icon: Package, group: "Cadastros" },
  { label: "Permissoes SGP", to: "/admin/permissoes-sgp", icon: ShieldCheck, group: "Administracao" },
  { label: "7 Fases SGP", to: "/admin/fases-sgp", icon: CheckSquare, group: "Administracao" },
  { label: "Parametrizacao Filial", to: "/admin/parametrizacao-filial", icon: ShieldCheck, group: "Administracao" },
  { label: "Auditoria", to: "/admin/auditoria", icon: History, group: "Administracao" },
  { label: "Usuários & Perfis", to: "/admin/usuarios", icon: ShieldCheck, group: "Administração" },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const groups = COMMANDS.reduce<Record<string, NavCmd[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput placeholder="Buscar páginas, ações ou perguntar à IA…" />
        <CommandList>
          <CommandEmpty>Nenhum resultado.</CommandEmpty>
          <CommandGroup heading="Assistente">
            <CommandItem
              onSelect={() => { onOpenChange(false); setChatOpen(true); }}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Abrir Chat de Performance</span>
              <CommandShortcut>IA</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          {Object.entries(groups).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((it) => {
                const Icon = it.icon;
                return (
                  <CommandItem
                    key={it.to}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate({ to: it.to });
                    }}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{it.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
      <AiChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
