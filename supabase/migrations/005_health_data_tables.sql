-- LOBA SaaS Migration: Health Data Tables
-- Phase 1b: Add remaining health tracking tables
-- Tables: fasts, daily_summaries, workout_routines, routine_exercises, 
--         workout_sets, cardio_activities, user_custom_activities,
--         foods, food_barcodes, food_aliases

-- ============================================
-- ADDITIONAL ENUMS
-- ============================================

CREATE TYPE fast_status AS ENUM ('active', 'ended');
CREATE TYPE fast_mode AS ENUM ('duration', 'target_time');
CREATE TYPE workout_type AS ENUM ('strength_traditional', 'strength_circuit', 'cardio', 'other');
CREATE TYPE food_source AS ENUM ('barcode', 'ai_text', 'ai_image', 'manual', 'imported');
CREATE TYPE food_verification_status AS ENUM ('verified', 'user_contributed', 'pending');

-- ============================================
-- FASTS TABLE
-- ============================================

CREATE TABLE fasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  actual_end_time TIMESTAMPTZ,
  status fast_status NOT NULL DEFAULT 'active',
  breaking_food_log_id UUID REFERENCES food_logs(id) ON DELETE SET NULL,
  planned_duration_minutes INTEGER,
  fast_mode fast_mode,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fasts_user ON fasts(user_id);
CREATE INDEX idx_fasts_user_status ON fasts(user_id, status);
CREATE UNIQUE INDEX fasts_active_user_unique_idx ON fasts(user_id) WHERE status = 'active';

-- ============================================
-- DAILY SUMMARIES TABLE
-- ============================================

CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  finalized BOOLEAN NOT NULL DEFAULT true,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_calories INTEGER NOT NULL,
  total_protein_g NUMERIC(6,2) NOT NULL,
  total_carbs_g NUMERIC(6,2) NOT NULL,
  total_fat_g NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX daily_summaries_user_date_idx ON daily_summaries(user_id, date);

-- ============================================
-- WORKOUT ROUTINES TABLE
-- ============================================

CREATE TABLE workout_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type workout_type NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_routines_user ON workout_routines(user_id);
CREATE UNIQUE INDEX workout_routines_user_name_idx ON workout_routines(user_id, name);

CREATE TRIGGER update_workout_routines_updated_at
  BEFORE UPDATE ON workout_routines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROUTINE EXERCISES TABLE
-- ============================================

CREATE TABLE routine_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES workout_routines(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  target_sets INTEGER,
  target_reps INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routine_exercises_routine ON routine_exercises(routine_id);

-- ============================================
-- WORKOUT SETS TABLE
-- Stores individual sets within workout sessions
-- ============================================

CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_sets_session ON workout_sets(session_id);

-- ============================================
-- CARDIO ACTIVITIES TABLE (Reference data)
-- Standard activities with MET values
-- ============================================

CREATE TABLE cardio_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_met NUMERIC(4,2) NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USER CUSTOM ACTIVITIES TABLE
-- AI-estimated MET values for custom activities
-- ============================================

CREATE TABLE user_custom_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  estimated_met NUMERIC(4,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX user_custom_activities_user_activity_idx ON user_custom_activities(user_id, activity_name);

-- ============================================
-- FOODS TABLE (Cache)
-- Stores verified food entries to avoid repeat API calls
-- ============================================

CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  brand TEXT,
  source food_source NOT NULL,
  verification_status food_verification_status NOT NULL DEFAULT 'pending',
  calories_per_100g NUMERIC(7,2),
  protein_per_100g NUMERIC(6,2),
  carbs_per_100g NUMERIC(6,2),
  fat_per_100g NUMERIC(6,2),
  fiber_per_100g NUMERIC(6,2),
  sugar_per_100g NUMERIC(6,2),
  default_serving_size TEXT,
  default_serving_grams NUMERIC(6,2),
  calories_per_serving NUMERIC(7,2),
  protein_per_serving NUMERIC(6,2),
  carbs_per_serving NUMERIC(6,2),
  fat_per_serving NUMERIC(6,2),
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_foods_canonical_name ON foods(canonical_name);
CREATE INDEX idx_foods_source ON foods(source);

CREATE TRIGGER update_foods_updated_at
  BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FOOD BARCODES TABLE
-- Links barcodes to cached food entries
-- ============================================

CREATE TABLE food_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX food_barcodes_barcode_idx ON food_barcodes(barcode);
CREATE INDEX idx_food_barcodes_food ON food_barcodes(food_id);

-- ============================================
-- FOOD ALIASES TABLE
-- Alternative names for foods (supports fuzzy search)
-- ============================================

CREATE TABLE food_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  alias_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_aliases_food ON food_aliases(food_id);
CREATE INDEX idx_food_aliases_normalized ON food_aliases(normalized_text);

-- ============================================
-- UPDATE workout_sessions to add missing fields
-- Original schema was minimal, add all Drizzle-compatible columns
-- ============================================

-- Step 1: Add columns as nullable first (safe for existing data)
ALTER TABLE workout_sessions 
  ADD COLUMN IF NOT EXISTS routine_name TEXT,
  ADD COLUMN IF NOT EXISTS workout_type workout_type,
  ADD COLUMN IF NOT EXISTS activity_name TEXT,
  ADD COLUMN IF NOT EXISTS intensity INTEGER,
  ADD COLUMN IF NOT EXISTS calories_burned INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Backfill existing rows with default workout_type
UPDATE workout_sessions SET workout_type = 'other' WHERE workout_type IS NULL;

-- Step 3: Now set NOT NULL constraint and default for future inserts
ALTER TABLE workout_sessions 
  ALTER COLUMN workout_type SET NOT NULL,
  ALTER COLUMN workout_type SET DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, logged_at);

CREATE TRIGGER update_workout_sessions_updated_at
  BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- UPDATE weigh_ins to add body measurement fields
-- ============================================

ALTER TABLE weigh_ins
  ADD COLUMN IF NOT EXISTS waist_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS hips_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS bust_chest_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS thigh_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS arm_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS calf_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS neck_cm NUMERIC(5,1);

-- ============================================
-- UPDATE food_logs to add additional fields
-- ============================================

ALTER TABLE food_logs
  ADD COLUMN IF NOT EXISTS quantity_value NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS quantity_unit TEXT,
  ADD COLUMN IF NOT EXISTS fiber NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS sugar NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS calories_per_unit NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS protein_per_unit NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS carbs_per_unit NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS fat_per_unit NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS micronutrients_dump JSONB,
  ADD COLUMN IF NOT EXISTS breaks_fast BOOLEAN,
  ADD COLUMN IF NOT EXISTS barcode TEXT;
