-- Migration 025: Permission Presets and Force-Connection Support
-- Phase 4.4: Role-based permission presets for professional roles
-- Phase 4.6: Force-connection columns for admin-initiated relationships
-- 
-- This migration adds:
-- 1. permission_presets table for preset definitions
-- 2. preset_permissions table for preset-permission mappings
-- 3. Force-connection columns on professional_client_relationships
-- 4. RLS policies and RPCs for preset management
-- 5. Audit logging integration for all admin actions

-- ============================================================================
-- TRANSACTION START - All changes are atomic
-- ============================================================================
BEGIN;

-- Verify dependency: permission_definitions must exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'permission_definitions') THEN
    RAISE EXCEPTION 'Migration 020_permission_system.sql must be applied first.';
  END IF;
END $$;

-- ============================================================================
-- 4.4.1: Create permission_presets table
-- ============================================================================

CREATE TABLE IF NOT EXISTS permission_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_preset_name UNIQUE (name)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_permission_presets_active 
ON permission_presets (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_permission_presets_system 
ON permission_presets (is_system) WHERE is_system = true;

-- ============================================================================
-- 4.4.1: Create preset_permissions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS preset_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES permission_presets(id) ON DELETE CASCADE,
  permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_preset_permission UNIQUE (preset_id, permission_slug)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_preset_permissions_preset 
ON preset_permissions (preset_id);

CREATE INDEX IF NOT EXISTS idx_preset_permissions_slug 
ON preset_permissions (permission_slug);

-- ============================================================================
-- 4.6.1: Add force-connection columns to professional_client_relationships
-- ============================================================================

ALTER TABLE professional_client_relationships
ADD COLUMN IF NOT EXISTS forced_by_admin UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS forced_reason TEXT,
ADD COLUMN IF NOT EXISTS forced_at TIMESTAMPTZ;

-- Partial index for reporting on admin-forced connections
CREATE INDEX IF NOT EXISTS idx_relationships_forced 
ON professional_client_relationships (forced_by_admin, forced_at)
WHERE forced_by_admin IS NOT NULL;

-- ============================================================================
-- 4.4.1: RLS Policies for permission_presets
-- ============================================================================

ALTER TABLE permission_presets ENABLE ROW LEVEL SECURITY;

-- Service-role can do everything
CREATE POLICY "Service role full access to permission_presets"
  ON permission_presets FOR ALL
  USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Authenticated users can view active presets (for professionals applying them)
CREATE POLICY "Authenticated users can view active presets"
  ON permission_presets FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- ============================================================================
-- 4.4.1: RLS Policies for preset_permissions
-- ============================================================================

ALTER TABLE preset_permissions ENABLE ROW LEVEL SECURITY;

-- Service-role can do everything
CREATE POLICY "Service role full access to preset_permissions"
  ON preset_permissions FOR ALL
  USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Authenticated users can view preset permissions for active presets
CREATE POLICY "Authenticated users can view preset permissions"
  ON preset_permissions FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM permission_presets pp 
      WHERE pp.id = preset_id AND pp.is_active = true
    )
  );

-- ============================================================================
-- 4.4.2: RPC - List permission presets
-- ============================================================================

