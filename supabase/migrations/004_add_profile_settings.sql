-- Migration 004: Add user settings fields to profiles table
-- These fields match the Neon users table for full migration compatibility

-- Add calorie and macro target fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_calorie_target INTEGER,
ADD COLUMN IF NOT EXISTS manual_calorie_target INTEGER,
ADD COLUMN IF NOT EXISTS protein_target_g NUMERIC(6,2),
ADD COLUMN IF NOT EXISTS carbs_target_g NUMERIC(6,2),
ADD COLUMN IF NOT EXISTS fat_target_g NUMERIC(6,2);

-- Add preference fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferred_unit_system TEXT NOT NULL DEFAULT 'metric',
ADD COLUMN IF NOT EXISTS macro_input_type TEXT NOT NULL DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS show_bmi_tape BOOLEAN NOT NULL DEFAULT true;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

COMMENT ON COLUMN profiles.daily_calorie_target IS 'Calculated TDEE-based calorie target';
COMMENT ON COLUMN profiles.manual_calorie_target IS 'User-overridden calorie target (takes priority if set)';
COMMENT ON COLUMN profiles.preferred_unit_system IS 'metric or imperial';
COMMENT ON COLUMN profiles.macro_input_type IS 'percentage or grams';
COMMENT ON COLUMN profiles.show_bmi_tape IS 'Whether to show BMI tape gauge on analytics';
