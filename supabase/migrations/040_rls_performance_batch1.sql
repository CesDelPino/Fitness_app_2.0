-- Migration 040: RLS Performance Fix - Batch 1
-- Tables: profiles, food_logs, weigh_ins, workout_sessions
-- Fix: Replace auth.uid() with (select auth.uid()) to prevent per-row re-evaluation
-- Each table wrapped in transaction for safety

-- ============================================
-- PROFILES TABLE (4 policies)
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Professionals can read client profiles" ON profiles;
CREATE POLICY "Professionals can read client profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships
      WHERE professional_client_relationships.professional_id = (select auth.uid())
      AND professional_client_relationships.client_id = profiles.id
      AND professional_client_relationships.status = 'active'::relationship_status
    )
  );

DROP POLICY IF EXISTS "Clients can read professional profiles" ON profiles;
CREATE POLICY "Clients can read professional profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships
      WHERE professional_client_relationships.client_id = (select auth.uid())
      AND professional_client_relationships.professional_id = profiles.id
      AND professional_client_relationships.status = 'active'::relationship_status
    )
  );

COMMIT;

-- ============================================
-- FOOD_LOGS TABLE (6 policies)
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Clients can read own food logs" ON food_logs;
CREATE POLICY "Clients can read own food logs"
  ON food_logs FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can create own food logs" ON food_logs;
CREATE POLICY "Clients can create own food logs"
  ON food_logs FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id) AND ((select auth.uid()) = logged_by_user_id));

DROP POLICY IF EXISTS "Clients can update own food logs" ON food_logs;
CREATE POLICY "Clients can update own food logs"
  ON food_logs FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can delete own food logs" ON food_logs;
CREATE POLICY "Clients can delete own food logs"
  ON food_logs FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Nutritionists can read client food logs" ON food_logs;
CREATE POLICY "Nutritionists can read client food logs"
  ON food_logs FOR SELECT
  USING (has_active_relationship((select auth.uid()), user_id, ARRAY['nutritionist'::text, 'coach'::text]));

DROP POLICY IF EXISTS "Nutritionists can create client food logs" ON food_logs;
CREATE POLICY "Nutritionists can create client food logs"
  ON food_logs FOR INSERT
  WITH CHECK (has_active_relationship((select auth.uid()), user_id, ARRAY['nutritionist'::text, 'coach'::text]) AND ((select auth.uid()) = logged_by_user_id));

COMMIT;

-- ============================================
-- WEIGH_INS TABLE (5 policies)
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Clients can read own weigh-ins" ON weigh_ins;
CREATE POLICY "Clients can read own weigh-ins"
  ON weigh_ins FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can create own weigh-ins" ON weigh_ins;
CREATE POLICY "Clients can create own weigh-ins"
  ON weigh_ins FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can update own weigh-ins" ON weigh_ins;
CREATE POLICY "Clients can update own weigh-ins"
  ON weigh_ins FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can delete own weigh-ins" ON weigh_ins;
CREATE POLICY "Clients can delete own weigh-ins"
  ON weigh_ins FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Professionals can read client weigh-ins" ON weigh_ins;
CREATE POLICY "Professionals can read client weigh-ins"
  ON weigh_ins FOR SELECT
  USING (has_active_relationship((select auth.uid()), user_id, ARRAY['nutritionist'::text, 'trainer'::text, 'coach'::text]));

COMMIT;

-- ============================================
-- WORKOUT_SESSIONS TABLE (6 policies)
-- ============================================
BEGIN;

DROP POLICY IF EXISTS "Clients can read own workouts" ON workout_sessions;
CREATE POLICY "Clients can read own workouts"
  ON workout_sessions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can create own workouts" ON workout_sessions;
CREATE POLICY "Clients can create own workouts"
  ON workout_sessions FOR INSERT
  WITH CHECK (((select auth.uid()) = user_id) AND ((select auth.uid()) = logged_by_user_id));

DROP POLICY IF EXISTS "Clients can update own workouts" ON workout_sessions;
CREATE POLICY "Clients can update own workouts"
  ON workout_sessions FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can delete own workouts" ON workout_sessions;
CREATE POLICY "Clients can delete own workouts"
  ON workout_sessions FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Trainers can read client workouts" ON workout_sessions;
CREATE POLICY "Trainers can read client workouts"
  ON workout_sessions FOR SELECT
  USING (has_active_relationship((select auth.uid()), user_id, ARRAY['trainer'::text, 'coach'::text]));

DROP POLICY IF EXISTS "Trainers can create client workouts" ON workout_sessions;
CREATE POLICY "Trainers can create client workouts"
  ON workout_sessions FOR INSERT
  WITH CHECK (has_active_relationship((select auth.uid()), user_id, ARRAY['trainer'::text, 'coach'::text]) AND ((select auth.uid()) = logged_by_user_id));

COMMIT;
