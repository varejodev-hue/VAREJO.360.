import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cached current auth user. Use everywhere instead of calling
 * supabase.auth.getUser() directly to avoid duplicate network calls.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "current-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
}
