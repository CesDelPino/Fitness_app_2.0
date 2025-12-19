-- Migration: Add extended fields for routine version exercises
-- Purpose: Support weight targets, load directives, and special instructions
-- Implements dual-value storage pattern for unit-safe weight handling

-- ============================================
-- ADD LOAD DIRECTIVE ENUM TYPE
-- ============================================

CREATE TYPE load_directive_type AS ENUM (
  'absolute',   -- Use exact weight specified (e.g., 60kg bench press)
  'assisted',   -- Assisted movement, weight = assistance amount (e.g., 20kg assisted pull-up)
  'bodyweight', -- No external load, weight field ignored
  'open'        -- Weight left to client's discretion
);

-- ============================================
-- ADD WEIGHT UNIT ENUM TYPE
-- ============================================

CREATE TYPE weight_unit_type AS ENUM ('kg', 'lbs');

-- ============================================
-- ADD NEW COLUMNS TO ROUTINE_VERSION_EXERCISES
-- ============================================

-- Canonical weight in kg for calculations (DECIMAL(8,3) allows up to 99,999.999 kg)
ALTER TABLE routine_version_exercises 
ADD COLUMN IF NOT EXISTS target_weight_kg DECIMAL(8,3);

-- User's entered value preserved exactly (DECIMAL(6,2) allows up to 9,999.99)
ALTER TABLE routine_version_exercises 
ADD COLUMN IF NOT EXISTS entered_weight_value DECIMAL(6,2);

-- Unit the user was using when they entered the weight
ALTER TABLE routine_version_exercises 
ADD COLUMN IF NOT EXISTS entered_weight_unit weight_unit_type;

-- How to interpret the weight (default 'open' for backward compatibility)
ALTER TABLE routine_version_exercises 
ADD COLUMN IF NOT EXISTS load_directive load_directive_type NOT NULL DEFAULT 'open';

-- Trainer-specific instructions for this exercise (max 1000 chars enforced at app level)
ALTER TABLE routine_version_exercises 
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- ============================================
-- ADD COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN routine_version_exercises.target_weight_kg IS 'Canonical weight in kilograms for calculations. 0 is valid for bodyweight. NULL means unspecified.';
COMMENT ON COLUMN routine_version_exercises.entered_weight_value IS 'Exact value the user entered, preserved for display fidelity.';
COMMENT ON COLUMN routine_version_exercises.entered_weight_unit IS 'Unit (kg or lbs) the user was using when they entered the weight.';
COMMENT ON COLUMN routine_version_exercises.load_directive IS 'How to interpret the weight: absolute (exact), assisted (assistance amount), bodyweight (ignore weight), open (client discretion).';
COMMENT ON COLUMN routine_version_exercises.special_instructions IS 'Trainer-specific cues, form notes, or substitution guidance for this exercise.';

-- ============================================
-- ADD VALIDATION CONSTRAINT
-- ============================================

-- Ensure weight is non-negative when specified
ALTER TABLE routine_version_exercises 
ADD CONSTRAINT check_weight_non_negative 
CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0);

-- Ensure entered weight is non-negative when specified
ALTER TABLE routine_version_exercises 
ADD CONSTRAINT check_entered_weight_non_negative 
CHECK (entered_weight_value IS NULL OR entered_weight_value >= 0);

-- If entered_weight_value is set, entered_weight_unit must also be set
ALTER TABLE routine_version_exercises 
ADD CONSTRAINT check_entered_weight_complete 
CHECK (
  (entered_weight_value IS NULL AND entered_weight_unit IS NULL) 
  OR 
  (entered_weight_value IS NOT NULL AND entered_weight_unit IS NOT NULL)
);
