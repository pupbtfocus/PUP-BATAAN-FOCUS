-- Migration: Completely migrate audit_logs to transaction_logs and remove audit_logs

DO $$
BEGIN
  -- 1. If audit_logs view exists, drop it
  DROP VIEW IF EXISTS public.audit_logs CASCADE;

  -- 2. If audit_logs exists as a base table and transaction_logs does not, rename it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs' AND table_type = 'BASE TABLE')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_logs') THEN
    
    ALTER TABLE public.audit_logs RENAME TO transaction_logs;
    
    ALTER INDEX IF EXISTS idx_audit_logs_actor_id RENAME TO idx_transaction_logs_actor_id;
    ALTER INDEX IF EXISTS idx_audit_logs_entity_type RENAME TO idx_transaction_logs_entity_type;
    ALTER INDEX IF EXISTS idx_audit_logs_created_at RENAME TO idx_transaction_logs_created_at;

  -- 3. If BOTH audit_logs table and transaction_logs table exist, transfer any missing rows and drop audit_logs
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs' AND table_type = 'BASE TABLE')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_logs') THEN
    
    INSERT INTO public.transaction_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
    SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at
    FROM public.audit_logs
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE public.audit_logs CASCADE;
  END IF;

  -- 4. Ensure transaction_logs exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_logs') THEN
    CREATE TABLE public.transaction_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_transaction_logs_actor_id ON public.transaction_logs USING btree (actor_id);
    CREATE INDEX idx_transaction_logs_entity_type ON public.transaction_logs USING btree (entity_type);
    CREATE INDEX idx_transaction_logs_created_at ON public.transaction_logs USING btree (created_at DESC);
  END IF;

  -- 5. Enable RLS and setup policies
  ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Admins can view all transaction logs" ON public.transaction_logs;
  CREATE POLICY "Admins can view all transaction logs"
    ON public.transaction_logs FOR SELECT
    TO authenticated
    USING (public.is_admin_or_super_admin());
END $$;
