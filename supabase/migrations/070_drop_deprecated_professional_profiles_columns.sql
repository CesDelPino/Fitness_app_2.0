-- Migration: Drop deprecated columns from professional_profiles
-- Phase 3 of Professional Data Consolidation
-- These columns are now sourced from trainer_storefronts (single source of truth)
-- 
-- IMPORTANT: Only run this migration AFTER verification period confirms
-- all reads are properly sourced from trainer_storefronts
--
-- Columns being dropped:
-- - headline (now in trainer_storefronts)
-- - bio (now in trainer_storefronts)
-- - specialties (now in trainer_storefronts)
-- - experience_years (now in trainer_storefronts)
-- - accepting_new_clients (now in trainer_storefronts)
-- - pricing_summary (deprecated, never used)
-- - location_city (now in trainer_storefronts)
-- - location_state (now in trainer_storefronts)
-- - location_country (now in trainer_storefronts)
-- - contact_email (now in trainer_storefronts)
-- - display_name (should come from profiles table)

BEGIN;

-- Drop deprecated public data columns (now in trainer_storefronts)
ALTER TABLE professional_profiles 
DROP COLUMN IF EXISTS headline,
DROP COLUMN IF EXISTS bio,
DROP COLUMN IF EXISTS specialties,
DROP COLUMN IF EXISTS experience_years,
DROP COLUMN IF EXISTS accepting_new_clients,
DROP COLUMN IF EXISTS pricing_summary,
DROP COLUMN IF EXISTS location_city,
DROP COLUMN IF EXISTS location_state,
DROP COLUMN IF EXISTS location_country,
DROP COLUMN IF EXISTS contact_email,
DROP COLUMN IF EXISTS display_name;

-- Add comment documenting remaining columns
COMMENT ON TABLE professional_profiles IS 
'Professional verification and identity data only. 
Public profile data is now stored in trainer_storefronts.
Remaining columns: id, user_id, verification_status, verification_submitted_at, 
verification_reviewed_at, verification_notes, credentials, profile_photo_path, 
created_at, updated_at';

COMMIT;
