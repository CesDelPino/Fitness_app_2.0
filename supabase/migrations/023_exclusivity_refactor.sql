-- Migration: 023_exclusivity_refactor.sql
-- Purpose: Refactor exclusivity enforcement to support admin toggles
-- Dependencies: Must run AFTER 022_audit_logging.sql
-- This allows admins to dynamically change which permissions are exclusive
-- without requiring schema changes or redeployments.

-- Problem: Current partial unique index hard-codes exclusive permission slugs,
-- preventing admin toggles.
-- Solution: Use a trigger-maintained column that mirrors is_exclusive from
-- permission_definitions, allowing dynamic exclusivity changes.

-- ============================================================================
-- TRANSACTION START - All changes are atomic
-- ============================================================================
BEGIN;

-- Verify dependency: audit log table must exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'permission_audit_log') THEN
    RAISE EXCEPTION 'Migration 022_audit_logging.sql must be applied first. The permission_audit_log table is required.';
  END IF;
END $$;

-- ============================================================================
-- 4.1.1: Add perm_is_exclusive column with trigger maintenance
-- ============================================================================

-- Lock the table to prevent concurrent modifications during migration
LOCK TABLE client_permissions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE permission_definitions IN ACCESS EXCLUSIVE MODE;

-- Add the column (not generated, trigger-maintained)
-- PostgreSQL stored generated columns cannot reference other tables,
-- so we use a trigger-maintained column instead.
ALTER TABLE client_permissions
ADD COLUMN IF NOT EXISTS perm_is_exclusive BOOLEAN DEFAULT FALSE;

-- Backfill existing rows from permission_definitions
UPDATE client_permissions cp
SET perm_is_exclusive = pd.is_exclusive
FROM permission_definitions pd
WHERE cp.permission_slug = pd.slug
  AND (cp.perm_is_exclusive IS NULL OR cp.perm_is_exclusive IS DISTINCT FROM pd.is_exclusive);

-- Function to sync perm_is_exclusive on INSERT/UPDATE of client_permissions
CREATE OR REPLACE FUNCTION sync_perm_is_exclusive()
RETURNS TRIGGER AS $$
BEGIN
  SELECT is_exclusive INTO NEW.perm_is_exclusive
  FROM permission_definitions
  WHERE slug = NEW.permission_slug;
  
  -- If permission not found, default to false
  IF NEW.perm_is_exclusive IS NULL THEN
    NEW.perm_is_exclusive := FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for client_permissions INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_sync_perm_is_exclusive ON client_permissions;
CREATE TRIGGER trg_sync_perm_is_exclusive
BEFORE INSERT OR UPDATE OF permission_slug ON client_permissions
FOR EACH ROW EXECUTE FUNCTION sync_perm_is_exclusive();

-- ============================================================================
-- 4.1.1 (continued): Cascade exclusivity changes from permission_definitions
-- ============================================================================

