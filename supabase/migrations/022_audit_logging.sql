-- Migration 022: Permission Audit Logging
-- Phase 4.0: Audit Event Logging (Foundation for all admin features)
-- 
-- This migration creates an append-only audit log for all permission changes,
-- providing complete traceability for compliance and debugging.

-- ============================================================================
-- 4.0.1: Create permission_audit_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event classification
  event_type VARCHAR(50) NOT NULL,
  -- Allowed: grant, revoke, transfer, admin_override, policy_change, 
  --          invitation_accept, request_approve, request_deny
  
  -- Actor information
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('client', 'professional', 'admin', 'system')),
  actor_id UUID NOT NULL,
  
  -- Target information
  target_client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_relationship_id UUID REFERENCES professional_client_relationships(id) ON DELETE SET NULL,
  target_professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Professional's profile ID
  permission_slug VARCHAR(50) REFERENCES permission_definitions(slug) ON DELETE SET NULL,
  
  -- State snapshots for auditability
  previous_state JSONB,
  new_state JSONB,
  
  -- Admin actions require reason
  reason TEXT,
  
  -- Additional context
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp (immutable)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Enforce reason for admin actions
  CONSTRAINT admin_actions_require_reason CHECK (
    actor_type != 'admin' OR (reason IS NOT NULL AND LENGTH(TRIM(reason)) >= 10)
  )
);

-- Create indexes for common query patterns
CREATE INDEX idx_audit_log_created_at ON permission_audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor ON permission_audit_log (actor_type, actor_id);
CREATE INDEX idx_audit_log_client ON permission_audit_log (target_client_id) WHERE target_client_id IS NOT NULL;
CREATE INDEX idx_audit_log_permission ON permission_audit_log (permission_slug) WHERE permission_slug IS NOT NULL;
CREATE INDEX idx_audit_log_event_type ON permission_audit_log (event_type);

-- Enable Row Level Security
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: allow INSERT only via RPC (no direct inserts from client)
-- The RPC will handle validation and insertion
CREATE POLICY audit_log_no_direct_insert ON permission_audit_log
  FOR INSERT WITH CHECK (false);

-- Read access: service-role only (for admin audit log viewer)
CREATE POLICY audit_log_read_service_role ON permission_audit_log
  FOR SELECT USING (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
  );

-- No UPDATE or DELETE policies - table is append-only by design

-- ============================================================================
-- 4.0.2: Create audit logging RPC helper
-- ============================================================================

