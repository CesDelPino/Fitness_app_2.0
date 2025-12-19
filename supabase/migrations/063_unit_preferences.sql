-- Migration: 063_unit_preferences.sql
-- Add per-domain unit preference columns to profiles table
-- Allows users to independently set units for different measurement domains

-- Body weight unit (kg/lbs) - may already exist via preferred_unit_system, adding explicit column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_body_weight TEXT DEFAULT 'kg';

-- Body measurements unit (cm/in) - separate from body weight
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_body_measurements TEXT DEFAULT 'cm';

-- Exercise/lifting weights unit (kg/lbs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_exercise_weight TEXT DEFAULT 'kg';

-- Cardio distance unit (km/mi)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_cardio_distance TEXT DEFAULT 'km';

-- Food weight unit (g/oz)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_food_weight TEXT DEFAULT 'g';

-- Food volume unit (ml/floz) - separate from water which uses preferred_unit_system
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_food_volume TEXT DEFAULT 'ml';

-- Add check constraints for valid values
DO $$
BEGIN
  -- Only add constraints if they don't already exist
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_unit_body_weight_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_unit_body_weight_check 
      CHECK (unit_body_weight IS NULL OR unit_body_weight IN ('kg', 'lbs'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_unit_body_measurements_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_unit_body_measurements_check 
      CHECK (unit_body_measurements IS NULL OR unit_body_measurements IN ('cm', 'in'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_unit_exercise_weight_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_unit_exercise_weight_check 
      CHECK (unit_exercise_weight IS NULL OR unit_exercise_weight IN ('kg', 'lbs'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_unit_cardio_distance_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_unit_cardio_distance_check 
      CHECK (unit_cardio_distance IS NULL OR unit_cardio_distance IN ('km', 'mi'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_unit_food_weight_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_unit_food_weight_check 
      CHECK (unit_food_weight IS NULL OR unit_food_weight IN ('g', 'oz'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_unit_food_volume_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_unit_food_volume_check 
      CHECK (unit_food_volume IS NULL OR unit_food_volume IN ('ml', 'floz'));
  END IF;
END $$;

-- Note: Existing preferred_unit_system column remains as global fallback
-- New columns override the global setting per domain
-- Water intake continues to use preferred_unit_system via VolumeUnit utilities
