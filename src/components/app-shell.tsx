import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  Upload,
  UserMinus,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/lib/global-filters";
import { getLastModuleTab } from "@/components/module-tabs";
import { CommandPalette } from "@/components/command-palette";
import { AiChatDrawer } from "@/components/ai-chat-drawer";
import { OnboardingModal } from "@/components/onboarding-modal";
import { QueueEntryBanner } from "@/components/queue-entry-banner";
import { HelpTip } from "@/components/help-tip";
import { GlobalFilters } from "@/components/global-filters";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: string[];
  adminOnly?: boolean;
  moduleKey?: string;
};

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Visao geral",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/meu-dia", label: "Meu Dia", icon: Sun },
    ],
  },
  {
    label: "Operacao da loja",
    items: [
      { to: "/operacao/atendimento-da-vez", label: "Operacao", icon: ClipboardList, match: ["/operacao"], moduleKey: "operacao" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/orcamentos/carteira", label: "Orcamentos", icon: FileSpreadsheet, match: ["/orcamentos"], moduleKey: "orcamentos" },
      { to: "/performance", label: "Performance", icon: TrendingUp, moduleKey: "performance" },
      { to: "/campanhas", label: "Campanhas", icon: Megaphone, moduleKey: "campanhas" },
    ],
  },
  {
    label: "Relacionamento",
    items: [
      { to: "/especificadores/ativos", label: "Especificadores", icon: GraduationCap, match: ["/especificadores"], moduleKey: "especificadores" },
      { to: "/carteira/visao-geral", label: "Carteira", icon: Wallet, match: ["/carteira"], moduleKey: "carteira" },
      { to: "/turnover/visao-geral", label: "Turnover", icon: UserMinus, match: ["/turnover"], moduleKey: "turnover" },
      { to: "/relacionamento", label: "Relacionamento", icon: Heart, match: ["/relacionamento"], moduleKey: "relacionamento" },
    ],
  },
  {
    label: "Inteligencia",
    items: [
      { to: "/inteligencia/mix", label: "Inteligencia IA", icon: Sparkles, match: ["/inteligencia"], moduleKey: "inteligencia" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/importacao", label: "Importacao", icon: Upload, match: ["/importacao"] },
      { to: "/admin", label: "Administracao", icon: Settings, match: ["/admin", "/cadastros"], adminOnly: true },
      { to: "/ajuda", label: "Ajuda", icon: HelpCircle },
    ],
  },
];

const COLLAPSED_KEY = "sv:sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useGlobalFilters();
  useInactivityLogout();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== "undefined") window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  }

  const lastImport = useQuery({
    queryKey: ["topbar-last-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("created_at,total_sucesso,total_erro")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  const notif = useQuery({
    queryKey: ["sidebar-notifs"],
    queryFn: async () => {
      const isoCrit = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const [tasks, criticos] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "pendente").lt("due_at", new Date().toISOString()),
        supabase.from("orcamentos").select("*", { count: "exact", head: true }).eq("status", "orcado").lte("data_orcamento", isoCrit),
      ]);
      return { tasksVencidas: tasks.count ?? 0, criticos: criticos.count ?? 0 };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    placeholderData: (prev) => prev,
  });

  const currentUser = useCurrentUser();
  const userId = currentUser.data?.id;

  const novidadesNaoLidas = useQuery({
    queryKey: ["novidades-nao-lidas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [all, lidas] = await Promise.all([
        supabase.from("novidades").select("id", { count: "exact", head: true }),
        supabase.from("novidades_leituras").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      ]);
      return Math.max(0, (all.count ?? 0) - (lidas.count ?? 0));
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    placeholderData: (prev) => prev,
  });

  const isAdmin = useQuery({
    queryKey: ["is-admin-area", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [admin, gerente, headPropria, headFranquia, performance] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId!, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId!, _role: "gerente_loja" }),
        supabase.rpc("has_role", { _user_id: userId!, _role: "head_nacional_loja_propria" }),
        supabase.rpc("has_role", { _user_id: userId!, _role: "head_nacional_franquia" }),
        supabase.rpc("has_role", { _user_id: userId!, _role: "gerente_performance" }),
      ]);
      return Boolean(admin.data || gerente.data || headPropria.data || headFranquia.data || performance.data);
    },
    staleTime: 5 * 60_000,
  });

  const badgeByPath: Record<string, number> = {
    "/meu-dia": notif.data?.tasksVencidas ?? 0,
    "/orcamentos/carteira": notif.data?.criticos ?? 0,
    "/ajuda": novidadesNaoLidas.data ?? 0,
  };

  useEffect(() => {
    setEmail(currentUser.data?.email ?? "");
  }, [currentUser.data?.email]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para conteudo
      </a>

      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        className={cn(
          "shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-200 shadow-[1px_0_18px_rgba(15,23,42,0.04)]",
          collapsed ? "md:w-[68px]" : "md:w-64",
          "fixed inset-y-0 left-0 z-50 w-72 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="h-16 flex items-center gap-2.5 px-3 border-b border-sidebar-border">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold text-[11px] tracking-tight shadow-sm">
            V360
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight text-sm truncate">Varejo 360</div>
              <div className="text-[10px] text-sidebar-foreground/55 uppercase tracking-wide truncate">Inteligencia Comercial</div>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-sidebar-accent/80"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-2.5 pt-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg border border-sidebar-border bg-background/75 px-2.5 py-2 text-xs text-sidebar-foreground/70 shadow-sm hover:border-sidebar-ring/35 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground transition-colors",
              collapsed && "justify-center",
            )}
            title="Buscar (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Buscar</span>
                <kbd className="hidden md:inline-flex h-4 items-center rounded border border-sidebar-border bg-sidebar px-1 text-[9px] font-mono">Ctrl K</kbd>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4">
          {navGroups.map((group) => {
            const items = group.items.filter((i) => !i.adminOnly || isAdmin.data);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="space-y-1">
                {!collapsed && (
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                    {group.label}
                  </div>
                )}
                {collapsed && <div className="mx-2 my-1 h-px bg-sidebar-border" />}
                {items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.to ||
                    pathname.startsWith(item.to + "/") ||
                    (item.match?.some((m) => pathname === m || pathname.startsWith(m + "/")) ?? false);
                  const badge = badgeByPath[item.to] ?? 0;
                  const target = !active && item.moduleKey ? (getLastModuleTab(item.moduleKey) ?? item.to) : item.to;
                  return (
                    <Link
                      key={item.to}
                      to={target}
                      preload="intent"
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm ring-1 ring-sidebar-border"
                          : "text-sidebar-foreground/78 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      <NotifBadge count={badge} collapsed={collapsed} />
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2.5 space-y-1.5">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold ring-2 ring-sidebar-border"
                title={email}
              >
                {(email || "?").slice(0, 1).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                title="Sair"
                aria-label="Sair"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-sidebar-border bg-background/70 p-2 flex items-center gap-2.5 shadow-sm">
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold ring-2 ring-sidebar-border">
                {(email || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate text-sidebar-foreground" title={email}>{email || "-"}</div>
                <div className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-healthy)]" />
                  Conectado
                </div>
              </div>
              <button
                onClick={signOut}
                title="Sair"
                aria-label="Sair"
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            className="w-full hidden md:flex items-center justify-center gap-2 rounded-md py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground transition-colors"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /><span>Recolher</span></>}
          </button>
        </div>
      </aside>

      <main id="conteudo-principal" className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b bg-background/90 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <LastImportChip data={lastImport.data} />

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="gap-2 text-muted-foreground shadow-sm" onClick={() => setPaletteOpen(true)}>
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">Buscar</span>
            <kbd className="ml-1 hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">Ctrl K</kbd>
          </Button>

          <Link to="/ajuda/novidades" title="Novidades do sistema" className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent">
            <Bell className="h-4 w-4" />
            {(novidadesNaoLidas.data ?? 0) > 0 && (
              <span className="absolute top-1 right-1 inline-flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-semibold bg-[var(--status-critical)] text-white">
                {(novidadesNaoLidas.data ?? 0) > 9 ? "9+" : novidadesNaoLidas.data}
              </span>
            )}
          </Link>

          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setChatOpen(true)}>
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="hidden md:inline text-xs">Assistente IA</span>
          </Button>
        </header>

        <div className="border-b bg-background/75 backdrop-blur sticky top-16 z-20">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <GlobalFilters />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-5 pb-8 space-y-3">
            <QueueEntryBanner />
            {children}
          </div>
        </div>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AiChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
      <OnboardingModal />
    </div>
  );
}

function NotifBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (!count) return null;
  if (collapsed) {
    return <span className="absolute -mt-3 ml-3 h-2 w-2 rounded-full bg-[var(--status-critical)]" />;
  }
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-[var(--status-critical)] text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function LastImportChip({ data }: { data: { created_at: string; total_sucesso: number; total_erro: number } | null | undefined }) {
  if (!data) {
    return (
      <Link
        to="/importacao"
        className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-transparent px-2.5 py-1.5 hover:border-border hover:bg-card hover:text-foreground transition-colors"
        title="Nenhuma importacao ainda. Clique para importar."
      >
        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="hidden sm:inline">Sem importacoes</span>
        <span className="hidden md:inline text-[10px] uppercase tracking-wide text-primary">Importar</span>
      </Link>
    );
  }
  const d = new Date(data.created_at);
  const fmt = d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const ok = (data.total_erro ?? 0) === 0;
  return (
    <Link
      to="/importacao"
      className="flex items-center gap-2 text-xs rounded-lg border border-transparent px-2.5 py-1.5 hover:border-border hover:bg-card transition-colors"
      title="Ver historico de importacoes"
    >
      <div className={cn("h-2 w-2 rounded-full", ok ? "bg-[var(--status-healthy)]" : "bg-[var(--status-attention)]")} />
      <div className="hidden sm:flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ultima atualizacao</span>
        <span className="font-medium tabular-nums">{fmt}</span>
      </div>
    </Link>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
          <HelpTip title={title} text={description || "Esta tela faz parte do fluxo operacional do SGP. Use os filtros, tabelas e acoes disponiveis para consultar, acompanhar ou atualizar os dados conforme seu perfil."} />
        </div>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Building2 };
