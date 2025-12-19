-- LOBA SaaS Migration: RLS Policies for Health Data Tables
-- Phase 1c: Row-Level Security policies for all health tracking tables

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE fasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_activities ENABLE ROW LEVEL SECURITY;
-- Note: cardio_activities, foods, food_barcodes, food_aliases are shared reference data
-- They need different policies (read-only for authenticated users)
ALTER TABLE cardio_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_aliases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FASTS TABLE POLICIES
-- Users can manage their own fasts
-- Professionals can view client fasts based on relationship type
-- ============================================

CREATE POLICY "Users can view own fasts"
  ON fasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fasts"
  ON fasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fasts"
  ON fasts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fasts"
  ON fasts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Nutritionists and coaches can view client fasts"
  ON fasts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      WHERE pcr.client_id = fasts.user_id
      AND pcr.professional_id = auth.uid()
      AND pcr.status = 'active'
      AND pcr.role_type IN ('nutritionist', 'coach')
    )
  );

-- ============================================
-- DAILY SUMMARIES TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view own daily summaries"
  ON daily_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily summaries"
  ON daily_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily summaries"
  ON daily_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily summaries"
  ON daily_summaries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Nutritionists and coaches can view client daily summaries"
  ON daily_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      WHERE pcr.client_id = daily_summaries.user_id
      AND pcr.professional_id = auth.uid()
      AND pcr.status = 'active'
      AND pcr.role_type IN ('nutritionist', 'coach')
    )
  );

-- ============================================
-- WORKOUT ROUTINES TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view own workout routines"
  ON workout_routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout routines"
  ON workout_routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout routines"
  ON workout_routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout routines"
  ON workout_routines FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers and coaches can view client workout routines"
  ON workout_routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      WHERE pcr.client_id = workout_routines.user_id
      AND pcr.professional_id = auth.uid()
      AND pcr.status = 'active'
      AND pcr.role_type IN ('trainer', 'coach')
    )
  );

-- ============================================
-- ROUTINE EXERCISES TABLE POLICIES
-- Access via routine ownership
-- ============================================

CREATE POLICY "Users can view routine exercises they own"
  ON routine_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines wr
      WHERE wr.id = routine_exercises.routine_id
      AND wr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert routine exercises for own routines"
  ON routine_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_routines wr
      WHERE wr.id = routine_id
      AND wr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update routine exercises for own routines"
  ON routine_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines wr
      WHERE wr.id = routine_exercises.routine_id
      AND wr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete routine exercises for own routines"
  ON routine_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines wr
      WHERE wr.id = routine_exercises.routine_id
      AND wr.user_id = auth.uid()
    )
  );

CREATE POLICY "Trainers and coaches can view client routine exercises"
  ON routine_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines wr
      JOIN professional_client_relationships pcr ON pcr.client_id = wr.user_id
      WHERE wr.id = routine_exercises.routine_id
      AND pcr.professional_id = auth.uid()
      AND pcr.status = 'active'
      AND pcr.role_type IN ('trainer', 'coach')
    )
  );

-- ============================================
-- WORKOUT SETS TABLE POLICIES
-- Access via session ownership
-- ============================================

CREATE POLICY "Users can view workout sets from own sessions"
  ON workout_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = workout_sets.session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workout sets for own sessions"
  ON workout_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workout sets for own sessions"
  ON workout_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = workout_sets.session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete workout sets for own sessions"
  ON workout_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = workout_sets.session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Trainers and coaches can view client workout sets"
  ON workout_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      JOIN professional_client_relationships pcr ON pcr.client_id = ws.user_id
      WHERE ws.id = workout_sets.session_id
      AND pcr.professional_id = auth.uid()
      AND pcr.status = 'active'
      AND pcr.role_type IN ('trainer', 'coach')
    )
  );

-- ============================================
-- USER CUSTOM ACTIVITIES TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view own custom activities"
  ON user_custom_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom activities"
  ON user_custom_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom activities"
  ON user_custom_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom activities"
  ON user_custom_activities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CARDIO ACTIVITIES TABLE POLICIES (Reference Data)
-- Read-only for all authenticated users
-- ============================================

CREATE POLICY "Authenticated users can view cardio activities"
  ON cardio_activities FOR SELECT
  TO authenticated
  USING (true);

-- Admin insert (service role only - no policy needed)

-- ============================================
-- FOODS TABLE POLICIES (Shared Cache)
-- All authenticated users can read, service role can write
-- ============================================

CREATE POLICY "Authenticated users can view foods"
  ON foods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert foods"
  ON foods FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update food usage count"
  ON foods FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- FOOD BARCODES TABLE POLICIES
-- ============================================

CREATE POLICY "Authenticated users can view food barcodes"
  ON food_barcodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert food barcodes"
  ON food_barcodes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- FOOD ALIASES TABLE POLICIES
-- ============================================

CREATE POLICY "Authenticated users can view food aliases"
  ON food_aliases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert food aliases"
  ON food_aliases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS FOR DATA ACCESS
-- ============================================

-- Function to check if a user has access to another user's data
CREATE OR REPLACE FUNCTION can_view_user_data(
  target_user_id UUID,
  required_role_type professional_role_type DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- User can always view their own data
  IF auth.uid() = target_user_id THEN
    RETURN true;
  END IF;
  
  -- Check if there's an active professional relationship
  RETURN EXISTS (
    SELECT 1 FROM professional_client_relationships
    WHERE client_id = target_user_id
    AND professional_id = auth.uid()
    AND status = 'active'
    AND (required_role_type IS NULL OR role_type = required_role_type)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get accessible client IDs for a professional
CREATE OR REPLACE FUNCTION get_accessible_clients(
  required_role_type professional_role_type DEFAULT NULL
)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT client_id 
  FROM professional_client_relationships
  WHERE professional_id = auth.uid()
  AND status = 'active'
  AND (required_role_type IS NULL OR role_type = required_role_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