CREATE OR REPLACE FUNCTION list_permission_presets(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_include_inactive BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  description TEXT,
  is_system BOOLEAN,
  is_active BOOLEAN,
  created_by UUID,
  creator_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  permission_count BIGINT,
  permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    pp.id,
    pp.name,
    pp.description,
    pp.is_system,
    pp.is_active,
    pp.created_by,
    COALESCE(p.full_name, p.display_name, 'System')::TEXT as creator_name,
    pp.created_at,
    pp.updated_at,
    (SELECT COUNT(*) FROM preset_permissions perm WHERE perm.preset_id = pp.id)::BIGINT as permission_count,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'slug', perm.permission_slug,
        'is_enabled', perm.is_enabled,
        'display_name', pd.display_name,
        'category', pd.category,
        'is_exclusive', pd.is_exclusive
      ) ORDER BY pd.category, pd.display_name), '[]'::jsonb)
      FROM preset_permissions perm
      JOIN permission_definitions pd ON pd.slug = perm.permission_slug
      WHERE perm.preset_id = pp.id
    ) as permissions
  FROM permission_presets pp
  LEFT JOIN profiles p ON p.id = pp.created_by
  WHERE 
    (p_include_inactive OR pp.is_active = true)
  ORDER BY 
    pp.is_system DESC,
    pp.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4.4.2: RPC - Upsert permission preset
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_permission_preset(
  p_preset_id UUID DEFAULT NULL,
  p_name VARCHAR(100) DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_is_system BOOLEAN DEFAULT false,
  p_permissions JSONB DEFAULT '[]'::jsonb,
  p_admin_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preset_id UUID;
  v_is_update BOOLEAN;
  v_old_name VARCHAR(100);
  v_perm JSONB;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role required');
  END IF;
  
  -- Validate reason is provided and long enough
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin action requires a reason of at least 10 characters');
  END IF;
  
  -- Validate name is provided for new presets
  IF p_preset_id IS NULL AND (p_name IS NULL OR TRIM(p_name) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preset name is required');
  END IF;
  
  -- Check if this is an update or insert
  v_is_update := p_preset_id IS NOT NULL;
  
  IF v_is_update THEN
    -- Get existing preset
    SELECT name INTO v_old_name
    FROM permission_presets
    WHERE id = p_preset_id;
    
    IF v_old_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Preset not found');
    END IF;
    
    -- Check if trying to modify system preset name/system status
    IF EXISTS (SELECT 1 FROM permission_presets WHERE id = p_preset_id AND is_system = true) THEN
      IF p_is_system = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot change system preset to non-system');
      END IF;
    END IF;
    
    -- Update existing preset
    UPDATE permission_presets
    SET 
      name = COALESCE(NULLIF(TRIM(p_name), ''), name),
      description = COALESCE(p_description, description),
      updated_at = NOW()
    WHERE id = p_preset_id;
    
    v_preset_id := p_preset_id;
  ELSE
    -- Insert new preset
    INSERT INTO permission_presets (name, description, is_system, created_by)
    VALUES (TRIM(p_name), p_description, p_is_system, p_admin_id)
    RETURNING id INTO v_preset_id;
  END IF;
  
  -- Clear existing permissions and insert new ones
  DELETE FROM preset_permissions WHERE preset_id = v_preset_id;
  
  FOR v_perm IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    -- Validate permission exists
    IF NOT EXISTS (SELECT 1 FROM permission_definitions WHERE slug = v_perm->>'slug') THEN
      CONTINUE;
    END IF;
    
    INSERT INTO preset_permissions (preset_id, permission_slug, is_enabled)
    VALUES (
      v_preset_id,
      v_perm->>'slug',
      COALESCE((v_perm->>'is_enabled')::boolean, true)
    );
  END LOOP;
  
  -- Log the event
  PERFORM log_permission_event(
    CASE WHEN v_is_update THEN 'preset_update' ELSE 'preset_create' END,
    'admin',
    p_admin_id,
    NULL,  -- target_client_id
    NULL,  -- target_relationship_id
    NULL,  -- target_professional_id
    NULL,  -- permission_slug (not applicable for presets)
    CASE WHEN v_is_update THEN jsonb_build_object('name', v_old_name) ELSE NULL END,
    jsonb_build_object('name', COALESCE(NULLIF(TRIM(p_name), ''), v_old_name), 'permissions', p_permissions),
    p_reason,
    jsonb_build_object('preset_id', v_preset_id, 'is_system', p_is_system)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'preset_id', v_preset_id,
    'action', CASE WHEN v_is_update THEN 'updated' ELSE 'created' END
  );
END;
$$;

-- ============================================================================
-- 4.4.2: RPC - Delete permission preset (soft delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_permission_preset(
  p_preset_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preset_name VARCHAR(100);
  v_is_system BOOLEAN;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role required');
  END IF;
  
  -- Validate reason is provided and long enough
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin action requires a reason of at least 10 characters');
  END IF;
  
  -- Get preset details
  SELECT name, is_system INTO v_preset_name, v_is_system
  FROM permission_presets
  WHERE id = p_preset_id;
  
  IF v_preset_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preset not found');
  END IF;
  
  -- Prevent deletion of system presets
  IF v_is_system THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete system presets');
  END IF;
  
  -- Soft delete (deactivate)
  UPDATE permission_presets
  SET 
    is_active = false,
    updated_at = NOW()
  WHERE id = p_preset_id;
  
  -- Log the event
  PERFORM log_permission_event(
    'preset_delete',
    'admin',
    p_admin_id,
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('name', v_preset_name, 'is_active', true),
    jsonb_build_object('name', v_preset_name, 'is_active', false),
    p_reason,
    jsonb_build_object('preset_id', p_preset_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Preset deactivated successfully'
  );
END;
$$;

-- ============================================================================
-- 4.4.2: RPC - Apply permission preset to a relationship
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_permission_preset(
  p_relationship_id UUID,
  p_preset_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_professional_id UUID;
  v_preset_name VARCHAR(100);
  v_perm RECORD;
  v_grant_result JSONB;
  v_results JSONB := '[]'::jsonb;
  v_success_count INTEGER := 0;
  v_fail_count INTEGER := 0;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role required');
  END IF;
  
  -- Validate reason is provided and long enough
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin action requires a reason of at least 10 characters');
  END IF;
  
  -- Get relationship details
  SELECT client_id, professional_id INTO v_client_id, v_professional_id
  FROM professional_client_relationships
  WHERE id = p_relationship_id AND status = 'active';
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active relationship not found');
  END IF;
  
  -- Get preset details
  SELECT name INTO v_preset_name
  FROM permission_presets
  WHERE id = p_preset_id AND is_active = true;
  
  IF v_preset_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active preset not found');
  END IF;
  
  -- Acquire advisory lock on client to serialize exclusive permission grants
  PERFORM pg_advisory_xact_lock(hashtext('client_permissions_' || v_client_id::text));
  
  -- Apply each permission from the preset
  FOR v_perm IN 
    SELECT pp.permission_slug, pp.is_enabled, pd.is_exclusive
    FROM preset_permissions pp
    JOIN permission_definitions pd ON pd.slug = pp.permission_slug
    WHERE pp.preset_id = p_preset_id AND pp.is_enabled = true AND pd.is_enabled = true
  LOOP
    BEGIN
      -- Check if permission already exists
      IF EXISTS (
        SELECT 1 FROM client_permissions 
        WHERE relationship_id = p_relationship_id 
        AND permission_slug = v_perm.permission_slug
        AND status = 'active'
      ) THEN
        v_results := v_results || jsonb_build_object(
          'slug', v_perm.permission_slug,
          'status', 'skipped',
          'reason', 'Already granted'
        );
        CONTINUE;
      END IF;
      
      -- For exclusive permissions, check if already held by another professional
      IF v_perm.is_exclusive THEN
        IF EXISTS (
          SELECT 1 FROM client_permissions cp
          JOIN professional_client_relationships pcr ON pcr.id = cp.relationship_id
          WHERE cp.client_id = v_client_id
          AND cp.permission_slug = v_perm.permission_slug
          AND cp.status = 'active'
          AND pcr.professional_id != v_professional_id
        ) THEN
          v_results := v_results || jsonb_build_object(
            'slug', v_perm.permission_slug,
            'status', 'skipped',
            'reason', 'Exclusive permission held by another professional'
          );
          v_fail_count := v_fail_count + 1;
          CONTINUE;
        END IF;
      END IF;
      
      -- Grant the permission
      INSERT INTO client_permissions (
        client_id,
        relationship_id,
        permission_slug,
        granted_by,
        status,
        perm_is_exclusive
      )
      VALUES (
        v_client_id,
        p_relationship_id,
        v_perm.permission_slug,
        v_client_id,  -- granted_by is the client (but applied by admin)
        'active',
        v_perm.is_exclusive
      );
      
      v_results := v_results || jsonb_build_object(
        'slug', v_perm.permission_slug,
        'status', 'granted',
        'is_exclusive', v_perm.is_exclusive
      );
      v_success_count := v_success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object(
        'slug', v_perm.permission_slug,
        'status', 'error',
        'reason', SQLERRM
      );
      v_fail_count := v_fail_count + 1;
    END;
  END LOOP;
  
  -- Log the event
  PERFORM log_permission_event(
    'preset_apply',
    'admin',
    p_admin_id,
    v_client_id,
    p_relationship_id,
    v_professional_id,
    NULL,
    NULL,
    jsonb_build_object('preset_name', v_preset_name, 'results', v_results),
    p_reason,
    jsonb_build_object(
      'preset_id', p_preset_id,
      'success_count', v_success_count,
      'fail_count', v_fail_count
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'preset_name', v_preset_name,
    'success_count', v_success_count,
    'fail_count', v_fail_count,
    'results', v_results
  );
END;
$$;

-- ============================================================================
-- 4.5.1: RPC - Get admin KPIs for dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  SELECT jsonb_build_object(
    'verified_professionals', (
      SELECT COUNT(*) FROM professional_profiles 
      WHERE verification_status = 'verified'
    ),
    'pending_verifications', (
      SELECT COUNT(*) FROM professional_profiles 
      WHERE verification_status = 'pending'
    ),
    'active_connections', (
      SELECT COUNT(*) FROM professional_client_relationships 
      WHERE status = 'active'
    ),
    'forced_connections', (
      SELECT COUNT(*) FROM professional_client_relationships 
      WHERE forced_by_admin IS NOT NULL
    ),
    'total_permission_grants', (
      SELECT COUNT(*) FROM client_permissions 
      WHERE status = 'active'
    ),
    'exclusive_grants', (
      SELECT COUNT(*) FROM client_permissions 
      WHERE status = 'active' AND perm_is_exclusive = true
    ),
    'pending_permission_requests', (
      SELECT COUNT(*) FROM permission_requests 
      WHERE status = 'pending'
    ),
    'active_presets', (
      SELECT COUNT(*) FROM permission_presets 
      WHERE is_active = true
    ),
    'total_professionals', (
      SELECT COUNT(*) FROM profiles 
      WHERE role = 'professional'
    ),
    'total_clients', (
      SELECT COUNT(*) FROM profiles 
      WHERE role = 'user'
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- 4.5.1: RPC - Get permission activity feed
-- ============================================================================

CREATE OR REPLACE FUNCTION get_permission_activity_feed(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_type VARCHAR(50),
  actor_type VARCHAR(20),
  actor_id UUID,
  actor_name TEXT,
  target_client_id UUID,
  target_client_name TEXT,
  target_professional_id UUID,
  target_professional_name TEXT,
  permission_slug VARCHAR(50),
  permission_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    pal.id,
    pal.event_type,
    pal.actor_type,
    pal.actor_id,
    COALESCE(actor.full_name, actor.display_name, 'Unknown')::TEXT as actor_name,
    pal.target_client_id,
    COALESCE(client.full_name, client.display_name)::TEXT as target_client_name,
    pal.target_professional_id,
    COALESCE(pro.full_name, pro.display_name)::TEXT as target_professional_name,
    pal.permission_slug,
    pd.display_name::TEXT as permission_name,
    pal.reason,
    pal.created_at
  FROM permission_audit_log pal
  LEFT JOIN profiles actor ON actor.id = pal.actor_id
  LEFT JOIN profiles client ON client.id = pal.target_client_id
  LEFT JOIN profiles pro ON pro.id = pal.target_professional_id
  LEFT JOIN permission_definitions pd ON pd.slug = pal.permission_slug
  ORDER BY pal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4.5.1: RPC - Get permission trends for charts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_permission_trends(
  p_interval VARCHAR(10) DEFAULT 'day',
  p_lookback INTEGER DEFAULT 30
)
RETURNS TABLE (
  period_start TIMESTAMPTZ,
  grants INTEGER,
  revokes INTEGER,
  requests INTEGER,
  verifications INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  -- Set interval based on parameter
  v_interval := CASE p_interval
    WHEN 'hour' THEN '1 hour'::interval
    WHEN 'day' THEN '1 day'::interval
    WHEN 'week' THEN '1 week'::interval
    ELSE '1 day'::interval
  END;
  
  RETURN QUERY
  WITH periods AS (
    SELECT generate_series(
      date_trunc(p_interval, NOW() - (p_lookback || ' ' || p_interval)::interval),
      date_trunc(p_interval, NOW()),
      v_interval
    ) as period_start
  )
  SELECT 
    p.period_start,
    COALESCE(SUM(CASE WHEN pal.event_type = 'grant' THEN 1 ELSE 0 END), 0)::INTEGER as grants,
    COALESCE(SUM(CASE WHEN pal.event_type = 'revoke' THEN 1 ELSE 0 END), 0)::INTEGER as revokes,
    COALESCE(SUM(CASE WHEN pal.event_type IN ('request', 'permission_request') THEN 1 ELSE 0 END), 0)::INTEGER as requests,
    COALESCE(SUM(CASE WHEN pal.event_type IN ('verification_review', 'verification_submit') THEN 1 ELSE 0 END), 0)::INTEGER as verifications
  FROM periods p
  LEFT JOIN permission_audit_log pal ON 
    date_trunc(p_interval, pal.created_at) = p.period_start
  GROUP BY p.period_start
  ORDER BY p.period_start ASC;
END;
$$;

-- ============================================================================
-- 4.6.2: RPC - Force connect a client and professional
-- ============================================================================

CREATE OR REPLACE FUNCTION force_connect(
  p_client_id UUID,
  p_professional_id UUID,
  p_admin_id UUID,
  p_reason TEXT,
  p_preset_id UUID DEFAULT NULL,
  p_permissions JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relationship_id UUID;
  v_existing_relationship_id UUID;
  v_client_name TEXT;
  v_professional_name TEXT;
  v_preset_result JSONB;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role required');
  END IF;
  
  -- Validate reason is provided and long enough
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin action requires a reason of at least 10 characters');
  END IF;
  
  -- Validate client exists and is a user
  SELECT full_name INTO v_client_name
  FROM profiles WHERE id = p_client_id AND role = 'user';
  
  IF v_client_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client not found or not a user');
  END IF;
  
  -- Validate professional exists
  SELECT full_name INTO v_professional_name
  FROM profiles WHERE id = p_professional_id AND role = 'professional';
  
  IF v_professional_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Professional not found');
  END IF;
  
  -- Acquire advisory lock on client
  PERFORM pg_advisory_xact_lock(hashtext('client_permissions_' || p_client_id::text));
  
  -- Check for existing relationship
  SELECT id INTO v_existing_relationship_id
  FROM professional_client_relationships
  WHERE client_id = p_client_id 
    AND professional_id = p_professional_id
    AND status = 'active';
  
  IF v_existing_relationship_id IS NOT NULL THEN
    v_relationship_id := v_existing_relationship_id;
    
    -- Update with force info
    UPDATE professional_client_relationships
    SET 
      forced_by_admin = p_admin_id,
      forced_reason = p_reason,
      forced_at = NOW()
    WHERE id = v_relationship_id;
  ELSE
    -- Check for archived relationship to reactivate
    SELECT id INTO v_existing_relationship_id
    FROM professional_client_relationships
    WHERE client_id = p_client_id 
      AND professional_id = p_professional_id
      AND status IN ('terminated', 'archived');
    
    IF v_existing_relationship_id IS NOT NULL THEN
      -- Reactivate
      UPDATE professional_client_relationships
      SET 
        status = 'active',
        forced_by_admin = p_admin_id,
        forced_reason = p_reason,
        forced_at = NOW()
      WHERE id = v_existing_relationship_id
      RETURNING id INTO v_relationship_id;
    ELSE
      -- Create new relationship
      INSERT INTO professional_client_relationships (
        client_id, 
        professional_id, 
        status,
        forced_by_admin,
        forced_reason,
        forced_at
      )
      VALUES (
        p_client_id,
        p_professional_id,
        'active',
        p_admin_id,
        p_reason,
        NOW()
      )
      RETURNING id INTO v_relationship_id;
    END IF;
  END IF;
  
  -- Apply preset if provided
  IF p_preset_id IS NOT NULL THEN
    v_preset_result := apply_permission_preset(v_relationship_id, p_preset_id, p_admin_id, p_reason);
  END IF;
  
  -- Log the event
  PERFORM log_permission_event(
    'admin_override',
    'admin',
    p_admin_id,
    p_client_id,
    v_relationship_id,
    p_professional_id,
    NULL,
    NULL,
    jsonb_build_object(
      'action', 'force_connect',
      'relationship_id', v_relationship_id,
      'preset_applied', p_preset_id IS NOT NULL
    ),
    p_reason,
    jsonb_build_object(
      'client_name', v_client_name,
      'professional_name', v_professional_name
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'relationship_id', v_relationship_id,
    'client_name', v_client_name,
    'professional_name', v_professional_name,
    'preset_result', v_preset_result,
    'action', CASE WHEN v_existing_relationship_id IS NOT NULL THEN 'reactivated' ELSE 'created' END
  );
END;
$$;

-- ============================================================================
-- 4.6.2: RPC - Force disconnect a relationship
-- ============================================================================

CREATE OR REPLACE FUNCTION force_disconnect(
  p_relationship_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_professional_id UUID;
  v_client_name TEXT;
  v_professional_name TEXT;
  v_revoked_count INTEGER := 0;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role required');
  END IF;
  
  -- Validate reason is provided and long enough
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin action requires a reason of at least 10 characters');
  END IF;
  
  -- Get relationship details
  SELECT 
    pcr.client_id, 
    pcr.professional_id,
    c.full_name,
    p.full_name
  INTO 
    v_client_id, 
    v_professional_id,
    v_client_name,
    v_professional_name
  FROM professional_client_relationships pcr
  JOIN profiles c ON c.id = pcr.client_id
  JOIN profiles p ON p.id = pcr.professional_id
  WHERE pcr.id = p_relationship_id AND pcr.status = 'active';
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active relationship not found');
  END IF;
  
  -- Acquire advisory lock on client
  PERFORM pg_advisory_xact_lock(hashtext('client_permissions_' || v_client_id::text));
  
  -- Revoke all active permissions for this relationship
  UPDATE client_permissions
  SET 
    status = 'revoked',
    revoked_at = NOW(),
    revoked_by = p_admin_id
  WHERE relationship_id = p_relationship_id
    AND status = 'active';
  
  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
  
  -- Terminate the relationship
  UPDATE professional_client_relationships
  SET 
    status = 'terminated',
    forced_by_admin = p_admin_id,
    forced_reason = p_reason,
    forced_at = NOW()
  WHERE id = p_relationship_id;
  
  -- Log the event
  PERFORM log_permission_event(
    'admin_override',
    'admin',
    p_admin_id,
    v_client_id,
    p_relationship_id,
    v_professional_id,
    NULL,
    jsonb_build_object('status', 'active', 'permissions_revoked', v_revoked_count),
    jsonb_build_object('status', 'terminated', 'action', 'force_disconnect'),
    p_reason,
    jsonb_build_object(
      'client_name', v_client_name,
      'professional_name', v_professional_name
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'relationship_id', p_relationship_id,
    'client_name', v_client_name,
    'professional_name', v_professional_name,
    'permissions_revoked', v_revoked_count
  );
END;
$$;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

-- Preset management (service_role only)
GRANT EXECUTE ON FUNCTION list_permission_presets TO service_role;
GRANT EXECUTE ON FUNCTION upsert_permission_preset TO service_role;
GRANT EXECUTE ON FUNCTION delete_permission_preset TO service_role;
GRANT EXECUTE ON FUNCTION apply_permission_preset TO service_role;

-- Dashboard (service_role only)
GRANT EXECUTE ON FUNCTION get_admin_kpis TO service_role;
GRANT EXECUTE ON FUNCTION get_permission_activity_feed TO service_role;
GRANT EXECUTE ON FUNCTION get_permission_trends TO service_role;

-- Force connection (service_role only)
GRANT EXECUTE ON FUNCTION force_connect TO service_role;
GRANT EXECUTE ON FUNCTION force_disconnect TO service_role;

-- ============================================================================
-- Insert default system presets
-- ============================================================================

INSERT INTO permission_presets (name, description, is_system, is_active)
VALUES 
  ('Nutritionist', 'Standard permissions for nutrition professionals', true, true),
  ('Personal Trainer', 'Standard permissions for personal trainers', true, true),
  ('Coach', 'Comprehensive permissions for full-service coaches', true, true)
ON CONFLICT (name) DO NOTHING;

-- Add default permissions to system presets
DO $$
DECLARE
  v_nutritionist_id UUID;
  v_trainer_id UUID;
  v_coach_id UUID;
BEGIN
  SELECT id INTO v_nutritionist_id FROM permission_presets WHERE name = 'Nutritionist';
  SELECT id INTO v_trainer_id FROM permission_presets WHERE name = 'Personal Trainer';
  SELECT id INTO v_coach_id FROM permission_presets WHERE name = 'Coach';
  
  -- Nutritionist preset: food and weight related permissions
  IF v_nutritionist_id IS NOT NULL THEN
    INSERT INTO preset_permissions (preset_id, permission_slug, is_enabled)
    SELECT v_nutritionist_id, slug, true
    FROM permission_definitions
    WHERE slug IN ('view_food_log', 'view_weight', 'write_food_log', 'write_weight')
    ON CONFLICT (preset_id, permission_slug) DO NOTHING;
  END IF;
  
  -- Personal Trainer preset: workout related permissions
  IF v_trainer_id IS NOT NULL THEN
    INSERT INTO preset_permissions (preset_id, permission_slug, is_enabled)
    SELECT v_trainer_id, slug, true
    FROM permission_definitions
    WHERE slug IN ('view_workouts', 'view_weight', 'write_workouts', 'assign_routines')
    ON CONFLICT (preset_id, permission_slug) DO NOTHING;
  END IF;
  
  -- Coach preset: all permissions
  IF v_coach_id IS NOT NULL THEN
    INSERT INTO preset_permissions (preset_id, permission_slug, is_enabled)
    SELECT v_coach_id, slug, true
    FROM permission_definitions
    WHERE is_enabled = true
    ON CONFLICT (preset_id, permission_slug) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- TRANSACTION END
-- ============================================================================
COMMIT;

-- ============================================================================
-- Verification queries (for testing after migration)
-- ============================================================================

-- Verify presets table exists:
-- SELECT * FROM permission_presets;

-- Verify preset_permissions:
-- SELECT pp.name, pd.display_name, prp.is_enabled
-- FROM preset_permissions prp
-- JOIN permission_presets pp ON pp.id = prp.preset_id
-- JOIN permission_definitions pd ON pd.slug = prp.permission_slug
-- ORDER BY pp.name, pd.display_name;

-- Test list presets:
-- SELECT * FROM list_permission_presets(10, 0, true);

-- Test KPIs:
-- SELECT * FROM get_admin_kpis();
