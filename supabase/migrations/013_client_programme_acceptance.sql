-- Migration: Client Programme Acceptance System (Phase 5A)
-- Purpose: Enable clients to accept/reject assigned programmes, materialize sessions
-- Tables: routine_assignment_sessions (new), routine_assignments (altered)
-- See: docs/ROUTINE_ASSIGNMENT_ARCHITECTURE.md Phase 5

-- ============================================
-- EXTEND ROUTINE ASSIGNMENT STATUS ENUM
-- ============================================

-- Add new status values for pending acceptance and rejection
ALTER TYPE routine_assignment_status ADD VALUE 'pending_acceptance';
ALTER TYPE routine_assignment_status ADD VALUE 'rejected';

-- ============================================
-- ADD REJECTED_AT COLUMN FOR CLEANUP TRACKING
-- ============================================

ALTER TABLE routine_assignments 
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_routine_assignments_rejected_at 
ON routine_assignments(rejected_at) 
WHERE rejected_at IS NOT NULL;

-- ============================================
-- ADD HAS_PENDING_UPDATE FLAG FOR VERSION UPDATES
-- ============================================

ALTER TABLE routine_assignments 
ADD COLUMN IF NOT EXISTS has_pending_update BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- ROUTINE ASSIGNMENT SESSIONS TABLE
-- Materialized sessions created when client accepts a programme
-- ============================================

CREATE TABLE routine_assignment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_assignment_id UUID NOT NULL REFERENCES routine_assignments(id) ON DELETE CASCADE,
  routine_version_id UUID NOT NULL REFERENCES routine_versions(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  session_focus TEXT,
  materialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT unique_active_session_per_day 
    UNIQUE NULLS NOT DISTINCT (routine_assignment_id, day_number, is_current)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_assignment_sessions_assignment ON routine_assignment_sessions(routine_assignment_id);
CREATE INDEX idx_assignment_sessions_version ON routine_assignment_sessions(routine_version_id);
CREATE INDEX idx_assignment_sessions_current ON routine_assignment_sessions(routine_assignment_id, is_current) 
  WHERE is_current = true;

COMMENT ON TABLE routine_assignment_sessions IS 'Materialized workout sessions created when client accepts an assigned programme';
COMMENT ON COLUMN routine_assignment_sessions.is_current IS 'false for historical sessions superseded by programme updates';
COMMENT ON COLUMN routine_assignment_sessions.session_focus IS 'Derived focus label (e.g. Push, Pull, Legs) for display';

-- ============================================
-- EXTEND ASSIGNMENT EVENT TYPE FOR NEW EVENTS
-- ============================================

ALTER TYPE assignment_event_type ADD VALUE 'accepted';
ALTER TYPE assignment_event_type ADD VALUE 'rejected';

-- ============================================
-- UPDATE TRIGGER FUNCTION FOR NEW EVENTS
-- ============================================

CREATE OR REPLACE FUNCTION log_assignment_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO routine_assignment_events (
      assignment_id,
      event_type,
      performed_by,
      new_status,
      new_start_date,
      new_end_date,
      new_notes
    ) VALUES (
      NEW.id,
      'created',
      NEW.assigned_by_pro_id,
      NEW.status,
      NEW.start_date,
      NEW.end_date,
      NEW.notes
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Check for status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Determine event type based on new status
      DECLARE
        evt_type assignment_event_type;
      BEGIN
        IF NEW.status = 'active' AND OLD.status = 'pending_acceptance' THEN
          evt_type := 'accepted';
        ELSIF NEW.status = 'rejected' THEN
          evt_type := 'rejected';
        ELSE
          evt_type := 'status_changed';
        END IF;
        
        INSERT INTO routine_assignment_events (
          assignment_id,
          event_type,
          performed_by,
          old_status,
          new_status
        ) VALUES (
          NEW.id,
          evt_type,
          COALESCE(NEW.assigned_by_pro_id, NEW.client_id),
          OLD.status,
          NEW.status
        );
      END;
    END IF;

    -- Check for date changes
    IF OLD.start_date IS DISTINCT FROM NEW.start_date 
       OR OLD.end_date IS DISTINCT FROM NEW.end_date THEN
      INSERT INTO routine_assignment_events (
        assignment_id,
        event_type,
        performed_by,
        old_start_date,
        new_start_date,
        old_end_date,
        new_end_date
      ) VALUES (
        NEW.id,
        'dates_updated',
        NEW.assigned_by_pro_id,
        OLD.start_date,
        NEW.start_date,
        OLD.end_date,
        NEW.end_date
      );
    END IF;

    -- Check for notes change
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO routine_assignment_events (
        assignment_id,
        event_type,
        performed_by,
        old_notes,
        new_notes
      ) VALUES (
        NEW.id,
        'notes_updated',
        NEW.assigned_by_pro_id,
        OLD.notes,
        NEW.notes
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR ROUTINE ASSIGNMENT SESSIONS
-- ============================================

ALTER TABLE routine_assignment_sessions ENABLE ROW LEVEL SECURITY;

-- Clients can view their own assignment sessions
CREATE POLICY "Clients can view own sessions"
ON routine_assignment_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM routine_assignments ra
    WHERE ra.id = routine_assignment_sessions.routine_assignment_id
    AND ra.client_id = auth.uid()
  )
);

-- Professionals can view their clients' sessions
CREATE POLICY "Professionals can view client sessions"
ON routine_assignment_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM routine_assignments ra
    WHERE ra.id = routine_assignment_sessions.routine_assignment_id
    AND ra.assigned_by_pro_id = auth.uid()
  )
);

-- Sessions are created by system (service role) during acceptance
-- No direct insert/update/delete by users

-- ============================================
-- CLIENT TIER HELPER FUNCTION
-- Returns 'pro_connected' or 'normal' based on relationships
-- ============================================

CREATE OR REPLACE FUNCTION get_client_tier(client_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  has_active_relationship BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM relationships 
    WHERE client_id = client_user_id 
    AND status = 'active'
  ) INTO has_active_relationship;
  
  IF has_active_relationship THEN
    RETURN 'pro_connected';
  ELSE
    RETURN 'normal';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_client_tier IS 'Returns client tier (pro_connected or normal) for entitlement checks';

-- ============================================
-- CLEANUP FUNCTION FOR REJECTED ASSIGNMENTS
-- Called during reads to prune old rejected assignments
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_rejected_assignments()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM routine_assignments
    WHERE status = 'rejected'
    AND rejected_at IS NOT NULL
    AND rejected_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_rejected_assignments IS 'Deletes rejected assignments older than 7 days; call during reads';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN routine_assignments.rejected_at IS 'Timestamp when assignment was rejected; used for 7-day cleanup';
COMMENT ON COLUMN routine_assignments.has_pending_update IS 'True when pro has updated programme and client hasnt accepted yet';
