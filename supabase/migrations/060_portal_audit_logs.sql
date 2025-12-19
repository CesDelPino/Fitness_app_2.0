-- Portal Audit Logs for tracking portal context switches
-- Part of Portal Architecture Phase 1

CREATE TABLE IF NOT EXISTS portal_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_portal text,
  to_portal text NOT NULL CHECK (to_portal IN ('pro', 'client')),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_portal_audit_logs_user_id ON portal_audit_logs(user_id);

-- Index for querying by time
CREATE INDEX IF NOT EXISTS idx_portal_audit_logs_created_at ON portal_audit_logs(created_at DESC);

-- RLS policies
ALTER TABLE portal_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY portal_audit_logs_select_own ON portal_audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the system (service role) can insert audit logs
CREATE POLICY portal_audit_logs_insert_service ON portal_audit_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE portal_audit_logs IS 'Audit log for portal context switches between pro and client modes';
COMMENT ON COLUMN portal_audit_logs.from_portal IS 'Previous portal mode (null if first login)';
COMMENT ON COLUMN portal_audit_logs.to_portal IS 'New portal mode being switched to';
