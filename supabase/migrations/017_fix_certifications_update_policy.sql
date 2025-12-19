-- Migration: Fix professional_certifications UPDATE policy
-- Adds WITH CHECK clause to prevent cross-user reassignment

-- Drop the existing update policy
DROP POLICY IF EXISTS "Professionals can update own certifications" ON professional_certifications;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Professionals can update own certifications"
  ON professional_certifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
