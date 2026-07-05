import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "lastActivityAt";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function useInactivityLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function markActive() {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      schedule();
    }

    async function logout() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return; // already logged out
      await supabase.auth.signOut();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      toast.warning("Sessão encerrada por inatividade (30 min).");
      navigate({ to: "/auth", replace: true });
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(logout, IDLE_MS);
    }

    // Cross-tab + tab-return check
    function checkExpired() {
      try {
        const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
        if (last && Date.now() - last > IDLE_MS) {
          logout();
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !checkExpired()) markActive();
    }

    // Initial: if returning to a tab past the threshold, kick out immediately
    if (!checkExpired()) markActive();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, markActive);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [navigate]);
}
