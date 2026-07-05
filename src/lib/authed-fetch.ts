import { supabase } from "@/integrations/supabase/client";

/**
 * Custom fetch that injects the current Supabase session bearer token
 * into the Authorization header. Used by the AI chat transport so the
 * /api/chat route can authenticate the request.
 */
export const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};
