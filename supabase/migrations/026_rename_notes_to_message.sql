-- Migration: Rename permission_requests.notes to message
-- This aligns the database schema with the application code which uses 'message'
-- for the "why do you need these permissions?" field

-- Rename the column
ALTER TABLE permission_requests RENAME COLUMN notes TO message;

-- Update the finalize_invitation_permissions function to use 'message' instead of 'notes'
CREATE OR REPLACE FUNCTION finalize_invitation_permissions(
  p_invitation_id UUID,
  p_approved TEXT[],
  p_rejected TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_relationship_id UUID;
  v_client_id UUID;
  v_perm TEXT;
  v_approved_count INT := 0;
  v_rejected_count INT := 0;
BEGIN
  -- Get invitation details
  SELECT i.*, pp.user_id as professional_user_id
  INTO v_invitation
  FROM invitations i
  JOIN professional_profiles pp ON pp.id = i.professional_id
  WHERE i.id = p_invitation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  -- Get the client's user_id (the one accepting the invitation)
  v_client_id := auth.uid();

  -- Get or create relationship
  SELECT id INTO v_relationship_id
  FROM professional_client_relationships
  WHERE professional_id = v_invitation.professional_id
  AND client_id = v_client_id
  AND status = 'active';

  IF v_relationship_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No active relationship found');
  END IF;

  -- Process approved permissions
  IF p_approved IS NOT NULL AND array_length(p_approved, 1) > 0 THEN
    FOREACH v_perm IN ARRAY p_approved
    LOOP
      INSERT INTO client_permissions (
        client_id, permission_slug, professional_id, relationship_id, status, granted_at
      )
      VALUES (
        v_client_id, v_perm, v_invitation.professional_id, v_relationship_id, 'active', NOW()
      )
      ON CONFLICT (client_id, permission_slug, professional_id) 
      DO UPDATE SET status = 'active', granted_at = NOW();
      
      v_approved_count := v_approved_count + 1;
    END LOOP;
  END IF;

  -- Process rejected permissions (create denied request records)
  IF p_rejected IS NOT NULL AND array_length(p_rejected, 1) > 0 THEN
    FOREACH v_perm IN ARRAY p_rejected
    LOOP
      INSERT INTO permission_requests (
        relationship_id, permission_slug, client_id, status, message
      )
      VALUES (
        v_relationship_id, v_perm, v_client_id, 'denied', 'Declined during invitation acceptance'
      )
      ON CONFLICT DO NOTHING;
      
      v_rejected_count := v_rejected_count + 1;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'rejected_count', v_rejected_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
