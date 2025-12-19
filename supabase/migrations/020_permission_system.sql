-- Permission System Tables Migration
-- Run this in Supabase SQL Editor

-- 1. Create permission_definitions table (admin-configurable)
CREATE TABLE IF NOT EXISTS permission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('nutrition', 'workouts', 'weight', 'photos', 'checkins', 'fasting', 'profile')),
  permission_type VARCHAR(10) NOT NULL CHECK (permission_type IN ('read', 'write')),
  is_exclusive BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  requires_verification BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create client_permissions table (with client_id from the start)
CREATE TABLE IF NOT EXISTS client_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES professional_client_relationships(id) ON DELETE CASCADE,
  permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'granted' CHECK (status IN ('pending', 'granted', 'revoked')),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by VARCHAR(20) DEFAULT 'client' CHECK (granted_by IN ('client', 'admin', 'system')),
  revoked_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(relationship_id, permission_slug)
);

-- 2.5 Add client_id column if table already exists without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_permissions' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE client_permissions ADD COLUMN client_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_permissions_relationship ON client_permissions(relationship_id);
CREATE INDEX IF NOT EXISTS idx_client_permissions_slug ON client_permissions(permission_slug);
CREATE INDEX IF NOT EXISTS idx_client_permissions_status ON client_permissions(status);
CREATE INDEX IF NOT EXISTS idx_client_permissions_client ON client_permissions(client_id);

-- 4. Seed initial permission definitions

-- Shared (Read) Permissions
INSERT INTO permission_definitions (slug, display_name, description, category, permission_type, is_exclusive, sort_order) VALUES
  ('view_nutrition', 'View Nutrition Logs', 'View food logs and intake history', 'nutrition', 'read', FALSE, 10),
  ('view_workouts', 'View Workout Sessions', 'View completed workout sessions and exercise history', 'workouts', 'read', FALSE, 20),
  ('view_weight', 'View Weight Data', 'View weigh-ins and body measurements', 'weight', 'read', FALSE, 30),
  ('view_progress_photos', 'View Progress Photos', 'View uploaded progress photos', 'photos', 'read', FALSE, 40),
  ('view_fasting', 'View Fasting Data', 'View fasting history and patterns', 'fasting', 'read', FALSE, 50),
  ('view_checkins', 'View Check-in Submissions', 'View submitted weekly check-ins', 'checkins', 'read', FALSE, 60),
  ('view_profile', 'View Profile Information', 'View basic profile information (height, age, etc.)', 'profile', 'read', FALSE, 70)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  permission_type = EXCLUDED.permission_type,
  is_exclusive = EXCLUDED.is_exclusive,
  sort_order = EXCLUDED.sort_order;

-- Exclusive (Write) Permissions
INSERT INTO permission_definitions (slug, display_name, description, category, permission_type, is_exclusive, sort_order) VALUES
  ('set_nutrition_targets', 'Set Nutrition Targets', 'Set calorie, macro, and micronutrient goals', 'nutrition', 'write', TRUE, 15),
  ('set_weight_targets', 'Set Weight Targets', 'Set goal weight and body composition targets', 'weight', 'write', TRUE, 35),
  ('assign_programmes', 'Assign Workout Programmes', 'Create and assign workout programmes', 'workouts', 'write', TRUE, 25),
  ('assign_checkins', 'Assign Check-in Templates', 'Assign weekly check-in templates', 'checkins', 'write', TRUE, 65),
  ('set_fasting_schedule', 'Set Fasting Schedule', 'Configure fasting windows and schedules', 'fasting', 'write', TRUE, 55)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  permission_type = EXCLUDED.permission_type,
  is_exclusive = EXCLUDED.is_exclusive,
  sort_order = EXCLUDED.sort_order;

-- 5. Enable Row Level Security
ALTER TABLE permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_permissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for permission_definitions (read-only for all authenticated users)
DROP POLICY IF EXISTS "Anyone can view permission definitions" ON permission_definitions;
CREATE POLICY "Anyone can view permission definitions"
  ON permission_definitions FOR SELECT
  TO authenticated
  USING (is_enabled = TRUE);

-- 7. RLS Policies for client_permissions
-- Professionals can view permissions for their client relationships
DROP POLICY IF EXISTS "Professionals can view their client permissions" ON client_permissions;
CREATE POLICY "Professionals can view their client permissions"
  ON client_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.id = pcr.professional_id
      WHERE pcr.id = client_permissions.relationship_id
      AND pp.user_id = auth.uid()
      AND pcr.status = 'active'
    )
  );

-- Clients can view and manage permissions for their relationships
DROP POLICY IF EXISTS "Clients can view their permissions" ON client_permissions;
CREATE POLICY "Clients can view their permissions"
  ON client_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      WHERE pcr.id = client_permissions.relationship_id
      AND pcr.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can update their permissions" ON client_permissions;