CREATE OR REPLACE FUNCTION log_permission_event(
  p_event_type VARCHAR(50),
  p_actor_type VARCHAR(20),
  p_actor_id UUID,
  p_target_client_id UUID DEFAULT NULL,
  p_target_relationship_id UUID DEFAULT NULL,
  p_target_professional_id UUID DEFAULT NULL,
  p_permission_slug VARCHAR(50) DEFAULT NULL,
  p_previous_state JSONB DEFAULT NULL,
  p_new_state JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Validate actor_type
  IF p_actor_type NOT IN ('client', 'professional', 'admin', 'system') THEN
    RAISE EXCEPTION 'Invalid actor_type: %', p_actor_type;
  END IF;
  
  -- Validate reason for admin actions
  IF p_actor_type = 'admin' AND (p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10) THEN
    RAISE EXCEPTION 'Admin actions require a reason of at least 10 characters';
  END IF;
  
  -- Insert the audit log entry (bypassing RLS via SECURITY DEFINER)
  INSERT INTO permission_audit_log (
    event_type,
    actor_type,
    actor_id,
    target_client_id,
    target_relationship_id,
    target_professional_id,
    permission_slug,
    previous_state,
    new_state,
    reason,
    metadata
  ) VALUES (
    p_event_type,
    p_actor_type,
    p_actor_id,
    p_target_client_id,
    p_target_relationship_id,
    p_target_professional_id,
    p_permission_slug,
    p_previous_state,
    p_new_state,
    p_reason,
    COALESCE(p_metadata, '{}')
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- 4.0.3: Update existing grant/revoke RPCs to call audit logger
-- ============================================================================

-- Drop old function signatures first to avoid ambiguity
-- The old functions had fewer parameters; we're extending them with audit support
-- Drop all possible signature variations to handle both VARCHAR and TEXT
DROP FUNCTION IF EXISTS grant_exclusive_permission(UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS grant_exclusive_permission(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS grant_shared_permission(UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS grant_shared_permission(UUID, TEXT, TEXT);

-- Update grant_exclusive_permission to log events
-- Extended signature to support admin overrides with reason and explicit actor_id
CREATE OR REPLACE FUNCTION grant_exclusive_permission(
  p_relationship_id UUID,
  p_permission_slug VARCHAR(50),
  p_granted_by VARCHAR(20) DEFAULT 'client',
  p_actor_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_professional_id UUID;
  v_existing_holder_id UUID;
  v_existing_relationship_id UUID;
  v_lock_key BIGINT;
  v_transfer_previous_state JSONB;
  v_grant_previous_state JSONB;
  v_new_state JSONB;
  v_effective_actor_id UUID;
BEGIN
  -- Get client_id and professional_id from relationship
  SELECT pcr.client_id, pcr.professional_id INTO v_client_id, v_professional_id
  FROM professional_client_relationships pcr
  WHERE pcr.id = p_relationship_id;
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Relationship not found');
  END IF;
  
  -- Determine effective actor_id
  -- For admin: use provided p_actor_id (required)
  -- For client/professional: derive from relationship if not provided
  IF p_granted_by = 'admin' THEN
    IF p_actor_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin actions require explicit actor_id');
    END IF;
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin actions require a reason of at least 10 characters');
    END IF;
    v_effective_actor_id := p_actor_id;
  ELSIF p_actor_id IS NOT NULL THEN
    v_effective_actor_id := p_actor_id;
  ELSE
    v_effective_actor_id := CASE WHEN p_granted_by = 'client' THEN v_client_id ELSE v_professional_id END;
  END IF;
  
  -- Generate advisory lock key from client_id and permission_slug
  v_lock_key := hashtext(v_client_id::text || ':' || p_permission_slug);
  
  -- Acquire advisory lock for this client+permission combination
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- Check for existing holder
  SELECT cp.relationship_id INTO v_existing_relationship_id
  FROM client_permissions cp
  WHERE cp.client_id = v_client_id
    AND cp.permission_slug = p_permission_slug
    AND cp.status = 'granted';
  
  -- Capture transfer previous state (for the existing holder being revoked)
  IF v_existing_relationship_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'relationship_id', v_existing_relationship_id,
      'permission_slug', p_permission_slug,
      'status', 'granted'
    ) INTO v_transfer_previous_state;
    
    -- Get previous holder's professional_id
    SELECT pcr.professional_id INTO v_existing_holder_id
    FROM professional_client_relationships pcr
    WHERE pcr.id = v_existing_relationship_id;
  END IF;
  
  -- Capture grant previous state (for the new grantee - their prior status for this permission)
  SELECT jsonb_build_object(
    'relationship_id', p_relationship_id,
    'permission_slug', p_permission_slug,
    'status', COALESCE(cp.status, 'none'),
    'granted_at', cp.granted_at
  ) INTO v_grant_previous_state
  FROM client_permissions cp
  WHERE cp.relationship_id = p_relationship_id
    AND cp.permission_slug = p_permission_slug;
  
  -- If no prior record, set to null
  IF v_grant_previous_state IS NULL THEN
    v_grant_previous_state := jsonb_build_object(
      'relationship_id', p_relationship_id,
      'permission_slug', p_permission_slug,
      'status', 'none'
    );
  END IF;
  
  -- Revoke from existing holder if different
  IF v_existing_relationship_id IS NOT NULL AND v_existing_relationship_id != p_relationship_id THEN
    UPDATE client_permissions
    SET status = 'revoked', revoked_at = NOW()
    WHERE relationship_id = v_existing_relationship_id
      AND permission_slug = p_permission_slug
      AND status = 'granted';
    
    -- Log the transfer/revoke event for the previous holder
    PERFORM log_permission_event(
      'transfer',
      p_granted_by,
      v_effective_actor_id,
      v_client_id,
      v_existing_relationship_id,
      v_existing_holder_id,
      p_permission_slug,
      v_transfer_previous_state,
      jsonb_build_object('status', 'revoked', 'revoked_at', NOW()),
      p_reason,
      jsonb_build_object('transfer_to_relationship_id', p_relationship_id)
    );
  END IF;
  
  -- Grant to new holder (upsert)
  INSERT INTO client_permissions (relationship_id, permission_slug, status, granted_at, granted_by, client_id)
  VALUES (p_relationship_id, p_permission_slug, 'granted', NOW(), p_granted_by, v_client_id)
  ON CONFLICT (relationship_id, permission_slug)
  DO UPDATE SET status = 'granted', granted_at = NOW(), granted_by = p_granted_by, revoked_at = NULL;
  
  -- Capture new state for audit
  v_new_state := jsonb_build_object(
    'relationship_id', p_relationship_id,
    'permission_slug', p_permission_slug,
    'status', 'granted',
    'granted_at', NOW()
  );
  
  -- Log the grant event for the new holder (with their previous state, not the transfer state)
  PERFORM log_permission_event(
    'grant',
    p_granted_by,
    v_effective_actor_id,
    v_client_id,
    p_relationship_id,
    v_professional_id,
    p_permission_slug,
    v_grant_previous_state,
    v_new_state,
    p_reason,
    CASE WHEN v_existing_relationship_id IS NOT NULL AND v_existing_relationship_id != p_relationship_id
      THEN jsonb_build_object('transferred_from_relationship_id', v_existing_relationship_id)
      ELSE NULL
    END
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_holder_revoked', v_existing_relationship_id IS NOT NULL AND v_existing_relationship_id != p_relationship_id,
    'previous_holder_id', v_existing_holder_id
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Permission conflict: another grant was made simultaneously. Please refresh and try again.'
    );
END;
$$;

-- Update grant_shared_permission to log events
-- Extended signature to support admin overrides with reason and explicit actor_id
CREATE OR REPLACE FUNCTION grant_shared_permission(
  p_relationship_id UUID,
  p_permission_slug VARCHAR(50),
  p_granted_by VARCHAR(20) DEFAULT 'client',
  p_actor_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_professional_id UUID;
  v_previous_state JSONB;
  v_new_state JSONB;
  v_was_revoked BOOLEAN := FALSE;
  v_effective_actor_id UUID;
BEGIN
  -- Get client_id and professional_id from relationship
  SELECT pcr.client_id, pcr.professional_id INTO v_client_id, v_professional_id
  FROM professional_client_relationships pcr
  WHERE pcr.id = p_relationship_id;
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Relationship not found');
  END IF;
  
  -- Determine effective actor_id
  IF p_granted_by = 'admin' THEN
    IF p_actor_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin actions require explicit actor_id');
    END IF;
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin actions require a reason of at least 10 characters');
    END IF;
    v_effective_actor_id := p_actor_id;
  ELSIF p_actor_id IS NOT NULL THEN
    v_effective_actor_id := p_actor_id;
  ELSE
    v_effective_actor_id := CASE WHEN p_granted_by = 'client' THEN v_client_id ELSE v_professional_id END;
  END IF;
  
  -- Check if permission was previously revoked (for audit context)
  SELECT jsonb_build_object(
    'relationship_id', p_relationship_id,
    'permission_slug', p_permission_slug,
    'status', cp.status,
    'granted_at', cp.granted_at
  ), cp.status = 'revoked'
  INTO v_previous_state, v_was_revoked
  FROM client_permissions cp
  WHERE cp.relationship_id = p_relationship_id
    AND cp.permission_slug = p_permission_slug;
  
  -- If no prior record, set default previous state
  IF v_previous_state IS NULL THEN
    v_previous_state := jsonb_build_object(
      'relationship_id', p_relationship_id,
      'permission_slug', p_permission_slug,
      'status', 'none'
    );
  END IF;
  
  -- Upsert permission
  INSERT INTO client_permissions (relationship_id, permission_slug, status, granted_at, granted_by, client_id)
  VALUES (p_relationship_id, p_permission_slug, 'granted', NOW(), p_granted_by, v_client_id)
  ON CONFLICT (relationship_id, permission_slug)
  DO UPDATE SET status = 'granted', granted_at = NOW(), granted_by = p_granted_by, revoked_at = NULL;
  
  -- Capture new state for audit
  v_new_state := jsonb_build_object(
    'relationship_id', p_relationship_id,
    'permission_slug', p_permission_slug,
    'status', 'granted',
    'granted_at', NOW()
  );
  
  -- Log the grant event
  PERFORM log_permission_event(
    'grant',
    p_granted_by,
    v_effective_actor_id,
    v_client_id,
    p_relationship_id,
    v_professional_id,
    p_permission_slug,
    v_previous_state,
    v_new_state,
    p_reason,
    jsonb_build_object('was_revoked', v_was_revoked)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create revoke_permission function with audit logging
-- Extended signature to support admin overrides with reason and explicit actor_id
CREATE OR REPLACE FUNCTION revoke_permission(
  p_relationship_id UUID,
  p_permission_slug VARCHAR(50),
  p_revoked_by VARCHAR(20) DEFAULT 'client',
  p_actor_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_professional_id UUID;
  v_previous_state JSONB;
  v_new_state JSONB;
  v_rows_affected INTEGER;
  v_effective_actor_id UUID;
BEGIN
  -- Get client_id and professional_id from relationship
  SELECT pcr.client_id, pcr.professional_id INTO v_client_id, v_professional_id
  FROM professional_client_relationships pcr
  WHERE pcr.id = p_relationship_id;
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Relationship not found');
  END IF;
  
  -- Determine effective actor_id
  IF p_revoked_by = 'admin' THEN
    IF p_actor_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin actions require explicit actor_id');
    END IF;
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin actions require a reason of at least 10 characters');
    END IF;
    v_effective_actor_id := p_actor_id;
  ELSIF p_actor_id IS NOT NULL THEN
    v_effective_actor_id := p_actor_id;
  ELSE
    v_effective_actor_id := CASE WHEN p_revoked_by = 'client' THEN v_client_id ELSE v_professional_id END;
  END IF;
  
  -- Capture previous state for audit
  SELECT jsonb_build_object(
    'relationship_id', p_relationship_id,
    'permission_slug', p_permission_slug,
    'status', cp.status,
    'granted_at', cp.granted_at
  ) INTO v_previous_state
  FROM client_permissions cp
  WHERE cp.relationship_id = p_relationship_id
    AND cp.permission_slug = p_permission_slug;
  
  -- Revoke the permission
  UPDATE client_permissions
  SET status = 'revoked', revoked_at = NOW()
  WHERE relationship_id = p_relationship_id
    AND permission_slug = p_permission_slug
    AND status = 'granted';
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission not found or already revoked');
  END IF;
  
  -- Capture new state for audit
  v_new_state := jsonb_build_object(
    'relationship_id', p_relationship_id,
    'permission_slug', p_permission_slug,
    'status', 'revoked',
    'revoked_at', NOW()
  );
  
  -- Log the revoke event
  PERFORM log_permission_event(
    'revoke',
    p_revoked_by,
    v_effective_actor_id,
    v_client_id,
    p_relationship_id,
    v_professional_id,
    p_permission_slug,
    v_previous_state,
    v_new_state,
    p_reason,
    NULL
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 4.0.4: Create admin audit log query function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_audit_log(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_actor_type VARCHAR(20) DEFAULT NULL,
  p_event_type VARCHAR(50) DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_permission_slug VARCHAR(50) DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  event_type VARCHAR(50),
  actor_type VARCHAR(20),
  actor_id UUID,
  actor_name TEXT,
  target_client_id UUID,
  target_client_name TEXT,
  target_relationship_id UUID,
  target_professional_id UUID,
  target_professional_name TEXT,
  permission_slug VARCHAR(50),
  permission_name TEXT,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function should only be called by admins (service role)
  -- RLS on permission_audit_log already enforces this for direct queries
  
  RETURN QUERY
  SELECT 
    pal.id,
    pal.event_type,
    pal.actor_type,
    pal.actor_id,
    COALESCE(actor_profile.full_name, 'Unknown') AS actor_name,
    pal.target_client_id,
    COALESCE(client_profile.full_name, 'Unknown') AS target_client_name,
    pal.target_relationship_id,
    pal.target_professional_id,
    COALESCE(pro_profile.full_name, 'Unknown') AS target_professional_name,
    pal.permission_slug,
    COALESCE(pd.display_name, pal.permission_slug) AS permission_name,
    pal.previous_state,
    pal.new_state,
    pal.reason,
    pal.metadata,
    pal.created_at
  FROM permission_audit_log pal
  LEFT JOIN profiles actor_profile ON actor_profile.id = pal.actor_id
  LEFT JOIN profiles client_profile ON client_profile.id = pal.target_client_id
  LEFT JOIN profiles pro_profile ON pro_profile.id = pal.target_professional_id
  LEFT JOIN permission_definitions pd ON pd.slug = pal.permission_slug
  WHERE 
    (p_actor_type IS NULL OR pal.actor_type = p_actor_type)
    AND (p_event_type IS NULL OR pal.event_type = p_event_type)
    AND (p_client_id IS NULL OR pal.target_client_id = p_client_id)
    AND (p_permission_slug IS NULL OR pal.permission_slug = p_permission_slug)
    AND (p_start_date IS NULL OR pal.created_at >= p_start_date)
    AND (p_end_date IS NULL OR pal.created_at <= p_end_date)
  ORDER BY pal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create function to count audit log entries (for pagination)
CREATE OR REPLACE FUNCTION count_audit_log(
  p_actor_type VARCHAR(20) DEFAULT NULL,
  p_event_type VARCHAR(50) DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_permission_slug VARCHAR(50) DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM permission_audit_log pal
  WHERE 
    (p_actor_type IS NULL OR pal.actor_type = p_actor_type)
    AND (p_event_type IS NULL OR pal.event_type = p_event_type)
    AND (p_client_id IS NULL OR pal.target_client_id = p_client_id)
    AND (p_permission_slug IS NULL OR pal.permission_slug = p_permission_slug)
    AND (p_start_date IS NULL OR pal.created_at >= p_start_date)
    AND (p_end_date IS NULL OR pal.created_at <= p_end_date);
  
  RETURN v_count;
END;
$$;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

-- log_permission_event is SECURITY DEFINER and called internally by trusted RPCs
-- Do NOT grant to authenticated role - this prevents arbitrary audit entry crafting
-- The grant/revoke functions call it internally, so no direct access needed
GRANT EXECUTE ON FUNCTION log_permission_event TO service_role;

-- Admin audit log viewer functions - service_role only
GRANT EXECUTE ON FUNCTION get_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION count_audit_log TO service_role;

-- Permission management functions - available to authenticated users
-- These internally call log_permission_event via SECURITY DEFINER
GRANT EXECUTE ON FUNCTION grant_exclusive_permission TO authenticated;
GRANT EXECUTE ON FUNCTION grant_shared_permission TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_permission TO authenticated;
