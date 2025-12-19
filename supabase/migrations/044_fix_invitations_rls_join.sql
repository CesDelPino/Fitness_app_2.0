-- Migration 044: Fix invitations RLS to use professional_profiles join
-- 
-- Problem: The RLS policy checked auth.uid() = professional_id, but professional_id
-- is the professional_profiles.id (not the user's profiles.id/auth.uid()).
-- This caused professionals to not see their own invitations.
--
-- Fix: Join through professional_profiles to match the user ID correctly.

BEGIN;

DROP POLICY IF EXISTS "Professionals can read own invitations" ON invitations;
CREATE POLICY "Professionals can read own invitations"
  ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_profiles pp 
      WHERE pp.id = invitations.professional_id 
      AND pp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Professionals can update own invitations" ON invitations;
CREATE POLICY "Professionals can update own invitations"
  ON invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM professional_profiles pp 
      WHERE pp.id = invitations.professional_id 
      AND pp.user_id = (select auth.uid())
    )
    AND status = 'pending'::invitation_status
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professional_profiles pp 
      WHERE pp.id = invitations.professional_id 
      AND pp.user_id = (select auth.uid())
    )
    AND status = ANY (ARRAY['pending'::invitation_status, 'expired'::invitation_status])
  );

COMMIT;
