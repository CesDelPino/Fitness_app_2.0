-- Migration: Add routine assignment events for history tracking
-- Purpose: Track all changes to routine assignments (status, dates, notes)
-- Enables per-client chronological history view in Professional Portal

-- ============================================
-- ASSIGNMENT EVENT TYPE ENUM
-- ============================================

CREATE TYPE assignment_event_type AS ENUM (
  'created',         -- Initial assignment created
  'status_changed',  -- Status transition (active, paused, completed, cancelled)
  'dates_updated',   -- Start or end date modified
  'notes_updated',   -- Notes field changed
  'reassigned'       -- Different routine version assigned (future use)
);

-- ============================================
-- ROUTINE ASSIGNMENT EVENTS TABLE
-- ============================================

CREATE TABLE routine_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES routine_assignments(id) ON DELETE CASCADE,
  event_type assignment_event_type NOT NULL,
  
  -- Actor who made the change
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- State changes (store old/new for auditing)
  old_status routine_assignment_status,
  new_status routine_assignment_status,
  old_start_date DATE,
  new_start_date DATE,
  old_end_date DATE,
  new_end_date DATE,
  old_notes TEXT,
  new_notes TEXT,
  
  -- Optional context
  event_notes TEXT, -- Additional context about the change
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignment_events_assignment ON routine_assignment_events(assignment_id);
CREATE INDEX idx_assignment_events_type ON routine_assignment_events(event_type);
CREATE INDEX idx_assignment_events_created ON routine_assignment_events(created_at DESC);
CREATE INDEX idx_assignment_events_performer ON routine_assignment_events(performed_by);

-- Composite index for client history queries (via assignment -> client)
CREATE INDEX idx_assignment_events_timeline ON routine_assignment_events(assignment_id, created_at DESC);

-- ============================================
-- TRIGGER FUNCTION: Log assignment changes
-- ============================================

CREATE OR REPLACE FUNCTION log_assignment_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Log creation event
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
      INSERT INTO routine_assignment_events (
        assignment_id,
        event_type,
        performed_by,
        old_status,
        new_status
      ) VALUES (
        NEW.id,
        'status_changed',
        NEW.assigned_by_pro_id,
        OLD.status,
        NEW.status
      );
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
-- ATTACH TRIGGER TO ROUTINE_ASSIGNMENTS
-- ============================================

CREATE TRIGGER trigger_log_assignment_event
  AFTER INSERT OR UPDATE ON routine_assignments
  FOR EACH ROW EXECUTE FUNCTION log_assignment_event();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE routine_assignment_events IS 'Audit log of all changes to routine assignments for history timeline display';
COMMENT ON COLUMN routine_assignment_events.performed_by IS 'User who performed the action (usually the professional)';
COMMENT ON COLUMN routine_assignment_events.event_notes IS 'Optional human-readable context for the change';
