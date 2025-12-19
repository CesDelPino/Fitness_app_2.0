-- Phase 3: Invitation Permissions Migration
-- Enables professionals to request specific permissions during invitation

-- 1. Create invitation_permissions table
CREATE TABLE IF NOT EXISTS invitation_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  requested_by VARCHAR(20) DEFAULT 'professional' CHECK (requested_by IN ('professional', 'admin', 'system')),
  UNIQUE(invitation_id, permission_slug)
);

-- 2. Create permission_requests table (for post-connection pending requests)
CREATE TABLE IF NOT EXISTS permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES professional_client_relationships(id) ON DELETE CASCADE,
  permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  responded_at TIMESTAMP WITH TIME ZONE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes TEXT
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitation_permissions_invitation ON invitation_permissions(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_permissions_slug ON invitation_permissions(permission_slug);
CREATE INDEX IF NOT EXISTS idx_permission_requests_relationship ON permission_requests(relationship_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_client ON permission_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);

-- 4. Partial unique index to prevent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_requests_pending_unique
ON permission_requests (relationship_id, permission_slug)
WHERE status = 'pending';

-- 5. Enable Row Level Security
ALTER TABLE invitation_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_requests ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for invitation_permissions
DROP POLICY IF EXISTS "Professionals can view their invitation permissions" ON invitation_permissions;
CREATE POLICY "Professionals can view their invitation permissions"
  ON invitation_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN professional_profiles pp ON pp.id = i.professional_id
      WHERE i.id = invitation_permissions.invitation_id
      AND pp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Professionals can insert invitation permissions" ON invitation_permissions;
CREATE POLICY "Professionals can insert invitation permissions"
  ON invitation_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN professional_profiles pp ON pp.id = i.professional_id
      WHERE i.id = invitation_permissions.invitation_id
      AND pp.user_id = auth.uid()
    )
  );

-- 7. RLS Policies for permission_requests
DROP POLICY IF EXISTS "Clients can view their permission requests" ON permission_requests;
CREATE POLICY "Clients can view their permission requests"
  ON permission_requests FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Clients can update their permission requests" ON permission_requests;
CREATE POLICY "Clients can update their permission requests"
  ON permission_requests FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Professionals can view their permission requests" ON permission_requests;
CREATE POLICY "Professionals can view their permission requests"
  ON permission_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.id = pcr.professional_id
      WHERE pcr.id = permission_requests.relationship_id
      AND pp.user_id = auth.uid()
    )
  );

