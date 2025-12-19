-- Migration 027: Fix professional_id join in RLS policies and functions
-- 
-- ISSUE: Migration 020 incorrectly joins professional_profiles.id with 
-- professional_client_relationships.professional_id, but:
--   - professional_client_relationships.professional_id = auth user ID (profiles.id)
--   - professional_profiles.id = auto-generated UUID (NOT auth user ID)
--   - professional_profiles.user_id = auth user ID (matches profiles.id)
--
-- This caused "Unknown Professional" to appear because the join never matched.

-- 1. Fix RLS policy "Professionals can view their client permissions"
DROP POLICY IF EXISTS "Professionals can view their client permissions" ON client_permissions;
CREATE POLICY "Professionals can view their client permissions"
  ON client_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.user_id = pcr.professional_id
      WHERE pcr.id = client_permissions.relationship_id
      AND pp.user_id = auth.uid()
      AND pcr.status = 'active'
    )
  );

-- 2. Fix has_permission function to use correct join
CREATE OR REPLACE FUNCTION has_permission(p_professional_user_id UUID, p_client_id UUID, p_permission_slug VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM client_permissions cp
    JOIN professional_client_relationships pcr ON pcr.id = cp.relationship_id
    JOIN professional_profiles pp ON pp.user_id = pcr.professional_id
    WHERE pp.user_id = p_professional_user_id
    AND pcr.client_id = p_client_id
    AND pcr.status = 'active'
    AND cp.permission_slug = p_permission_slug
    AND cp.status = 'granted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add index for better performance on the corrected join pattern
CREATE INDEX IF NOT EXISTS idx_professional_profiles_user_id 
ON professional_profiles(user_id);
