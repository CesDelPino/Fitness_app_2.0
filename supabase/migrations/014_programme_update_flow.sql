-- Migration: Programme Update Flow (Phase 5C)
-- Purpose: Enable trainers to push programme updates to clients
-- Tables: routine_assignments (altered), routine_versions (altered), routine_assignment_update_events (new)
-- See: docs/ROUTINE_ASSIGNMENT_ARCHITECTURE.md Phase 5C

-- ============================================
-- EXTEND ROUTINE ASSIGNMENTS WITH PENDING UPDATE TRACKING
-- ============================================

-- Add pending version reference (replaces simple has_pending_update boolean)
ALTER TABLE routine_assignments 
ADD COLUMN IF NOT EXISTS pending_version_id UUID REFERENCES routine_versions(id);

-- Add timestamp for when update was pushed
ALTER TABLE routine_assignments 
ADD COLUMN IF NOT EXISTS pending_created_at TIMESTAMPTZ;

-- Add optional notes from trainer about the update
ALTER TABLE routine_assignments 
ADD COLUMN IF NOT EXISTS pending_notes TEXT;

-- Index for finding assignments with pending updates
CREATE INDEX IF NOT EXISTS idx_routine_assignments_pending_version 
ON routine_assignments(pending_version_id) 
WHERE pending_version_id IS NOT NULL;

COMMENT ON COLUMN routine_assignments.pending_version_id IS 'New version awaiting client approval; NULL when no pending update';
COMMENT ON COLUMN routine_assignments.pending_created_at IS 'When the pending update was pushed by the trainer';
COMMENT ON COLUMN routine_assignments.pending_notes IS 'Optional trainer notes describing what changed in the update';

-- ============================================
-- ADD VERSION LINEAGE TO ROUTINE VERSIONS
-- ============================================

ALTER TABLE routine_versions
ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES routine_versions(id);

CREATE INDEX IF NOT EXISTS idx_routine_versions_parent 
ON routine_versions(parent_version_id) 
WHERE parent_version_id IS NOT NULL;

COMMENT ON COLUMN routine_versions.parent_version_id IS 'Links this version to the one it was derived from (for update tracking)';

-- ============================================
-- EXTEND ASSIGNMENT EVENT TYPE FOR UPDATE EVENTS
-- ============================================

ALTER TYPE assignment_event_type ADD VALUE IF NOT EXISTS 'update_offered';
ALTER TYPE assignment_event_type ADD VALUE IF NOT EXISTS 'update_accepted';
ALTER TYPE assignment_event_type ADD VALUE IF NOT EXISTS 'update_declined';
ALTER TYPE assignment_event_type ADD VALUE IF NOT EXISTS 'update_expired';
ALTER TYPE assignment_event_type ADD VALUE IF NOT EXISTS 'update_superseded';

-- ============================================
-- ROUTINE ASSIGNMENT UPDATE EVENTS TABLE
-- Separate audit trail specifically for update flow
-- ============================================

CREATE TABLE IF NOT EXISTS routine_assignment_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES routine_assignments(id) ON DELETE CASCADE,
  from_version_id UUID REFERENCES routine_versions(id),
  to_version_id UUID REFERENCES routine_versions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('update_offered', 'update_accepted', 'update_declined', 'update_expired', 'update_superseded')),
  notes TEXT,
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_update_events_assignment 
ON routine_assignment_update_events(assignment_id);

CREATE INDEX IF NOT EXISTS idx_update_events_created 
ON routine_assignment_update_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_update_events_type 
ON routine_assignment_update_events(event_type);

COMMENT ON TABLE routine_assignment_update_events IS 'Audit log specifically for programme update flow events';
COMMENT ON COLUMN routine_assignment_update_events.from_version_id IS 'The current version before the update';
COMMENT ON COLUMN routine_assignment_update_events.to_version_id IS 'The new version being offered/accepted';
COMMENT ON COLUMN routine_assignment_update_events.event_type IS 'update_offered, update_accepted, update_declined, update_expired, update_superseded';

-- ============================================
-- RLS POLICIES FOR UPDATE EVENTS TABLE
-- ============================================

ALTER TABLE routine_assignment_update_events ENABLE ROW LEVEL SECURITY;

-- Clients can view update events for their assignments
CREATE POLICY "Clients can view own update events"
ON routine_assignment_update_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM routine_assignments ra
    WHERE ra.id = routine_assignment_update_events.assignment_id
    AND ra.client_id = auth.uid()
  )
);

-- Professionals can view update events for their assignments
CREATE POLICY "Professionals can view client update events"
ON routine_assignment_update_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM routine_assignments ra
    WHERE ra.id = routine_assignment_update_events.assignment_id
    AND ra.assigned_by_pro_id = auth.uid()
  )
);

-- Update events are created by system (service role) during push/accept/decline

-- ============================================
-- UPDATE TRIGGER FOR PENDING UPDATE CHANGES
-- Logs update events automatically when pending_version_id changes
-- ============================================

CREATE OR REPLACE FUNCTION log_assignment_update_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when a new pending update is offered
  IF OLD.pending_version_id IS NULL AND NEW.pending_version_id IS NOT NULL THEN
    INSERT INTO routine_assignment_update_events (
      assignment_id,
      from_version_id,
      to_version_id,
      event_type,
      notes,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.current_version_id,
      NEW.pending_version_id,
      'update_offered',
      NEW.pending_notes,
      NEW.assigned_by_pro_id
    );
  
  -- Log when pending update is superseded by another
  ELSIF OLD.pending_version_id IS NOT NULL 
    AND NEW.pending_version_id IS NOT NULL 
    AND OLD.pending_version_id != NEW.pending_version_id THEN
    INSERT INTO routine_assignment_update_events (
      assignment_id,
      from_version_id,
      to_version_id,
      event_type,
      notes,
      performed_by
    ) VALUES (
      NEW.id,
      OLD.pending_version_id,
      NEW.pending_version_id,
      'update_superseded',
      NEW.pending_notes,
      NEW.assigned_by_pro_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_log_assignment_update_event ON routine_assignments;
CREATE TRIGGER trigger_log_assignment_update_event
  AFTER UPDATE ON routine_assignments
  FOR EACH ROW 
  WHEN (OLD.pending_version_id IS DISTINCT FROM NEW.pending_version_id)
  EXECUTE FUNCTION log_assignment_update_event();

-- ============================================
-- HELPER FUNCTION: Clear pending update
-- Used when client accepts or declines
-- ============================================

CREATE OR REPLACE FUNCTION clear_pending_update(assignment_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE routine_assignments
  SET 
    pending_version_id = NULL,
    pending_created_at = NULL,
    pending_notes = NULL,
    has_pending_update = false
  WHERE id = assignment_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION clear_pending_update IS 'Clears pending update fields when client accepts or declines';

-- ============================================
-- HELPER FUNCTION: Push update to assignment
-- Used by trainers to offer a new version
-- ============================================

CREATE OR REPLACE FUNCTION push_programme_update(
  assignment_uuid UUID,
  new_version_uuid UUID,
  update_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE routine_assignments
  SET 
    pending_version_id = new_version_uuid,
    pending_created_at = NOW(),
    pending_notes = update_notes,
    has_pending_update = true
  WHERE id = assignment_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION push_programme_update IS 'Offers a new version to client; supersedes any existing pending update';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN routine_assignments.has_pending_update IS 'Computed flag for easy querying; true when pending_version_id IS NOT NULL';