CREATE POLICY "Clients can update their permissions"
  ON client_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      WHERE pcr.id = client_permissions.relationship_id
      AND pcr.client_id = auth.uid()
    )
  );

-- 8. Migration function to create permissions from existing role_type
-- This converts existing relationships to the new permission system
CREATE OR REPLACE FUNCTION migrate_role_to_permissions(p_relationship_id UUID, p_role_type TEXT)
RETURNS VOID AS $$
DECLARE
  nutritionist_permissions TEXT[] := ARRAY['view_nutrition', 'view_weight', 'view_profile', 'set_nutrition_targets'];
  trainer_permissions TEXT[] := ARRAY['view_workouts', 'view_weight', 'view_profile', 'assign_programmes', 'assign_checkins'];
  coach_permissions TEXT[] := ARRAY['view_nutrition', 'view_workouts', 'view_weight', 'view_progress_photos', 'view_fasting', 'view_checkins', 'view_profile', 'set_nutrition_targets', 'set_weight_targets', 'assign_programmes', 'assign_checkins', 'set_fasting_schedule'];
  perms TEXT[];
  perm TEXT;
  v_client_id UUID;
BEGIN
  -- Get client_id from relationship
  SELECT client_id INTO v_client_id
  FROM professional_client_relationships
  WHERE id = p_relationship_id;

  -- Select permissions based on role type
  CASE p_role_type
    WHEN 'nutritionist' THEN perms := nutritionist_permissions;
    WHEN 'trainer' THEN perms := trainer_permissions;
    WHEN 'coach' THEN perms := coach_permissions;
    ELSE perms := ARRAY[]::TEXT[];
  END CASE;

  -- Insert permissions
  FOREACH perm IN ARRAY perms
  LOOP
    INSERT INTO client_permissions (relationship_id, permission_slug, status, granted_by, client_id)
    VALUES (p_relationship_id, perm, 'granted', 'system', v_client_id)
    ON CONFLICT (relationship_id, permission_slug) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. Run migration for all existing active relationships
DO $$
DECLARE
  rel RECORD;
BEGIN
  FOR rel IN SELECT id, role_type::TEXT FROM professional_client_relationships WHERE status = 'active'
  LOOP
    PERFORM migrate_role_to_permissions(rel.id, rel.role_type);
  END LOOP;
END $$;

