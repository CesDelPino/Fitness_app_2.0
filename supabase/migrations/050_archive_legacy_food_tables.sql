-- ============================================
-- Migration 050: Archive Legacy Food Tables
-- Part of FDA Nutrition System Phase 4
-- ============================================
-- 
-- Purpose: Archive the legacy AI-estimated food tables to make way for
-- FDA FoodData Central integration. This is a non-destructive migration
-- that preserves all legacy data for audit/rollback purposes.
--
-- Legacy tables being archived:
-- - foods -> foods_legacy
-- - food_barcodes -> food_barcodes_legacy  
-- - food_aliases -> food_aliases_legacy
--
-- Note: food_logs stores nutrition values directly (not as FK references),
-- so existing food logs are unaffected by this migration.
-- ============================================

-- ============================================
-- ARCHIVE FOODS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS foods_legacy (
  id UUID PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  brand TEXT,
  source food_source NOT NULL,
  verification_status food_verification_status NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO foods_legacy 
SELECT 
  id, canonical_name, brand, source, verification_status,
  calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
  fiber_per_100g, sugar_per_100g, default_serving_size, default_serving_grams,
  calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving,
  times_used, created_at, updated_at, NOW()
FROM foods
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ARCHIVE FOOD_BARCODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS food_barcodes_legacy (
  id UUID PRIMARY KEY,
  food_id UUID NOT NULL,
  barcode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO food_barcodes_legacy
SELECT id, food_id, barcode, created_at, NOW()
FROM food_barcodes
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ARCHIVE FOOD_ALIASES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS food_aliases_legacy (
  id UUID PRIMARY KEY,
  food_id UUID NOT NULL,
  alias_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO food_aliases_legacy
SELECT id, food_id, alias_text, normalized_text, created_at, NOW()
FROM food_aliases
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CREATE INDEXES ON LEGACY TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_foods_legacy_canonical_name ON foods_legacy(canonical_name);
CREATE INDEX IF NOT EXISTS idx_food_barcodes_legacy_barcode ON food_barcodes_legacy(barcode);
CREATE INDEX IF NOT EXISTS idx_food_aliases_legacy_normalized ON food_aliases_legacy(normalized_text);

-- ============================================
-- RLS POLICIES FOR LEGACY TABLES
-- Legacy tables are read-only for admins
-- ============================================

ALTER TABLE foods_legacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_barcodes_legacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_aliases_legacy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legacy foods readable by service role" ON foods_legacy
  FOR SELECT TO service_role USING (true);

CREATE POLICY "Legacy barcodes readable by service role" ON food_barcodes_legacy
  FOR SELECT TO service_role USING (true);

CREATE POLICY "Legacy aliases readable by service role" ON food_aliases_legacy
  FOR SELECT TO service_role USING (true);

-- ============================================
-- NOTE: Original tables (foods, food_barcodes, food_aliases) are NOT dropped.
-- They can be dropped in a future migration after verifying:
-- 1. All new food logging uses FDA-backed food_items
-- 2. No references remain to the old tables
-- 3. Rollback window has passed
-- ============================================
