-- Migration: Add location fields to trainer_storefronts
-- This enables the ProfessionalDetail page to display location with timezone difference

BEGIN;

ALTER TABLE trainer_storefronts 
ADD COLUMN IF NOT EXISTS location_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_country VARCHAR(100);

UPDATE trainer_storefronts ts
SET 
  location_city = pp.location_city,
  location_state = pp.location_state,
  location_country = pp.location_country
FROM professional_profiles pp
WHERE ts.trainer_id = pp.user_id
  AND ts.location_city IS NULL
  AND pp.location_city IS NOT NULL;

COMMIT;
