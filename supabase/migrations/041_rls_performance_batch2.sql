-- Migration 041: RLS Performance Fix - Batch 2
-- Tables: invitations, professional_client_relationships, professional_profiles
-- Fix: Replace auth.uid() with (select auth.uid()) to prevent per-row re-evaluation
-- Each table wrapped in transaction for safety

-- ============================================
-- INVITATIONS TABLE (2 policies)
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Professionals can read own invitations" ON invitations;
CREATE POLICY "Professionals can read own invitations"
  ON invitations FOR SELECT
  USING ((select auth.uid()) = professional_id);

DROP POLICY IF EXISTS "Professionals can update own invitations" ON invitations;
CREATE POLICY "Professionals can update own invitations"
  ON invitations FOR UPDATE
  USING (((select auth.uid()) = professional_id) AND (status = 'pending'::invitation_status))
  WITH CHECK (((select auth.uid()) = professional_id) AND (status = ANY (ARRAY['pending'::invitation_status, 'expired'::invitation_status])));

COMMIT;

-- ============================================
-- PROFESSIONAL_CLIENT_RELATIONSHIPS TABLE (4 policies)
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Clients can read own relationships" ON professional_client_relationships;
CREATE POLICY "Clients can read own relationships"
  ON professional_client_relationships FOR SELECT
  USING ((select auth.uid()) = client_id);

DROP POLICY IF EXISTS "Professionals can read own relationships" ON professional_client_relationships;
CREATE POLICY "Professionals can read own relationships"
  ON professional_client_relationships FOR SELECT
  USING ((select auth.uid()) = professional_id);

DROP POLICY IF EXISTS "Clients can end relationships" ON professional_client_relationships;
CREATE POLICY "Clients can end relationships"
  ON professional_client_relationships FOR UPDATE
  USING (((select auth.uid()) = client_id) AND (status = 'active'::relationship_status))
  WITH CHECK (status = 'ended'::relationship_status);

DROP POLICY IF EXISTS "Professionals can end relationships" ON professional_client_relationships;
CREATE POLICY "Professionals can end relationships"
  ON professional_client_relationships FOR UPDATE
  USING (((select auth.uid()) = professional_id) AND (status = 'active'::relationship_status))
  WITH CHECK (status = 'ended'::relationship_status);

COMMIT;

-- ============================================
-- PROFESSIONAL_PROFILES TABLE (2 policies that use auth.uid())
-- Note: "Anyone can read professional profiles" uses USING(true) - no fix needed
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Professionals can create own profile" ON professional_profiles;
CREATE POLICY "Professionals can create own profile"
  ON professional_profiles FOR INSERT
  WITH CHECK (
    ((select auth.uid()) = user_id) 
    AND (
      (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = 'professional'::user_role
    )
  );

DROP POLICY IF EXISTS "Professionals can update own profile" ON professional_profiles;
CREATE POLICY "Professionals can update own profile"
  ON professional_profiles FOR UPDATE
  USING ((select auth.uid()) = user_id);

COMMIT;