-- Function to cascade exclusivity changes when permission_definitions is updated
-- Uses SECURITY DEFINER with restricted search_path for safety
CREATE OR REPLACE FUNCTION cascade_exclusivity_change()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_count INTEGER;
BEGIN
  IF OLD.is_exclusive IS DISTINCT FROM NEW.is_exclusive THEN
    -- Update all client_permissions for this permission slug
    UPDATE client_permissions
    SET perm_is_exclusive = NEW.is_exclusive
    WHERE permission_slug = NEW.slug;
    
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    
    -- Log this policy change to the audit log using the existing RPC
    -- The RPC handles all validation and uses SECURITY DEFINER to bypass RLS
    PERFORM log_permission_event(
      'policy_change',                                    -- p_event_type
      'system',                                           -- p_actor_type
      '00000000-0000-0000-0000-000000000000'::uuid,      -- p_actor_id (system)
      NULL,                                               -- p_target_client_id
      NULL,                                               -- p_target_relationship_id
      NULL,                                               -- p_target_professional_id
      NEW.slug,                                           -- p_permission_slug
      jsonb_build_object('is_exclusive', OLD.is_exclusive),  -- p_previous_state
      jsonb_build_object('is_exclusive', NEW.is_exclusive),  -- p_new_state
      CASE 
        WHEN NEW.is_exclusive THEN 'Permission changed to exclusive via trigger'
        ELSE 'Permission changed to shared via trigger'
      END,                                                -- p_reason
      jsonb_build_object('affected_grants', v_affected_count) -- p_metadata
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for permission_definitions exclusivity changes
DROP TRIGGER IF EXISTS trg_cascade_exclusivity_change ON permission_definitions;
CREATE TRIGGER trg_cascade_exclusivity_change
AFTER UPDATE OF is_exclusive ON permission_definitions
FOR EACH ROW EXECUTE FUNCTION cascade_exclusivity_change();

-- ============================================================================
-- 4.1.2: Replace hard-coded partial index with dynamic index
-- ============================================================================

-- Drop old hard-coded index (if exists)
DROP INDEX IF EXISTS idx_exclusive_permission_one_holder;

-- Create new dynamic index that respects the perm_is_exclusive column
-- This index ensures only one professional can hold a granted exclusive permission per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusive_permission_dynamic
ON client_permissions (client_id, permission_slug)
WHERE status = 'granted' AND perm_is_exclusive = TRUE;

-- ============================================================================
-- 4.1.3: RLS policy for admin writes to permission_definitions
-- ============================================================================

-- Allow service-role to modify permission_definitions.is_exclusive
-- The trigger automatically cascades to client_permissions.perm_is_exclusive
-- and the unique index automatically respects new exclusivity settings

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS permission_definitions_admin_update ON permission_definitions;

CREATE POLICY permission_definitions_admin_update ON permission_definitions
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- 4.1.4: RPC to check exclusivity conflicts before toggling
-- ============================================================================

-- This RPC checks for duplicate grants that would violate exclusivity
-- when changing a permission from shared to exclusive
-- Uses SECURITY DEFINER to bypass RLS for reading relationship data
CREATE OR REPLACE FUNCTION check_exclusivity_conflicts(
  p_permission_slug VARCHAR(50)
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  grant_count BIGINT,
  professional_names TEXT[]
) 
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
    cp.client_id,
    COALESCE(p.display_name, 'Unknown')::TEXT as client_name,
    COUNT(*)::BIGINT as grant_count,
    ARRAY_AGG(COALESCE(pro.display_name, 'Unknown'))::TEXT[] as professional_names
  FROM client_permissions cp
  LEFT JOIN professional_client_relationships pcr ON pcr.id = cp.relationship_id
  LEFT JOIN profiles p ON p.id = cp.client_id
  LEFT JOIN profiles pro ON pro.id = pcr.professional_id
  WHERE cp.permission_slug = p_permission_slug
    AND cp.status = 'granted'
  GROUP BY cp.client_id, p.display_name
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4.1.4 (continued): RPC to toggle exclusivity with conflict checking
-- ============================================================================

CREATE OR REPLACE FUNCTION toggle_permission_exclusivity(
  p_permission_slug VARCHAR(50),
  p_new_is_exclusive BOOLEAN,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_is_exclusive BOOLEAN;
  v_conflict_count INTEGER;
  v_permission_name TEXT;
BEGIN
  -- Verify caller has service_role - CRITICAL security check
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Access denied: service_role required'
    );
  END IF;

  -- Validate admin reason is provided
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Admin action requires a reason of at least 10 characters'
    );
  END IF;

  -- Get current state
  SELECT is_exclusive, display_name INTO v_current_is_exclusive, v_permission_name
  FROM permission_definitions
  WHERE slug = p_permission_slug;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Permission not found: ' || p_permission_slug
    );
  END IF;
  
  -- If no change, return early
  IF v_current_is_exclusive = p_new_is_exclusive THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'No change needed',
      'is_exclusive', v_current_is_exclusive
    );
  END IF;
  
  -- If changing to exclusive, check for conflicts
  IF p_new_is_exclusive = TRUE THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM (
      SELECT cp.client_id
      FROM client_permissions cp
      WHERE cp.permission_slug = p_permission_slug
        AND cp.status = 'granted'
      GROUP BY cp.client_id
      HAVING COUNT(*) > 1
    ) conflicts;
    
    IF v_conflict_count > 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Cannot enable exclusivity: ' || v_conflict_count || ' clients have multiple grants',
        'conflict_count', v_conflict_count,
        'action_required', 'Use check_exclusivity_conflicts to see details and resolve before retrying'
      );
    END IF;
  END IF;
  
  -- Update the permission definition (trigger will cascade to client_permissions)
  UPDATE permission_definitions
  SET is_exclusive = p_new_is_exclusive
  WHERE slug = p_permission_slug;
  
  -- Log the admin action to audit log using existing RPC
  -- The trigger also logs with 'system' actor, but this provides explicit admin attribution
  PERFORM log_permission_event(
    'policy_change',                                    -- p_event_type
    'admin',                                            -- p_actor_type
    p_admin_id,                                         -- p_actor_id
    NULL,                                               -- p_target_client_id
    NULL,                                               -- p_target_relationship_id
    NULL,                                               -- p_target_professional_id
    p_permission_slug,                                  -- p_permission_slug
    jsonb_build_object('is_exclusive', v_current_is_exclusive),  -- p_previous_state
    jsonb_build_object('is_exclusive', p_new_is_exclusive),      -- p_new_state
    p_reason,                                           -- p_reason
    jsonb_build_object(
      'action', CASE WHEN p_new_is_exclusive THEN 'set_exclusive' ELSE 'set_shared' END,
      'permission_name', v_permission_name
    )                                                   -- p_metadata
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Exclusivity updated successfully',
    'permission_slug', p_permission_slug,
    'is_exclusive', p_new_is_exclusive,
    'previous_is_exclusive', v_current_is_exclusive
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grant execute permissions (only for external RPCs, not internal triggers)
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_exclusivity_conflicts(VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION toggle_permission_exclusivity(VARCHAR, BOOLEAN, UUID, TEXT) TO service_role;

-- ============================================================================
-- TRANSACTION END
-- ============================================================================
COMMIT;

-- ============================================================================
-- Verification queries (for testing after migration)
-- ============================================================================

-- Verify perm_is_exclusive is properly synced:
-- SELECT cp.permission_slug, cp.perm_is_exclusive, pd.is_exclusive,
--        cp.perm_is_exclusive = pd.is_exclusive as synced
-- FROM client_permissions cp
-- JOIN permission_definitions pd ON pd.slug = cp.permission_slug
-- WHERE cp.perm_is_exclusive IS DISTINCT FROM pd.is_exclusive;

-- Verify dynamic index exists:
-- SELECT indexname, indexdef FROM pg_indexes 
-- WHERE indexname = 'idx_exclusive_permission_dynamic';

-- Check for any existing conflicts:
-- SELECT * FROM check_exclusivity_conflicts('assign_programmes');
