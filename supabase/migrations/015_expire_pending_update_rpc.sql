-- Migration 015: Create RPC function for atomic pending update expiration
-- This ensures the assignment update and event insert happen together or not at all

CREATE OR REPLACE FUNCTION expire_pending_update(
  p_assignment_id UUID,
  p_expected_pending_version_id UUID,
  p_expected_routine_version_id UUID,
  p_performed_by UUID,
  p_expiry_days INTEGER DEFAULT 14
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Update the assignment only if versions still match (optimistic concurrency)
  UPDATE routine_assignments
  SET 
    pending_version_id = NULL,
    pending_created_at = NULL,
    pending_notes = NULL,
    has_pending_update = FALSE
  WHERE id = p_assignment_id
    AND pending_version_id = p_expected_pending_version_id
    AND routine_version_id = p_expected_routine_version_id;
  
  -- Check if any row was updated
  IF FOUND THEN
    v_updated := TRUE;
    
    -- Insert the expiration event (same transaction)
    INSERT INTO routine_assignment_update_events (
      assignment_id,
      from_version_id,
      to_version_id,
      event_type,
      performed_by,
      notes
    ) VALUES (
      p_assignment_id,
      p_expected_routine_version_id,
      p_expected_pending_version_id,
      'update_expired',
      p_performed_by,
      'Pending update expired after ' || p_expiry_days || ' days without client action'
    );
  END IF;
  
  RETURN v_updated;
END;
$$;

-- Grant execute permission to authenticated users (service role will use this)
GRANT EXECUTE ON FUNCTION expire_pending_update TO authenticated;
GRANT EXECUTE ON FUNCTION expire_pending_update TO service_role;

COMMENT ON FUNCTION expire_pending_update IS 
  'Atomically expires a stale pending update and logs the expiration event. 
   Returns TRUE if the update was expired, FALSE if versions changed (race condition avoided).';