-- 10. Create helper function to check if professional has permission
CREATE OR REPLACE FUNCTION has_permission(p_professional_user_id UUID, p_client_id UUID, p_permission_slug VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM client_permissions cp
    JOIN professional_client_relationships pcr ON pcr.id = cp.relationship_id
    JOIN professional_profiles pp ON pp.id = pcr.professional_id
    WHERE pp.user_id = p_professional_user_id
    AND pcr.client_id = p_client_id
    AND pcr.status = 'active'
    AND cp.permission_slug = p_permission_slug
    AND cp.status = 'granted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Transactional function for atomic exclusive permission grant
-- This function atomically revokes the permission from any current holder and grants it to the new one
-- Uses advisory lock to serialize access and prevent race conditions
CREATE OR REPLACE FUNCTION grant_exclusive_permission(
  p_relationship_id UUID,
  p_permission_slug VARCHAR,
  p_granted_by VARCHAR DEFAULT 'client'
)
RETURNS JSON AS $$
DECLARE
  v_client_id UUID;
  v_is_exclusive BOOLEAN;
  v_previous_holder UUID;
  v_lock_key BIGINT;
BEGIN
  -- Verify the permission is exclusive
  SELECT is_exclusive INTO v_is_exclusive
  FROM permission_definitions
  WHERE slug = p_permission_slug;
  
  IF v_is_exclusive IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Permission not found');
  END IF;
  
  IF NOT v_is_exclusive THEN
    RETURN json_build_object('success', false, 'error', 'Permission is not exclusive - use regular grant');
  END IF;
  
  -- Get the client ID from the relationship
  SELECT client_id INTO v_client_id
  FROM professional_client_relationships
  WHERE id = p_relationship_id AND status = 'active';
  
  IF v_client_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Relationship not found or inactive');
  END IF;
  
  -- Generate a consistent lock key from client_id and permission_slug
  -- This ensures only one transaction per (client, permission) can proceed at a time
  v_lock_key := hashtext(v_client_id::text || ':' || p_permission_slug);
  
  -- Acquire advisory lock - this serializes access for this (client, permission) pair
  -- pg_advisory_xact_lock is released automatically at end of transaction
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- Now we have exclusive access - find any existing holder
  SELECT cp.relationship_id INTO v_previous_holder
  FROM client_permissions cp
  JOIN professional_client_relationships pcr ON pcr.id = cp.relationship_id
  WHERE pcr.client_id = v_client_id
    AND pcr.status = 'active'
    AND cp.permission_slug = p_permission_slug
    AND cp.status = 'granted'
    AND cp.relationship_id != p_relationship_id
  LIMIT 1;
  
  -- Atomic operation: Revoke from previous holder if exists, then grant to new holder
  -- This happens atomically within our advisory lock
  IF v_previous_holder IS NOT NULL THEN
    UPDATE client_permissions
    SET status = 'revoked', revoked_at = NOW()
    WHERE relationship_id = v_previous_holder
      AND permission_slug = p_permission_slug;
  END IF;
  
  -- Grant to new holder (upsert) - includes client_id for the partial unique index
  INSERT INTO client_permissions (relationship_id, permission_slug, status, granted_at, granted_by, client_id)
  VALUES (p_relationship_id, p_permission_slug, 'granted', NOW(), p_granted_by, v_client_id)
  ON CONFLICT (relationship_id, permission_slug)
  DO UPDATE SET status = 'granted', granted_at = NOW(), granted_by = p_granted_by, revoked_at = NULL, client_id = v_client_id;
  
  -- Advisory lock is automatically released when transaction commits/rolls back
  
  RETURN json_build_object(
    'success', true,
    'previous_holder_revoked', v_previous_holder IS NOT NULL,
    'previous_holder_id', v_previous_holder
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Safety net: partial unique index caught a violation (shouldn't happen with advisory lock)
    RETURN json_build_object(
      'success', false,
      'error', 'Permission conflict detected. Please refresh and try again.'
    );
  WHEN OTHERS THEN
    -- Re-raise unexpected errors
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create partial unique index to enforce exclusivity at database level
-- This makes duplicate exclusive grants IMPOSSIBLE
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusive_permission_one_holder
ON client_permissions (client_id, permission_slug)
WHERE status = 'granted' AND permission_slug IN (
  'set_nutrition_targets',
  'set_weight_targets',
  'assign_programmes',
  'assign_checkins',
  'set_fasting_schedule'
);

-- 13. Create trigger to auto-populate client_id on insert
CREATE OR REPLACE FUNCTION set_client_id_on_permission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    SELECT client_id INTO NEW.client_id
    FROM professional_client_relationships
    WHERE id = NEW.relationship_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_client_id_trigger ON client_permissions;
CREATE TRIGGER set_client_id_trigger
  BEFORE INSERT ON client_permissions
  FOR EACH ROW
  EXECUTE FUNCTION set_client_id_on_permission();

-- 14. Transactional function for granting non-exclusive (shared) permissions
CREATE OR REPLACE FUNCTION grant_shared_permission(
  p_relationship_id UUID,
  p_permission_slug VARCHAR,
  p_granted_by VARCHAR DEFAULT 'client'
)
RETURNS JSON AS $$
DECLARE
  v_is_exclusive BOOLEAN;
  v_client_id UUID;
BEGIN
  -- Verify the permission exists and is not exclusive
  SELECT is_exclusive INTO v_is_exclusive
  FROM permission_definitions
  WHERE slug = p_permission_slug;
  
  IF v_is_exclusive IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Permission not found');
  END IF;
  
  IF v_is_exclusive THEN
    RETURN json_build_object('success', false, 'error', 'Permission is exclusive - use grant_exclusive_permission');
  END IF;
  
  -- Get client_id from relationship
  SELECT client_id INTO v_client_id
  FROM professional_client_relationships
  WHERE id = p_relationship_id;
  
  -- Grant the permission (upsert)
  INSERT INTO client_permissions (relationship_id, permission_slug, status, granted_at, granted_by, client_id)
  VALUES (p_relationship_id, p_permission_slug, 'granted', NOW(), p_granted_by, v_client_id)
  ON CONFLICT (relationship_id, permission_slug)
  DO UPDATE SET status = 'granted', granted_at = NOW(), granted_by = p_granted_by, revoked_at = NULL, client_id = v_client_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Backfill client_id for any existing permissions that don't have it
UPDATE client_permissions cp
SET client_id = pcr.client_id
FROM professional_client_relationships pcr
WHERE cp.relationship_id = pcr.id
AND cp.client_id IS NULL;

-- 16. Add NOT NULL constraint to client_id after backfill
-- This ensures the partial unique index can properly enforce exclusivity
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  -- First check if there are any remaining NULLs
  SELECT COUNT(*) INTO null_count FROM client_permissions WHERE client_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: % rows still have NULL client_id. Please fix data first.', null_count;
  END IF;
  
  -- Check if NOT NULL already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_permissions' 
    AND column_name = 'client_id' 
    AND is_nullable = 'NO'
  ) THEN
    RAISE NOTICE 'client_id NOT NULL constraint already exists';
  ELSE
    ALTER TABLE client_permissions ALTER COLUMN client_id SET NOT NULL;
    RAISE NOTICE 'Successfully added NOT NULL constraint to client_id';
  END IF;
END $$;
