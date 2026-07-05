import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ModuleTab = { to: string; label: string; help?: string };

const LS_PREFIX = "sv:module-last-tab:";

/** Remember the last visited tab of a module so the sidebar link returns to it. */
export function rememberModuleTab(moduleKey: string, path: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PREFIX + moduleKey, path);
  } catch {}
}

export function getLastModuleTab(moduleKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LS_PREFIX + moduleKey);
  } catch {
    return null;
  }
}

export function ModuleTabs({
  tabs,
  title,
  description,
  moduleKey,
}: {
  tabs: ModuleTab[];
  title?: string;
  description?: string;
  /** If provided, persists the currently-active tab under this key. */
  moduleKey?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const activeTab = tabs.find((t) => isActive(t.to));

  useEffect(() => {
    if (moduleKey && activeTab) rememberModuleTab(moduleKey, activeTab.to);
  }, [moduleKey, activeTab?.to]);

  return (
    <div className="mb-6 -mx-4 lg:-mx-8 px-4 lg:px-8 border-b bg-background/82 backdrop-blur sticky top-28 z-10">
      {(title || description) && (
        <div className="pt-4">
          {title && (
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80 mb-1">
              <span>{title}</span>
              {activeTab && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground/70 normal-case tracking-normal text-xs">
                    {activeTab.label}
                  </span>
                </>
              )}
            </div>
          )}
          {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
          {description && <p className="text-sm text-muted-foreground mt-1 max-w-4xl">{description}</p>}
        </div>
      )}
      <nav className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-3">
        <TooltipProvider delayDuration={150}>
          {tabs.map((t) => {
            const active = isActive(t.to);
            const link = (
              <Link
                key={t.to}
                to={t.to}
                preload="intent"
                title={t.help || t.label}
                className={cn(
                  "relative rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-border bg-card text-foreground font-medium shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/70 hover:text-foreground",
                )}
              >
                {t.label}
                {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-primary rounded-full" />}
              </Link>
            );
            if (!t.help) return link;
            return (
              <Tooltip key={t.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-popover text-popover-foreground border shadow-md">
                  {t.help}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>
    </div>
  );
}
