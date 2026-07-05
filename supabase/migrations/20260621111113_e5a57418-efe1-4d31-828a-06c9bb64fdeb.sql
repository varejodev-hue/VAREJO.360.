
CREATE TABLE IF NOT EXISTS public.chat_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  intent text,
  prompt_preview text,
  tables_consulted text[] NOT NULL DEFAULT '{}',
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  role_snapshot text,
  scope_snapshot jsonb
);

GRANT SELECT ON public.chat_audit_log TO authenticated;
GRANT ALL ON public.chat_audit_log TO service_role;

ALTER TABLE public.chat_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_audit_self_read" ON public.chat_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_chat_audit_user_created ON public.chat_audit_log(user_id, created_at DESC);