-- 8. Function to get role-based default permissions
CREATE OR REPLACE FUNCTION get_role_default_permissions(p_role_type TEXT)
RETURNS TEXT[] AS $$
BEGIN
  CASE p_role_type
    WHEN 'nutritionist' THEN 
      RETURN ARRAY['view_nutrition', 'view_weight', 'view_profile', 'set_nutrition_targets'];
    WHEN 'trainer' THEN 
      RETURN ARRAY['view_workouts', 'view_weight', 'view_profile', 'assign_programmes', 'assign_checkins'];
    WHEN 'coach' THEN 
      RETURN ARRAY['view_nutrition', 'view_workouts', 'view_weight', 'view_progress_photos', 'view_fasting', 'view_checkins', 'view_profile', 'set_nutrition_targets', 'set_weight_targets', 'assign_programmes', 'assign_checkins', 'set_fasting_schedule'];
    ELSE 
      RETURN ARRAY[]::TEXT[];
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Updated create_invitation function with permission support
CREATE OR REPLACE FUNCTION create_invitation_with_permissions(
  p_email TEXT,
  p_role_type TEXT,
  p_token TEXT,
  p_permissions TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_professional_id UUID;
  v_invitation_id UUID;
  v_perm TEXT;
  v_permissions_to_use TEXT[];
BEGIN
  -- Get professional_id for current user
  SELECT id INTO v_professional_id
  FROM professional_profiles
  WHERE user_id = auth.uid();
  
  IF v_professional_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Professional profile not found');
  END IF;
  
  -- Create the invitation
  INSERT INTO invitations (professional_id, client_email, role_type, token, status)
  VALUES (v_professional_id, p_email, p_role_type::professional_role_type, p_token, 'pending')
  RETURNING id INTO v_invitation_id;
  
  -- Determine permissions to use: explicit list or role defaults
  IF p_permissions IS NOT NULL AND array_length(p_permissions, 1) > 0 THEN
    v_permissions_to_use := p_permissions;
  ELSE
    v_permissions_to_use := get_role_default_permissions(p_role_type);
  END IF;
  
  -- Insert invitation permissions
  FOREACH v_perm IN ARRAY v_permissions_to_use
  LOOP
    INSERT INTO invitation_permissions (invitation_id, permission_slug, requested_by)
    VALUES (v_invitation_id, v_perm, 'professional')
    ON CONFLICT (invitation_id, permission_slug) DO NOTHING;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'permissions_requested', v_permissions_to_use
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Invitation already exists for this client');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to fetch invitation details with permissions
CREATE OR REPLACE FUNCTION fetch_invitation_details(p_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_professional RECORD;
  v_permissions JSON;
  v_exclusive_holders JSON;
BEGIN
  -- Get invitation details
  SELECT i.*, pp.id as pro_profile_id, p.display_name as professional_name, p.id as professional_user_id
  INTO v_invitation
  FROM invitations i
  JOIN professional_profiles pp ON pp.id = i.professional_id
  JOIN profiles p ON p.id = pp.user_id
  WHERE i.token = p_token AND i.status = 'pending';
  
  IF v_invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found or expired');
  END IF;
  
  -- Get requested permissions with their details
  SELECT json_agg(json_build_object(
    'slug', pd.slug,
    'display_name', pd.display_name,
    'description', pd.description,
    'category', pd.category,
    'permission_type', pd.permission_type,
    'is_exclusive', pd.is_exclusive,
    'requested_at', ip.requested_at
  ))
  INTO v_permissions
  FROM invitation_permissions ip
  JOIN permission_definitions pd ON pd.slug = ip.permission_slug
  WHERE ip.invitation_id = v_invitation.id
  AND pd.is_enabled = TRUE;
  
  -- If no permissions found, use role defaults
  IF v_permissions IS NULL THEN
    SELECT json_agg(json_build_object(
      'slug', pd.slug,
      'display_name', pd.display_name,
      'description', pd.description,
      'category', pd.category,
      'permission_type', pd.permission_type,
      'is_exclusive', pd.is_exclusive,
      'requested_at', NOW()
    ))
    INTO v_permissions
    FROM permission_definitions pd
    WHERE pd.slug = ANY(get_role_default_permissions(v_invitation.role_type::TEXT))
    AND pd.is_enabled = TRUE;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'invitation', json_build_object(
      'id', v_invitation.id,
      'client_email', v_invitation.client_email,
      'role_type', v_invitation.role_type,
      'created_at', v_invitation.created_at
    ),
    'professional', json_build_object(
      'id', v_invitation.pro_profile_id,
      'user_id', v_invitation.professional_user_id,
      'name', v_invitation.professional_name
    ),
    'permissions', COALESCE(v_permissions, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to finalize invitation with permission selections
CREATE OR REPLACE FUNCTION finalize_invitation_permissions(
  p_token TEXT,
  p_approved TEXT[],
  p_rejected TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_relationship_id UUID;
  v_client_id UUID;
  v_perm TEXT;
  v_result JSON;
  v_lock_key BIGINT;
  v_transfers JSON[] := ARRAY[]::JSON[];
BEGIN
  -- Get client ID from auth
  v_client_id := auth.uid();
  
  IF v_client_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get and validate invitation
  SELECT i.*, pp.id as professional_id
  INTO v_invitation
  FROM invitations i
  JOIN professional_profiles pp ON pp.id = i.professional_id
  WHERE i.token = p_token AND i.status = 'pending';
  
  IF v_invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found or already accepted');
  END IF;
  
  -- Check if relationship already exists
  SELECT id INTO v_relationship_id
  FROM professional_client_relationships
  WHERE professional_id = v_invitation.professional_id
  AND client_id = v_client_id
  AND status = 'active';
  
  -- Create relationship if it doesn't exist
  IF v_relationship_id IS NULL THEN
    INSERT INTO professional_client_relationships (
      professional_id, client_id, role_type, status, accepted_at
    )
    VALUES (
      v_invitation.professional_id, 
      v_client_id, 
      v_invitation.role_type,
      CASE WHEN array_length(p_approved, 1) > 0 THEN 'active' ELSE 'inactive' END,
      NOW()
    )
    RETURNING id INTO v_relationship_id;
  END IF;
  
  -- Process approved permissions
  IF p_approved IS NOT NULL THEN
    FOREACH v_perm IN ARRAY p_approved
    LOOP
      -- Check if exclusive
      IF EXISTS (SELECT 1 FROM permission_definitions WHERE slug = v_perm AND is_exclusive = TRUE) THEN
        -- Use advisory lock for exclusive permissions
        v_lock_key := hashtext(v_client_id::text || ':' || v_perm);
        PERFORM pg_advisory_xact_lock(v_lock_key);
        
        -- Grant exclusive permission (handles transfer atomically)
        SELECT grant_exclusive_permission(v_relationship_id, v_perm, 'client') INTO v_result;
        
        IF (v_result->>'success')::boolean AND (v_result->>'previous_holder_revoked')::boolean THEN
          v_transfers := v_transfers || v_result;
        END IF;
      ELSE
        -- Grant shared permission
        PERFORM grant_shared_permission(v_relationship_id, v_perm, 'client');
      END IF;
    END LOOP;
  END IF;
  
  -- Record rejected permissions as pending requests (for professional follow-up)
  IF p_rejected IS NOT NULL AND array_length(p_rejected, 1) > 0 THEN
    FOREACH v_perm IN ARRAY p_rejected
    LOOP
      INSERT INTO permission_requests (
        relationship_id, permission_slug, client_id, status, notes
      )
      VALUES (
        v_relationship_id, v_perm, v_client_id, 'denied', 'Declined during invitation acceptance'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  -- Mark invitation as accepted
  UPDATE invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  RETURN json_build_object(
    'success', true,
    'relationship_id', v_relationship_id,
    'approved_count', COALESCE(array_length(p_approved, 1), 0),
    'rejected_count', COALESCE(array_length(p_rejected, 1), 0),
    'transfers', to_json(v_transfers)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Permission conflict detected. Please try again.');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to get pending permission requests for a client
CREATE OR REPLACE FUNCTION get_client_permission_requests()
RETURNS JSON AS $$
DECLARE
  v_client_id UUID;
  v_requests JSON;
BEGIN
  v_client_id := auth.uid();
  
  IF v_client_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  SELECT json_agg(json_build_object(
    'id', pr.id,
    'relationship_id', pr.relationship_id,
    'permission_slug', pr.permission_slug,
    'permission_name', pd.display_name,
    'permission_description', pd.description,
    'category', pd.category,
    'is_exclusive', pd.is_exclusive,
    'requested_at', pr.requested_at,
    'status', pr.status,
    'professional_name', p.display_name
  ))
  INTO v_requests
  FROM permission_requests pr
  JOIN permission_definitions pd ON pd.slug = pr.permission_slug
  JOIN professional_client_relationships pcr ON pcr.id = pr.relationship_id
  JOIN professional_profiles pp ON pp.id = pcr.professional_id
  JOIN profiles p ON p.id = pp.user_id
  WHERE pr.client_id = v_client_id
  AND pr.status = 'pending'
  AND pcr.status = 'active';
  
  RETURN json_build_object(
    'success', true,
    'requests', COALESCE(v_requests, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to respond to a permission request
CREATE OR REPLACE FUNCTION respond_to_permission_request(
  p_request_id UUID,
  p_action TEXT -- 'approve' or 'deny'
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_client_id UUID;
  v_result JSON;
BEGIN
  v_client_id := auth.uid();
  
  IF v_client_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get and validate request
  SELECT pr.*, pd.is_exclusive
  INTO v_request
  FROM permission_requests pr
  JOIN permission_definitions pd ON pd.slug = pr.permission_slug
  WHERE pr.id = p_request_id
  AND pr.client_id = v_client_id
  AND pr.status = 'pending';
  
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  IF p_action = 'approve' THEN
    -- Grant the permission
    IF v_request.is_exclusive THEN
      SELECT grant_exclusive_permission(v_request.relationship_id, v_request.permission_slug, 'client') INTO v_result;
    ELSE
      SELECT grant_shared_permission(v_request.relationship_id, v_request.permission_slug, 'client') INTO v_result;
    END IF;
    
    -- Update request status
    UPDATE permission_requests
    SET status = 'approved', responded_at = NOW()
    WHERE id = p_request_id;
    
    RETURN json_build_object(
      'success', true,
      'action', 'approved',
      'grant_result', v_result
    );
  ELSIF p_action = 'deny' THEN
    -- Update request status
    UPDATE permission_requests
    SET status = 'denied', responded_at = NOW()
    WHERE id = p_request_id;
    
    RETURN json_build_object('success', true, 'action', 'denied');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid action. Use approve or deny.');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Function to create a new permission request (for professionals to request additional permissions)
CREATE OR REPLACE FUNCTION create_permission_request(
  p_relationship_id UUID,
  p_permission_slug TEXT
)
RETURNS JSON AS $$
DECLARE
  v_professional_user_id UUID;
  v_client_id UUID;
  v_request_id UUID;
BEGIN
  v_professional_user_id := auth.uid();
  
  -- Verify professional owns this relationship
  SELECT pcr.client_id INTO v_client_id
  FROM professional_client_relationships pcr
  JOIN professional_profiles pp ON pp.id = pcr.professional_id
  WHERE pcr.id = p_relationship_id
  AND pp.user_id = v_professional_user_id
  AND pcr.status = 'active';
  
  IF v_client_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Relationship not found or inactive');
  END IF;
  
  -- Check if permission already granted
  IF EXISTS (
    SELECT 1 FROM client_permissions
    WHERE relationship_id = p_relationship_id
    AND permission_slug = p_permission_slug
    AND status = 'granted'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Permission already granted');
  END IF;
  
  -- Check if request already pending
  IF EXISTS (
    SELECT 1 FROM permission_requests
    WHERE relationship_id = p_relationship_id
    AND permission_slug = p_permission_slug
    AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Request already pending');
  END IF;
  
  -- Create the request
  INSERT INTO permission_requests (relationship_id, permission_slug, client_id, status)
  VALUES (p_relationship_id, p_permission_slug, v_client_id, 'pending')
  RETURNING id INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Backfill existing pending invitations with default permissions
DO $$
DECLARE
  inv RECORD;
  perm TEXT;
  perms TEXT[];
BEGIN
  FOR inv IN SELECT id, role_type::TEXT FROM invitations WHERE status = 'pending'
  LOOP
    perms := get_role_default_permissions(inv.role_type);
    FOREACH perm IN ARRAY perms
    LOOP
      INSERT INTO invitation_permissions (invitation_id, permission_slug, requested_by)
      VALUES (inv.id, perm, 'system')
      ON CONFLICT (invitation_id, permission_slug) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
