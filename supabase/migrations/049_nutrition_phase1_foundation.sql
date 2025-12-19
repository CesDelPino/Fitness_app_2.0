-- ============================================
-- LOBA Tracker - Full Nutrition System Phase 1
-- Database Foundation Migration
-- 
-- This migration creates the foundation for:
-- 1. FDA-sourced nutrition data (normalized nutrient storage)
-- 2. Feature gating system (free/premium tiers)
-- 3. Meal capture grouping
--
-- BACKWARD COMPATIBLE: Existing tables remain untouched
-- ============================================

-- ============================================
-- NEW ENUMS
-- ============================================

CREATE TYPE data_source_type AS ENUM ('fda_foundation', 'fda_sr_legacy', 'fda_branded', 'openfoodfacts', 'user_manual');
CREATE TYPE nutrient_group_type AS ENUM ('macro', 'mineral', 'vitamin', 'lipid', 'other');
CREATE TYPE capture_type AS ENUM ('photo', 'manual', 'barcode', 'text');

-- ============================================
-- NUTRIENT DEFINITIONS TABLE
-- Reference table for all possible nutrients from FDA
-- ============================================

CREATE TABLE nutrient_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fdc_nutrient_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  nutrient_group nutrient_group_type NOT NULL DEFAULT 'other',
  display_order INTEGER NOT NULL DEFAULT 999,
  is_core_macro BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrient_definitions_group ON nutrient_definitions(nutrient_group);
CREATE INDEX idx_nutrient_definitions_order ON nutrient_definitions(display_order);

-- ============================================
-- FOOD ITEMS TABLE
-- New FDA-centric food storage (does NOT replace existing foods table)
-- ============================================

CREATE TABLE food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fdc_id INTEGER UNIQUE,
  description TEXT NOT NULL,
  brand_name TEXT,
  data_type data_source_type NOT NULL,
  gtin_upc TEXT,
  serving_size_description TEXT,
  serving_size_grams NUMERIC(8,2),
  household_serving_text TEXT,
  fdc_published_date DATE,
  fetch_timestamp TIMESTAMPTZ,
  confidence_score NUMERIC(3,2),
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_items_fdc_id ON food_items(fdc_id);
CREATE INDEX idx_food_items_gtin_upc ON food_items(gtin_upc);
CREATE INDEX idx_food_items_description ON food_items USING gin(to_tsvector('english', description));
CREATE INDEX idx_food_items_times_used ON food_items(times_used DESC);

CREATE TRIGGER update_food_items_updated_at
  BEFORE UPDATE ON food_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FOOD ITEM NUTRIENTS TABLE
-- Join table linking foods to their nutrient values
-- ============================================

CREATE TABLE food_item_nutrients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id UUID NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  nutrient_id UUID NOT NULL REFERENCES nutrient_definitions(id) ON DELETE CASCADE,
  amount_per_100g NUMERIC(10,4),
  amount_per_serving NUMERIC(10,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(food_item_id, nutrient_id)
);

CREATE INDEX idx_food_item_nutrients_food ON food_item_nutrients(food_item_id);
CREATE INDEX idx_food_item_nutrients_nutrient ON food_item_nutrients(nutrient_id);

-- ============================================
-- MEAL CAPTURES TABLE
-- Groups food logs from the same photo/entry session
-- ============================================

CREATE TABLE meal_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capture_type capture_type NOT NULL,
  raw_ai_response JSONB,
  image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_captures_user ON meal_captures(user_id);
CREATE INDEX idx_meal_captures_created ON meal_captures(created_at DESC);

-- ============================================
-- FEATURES TABLE
-- List of all gatable features
-- ============================================

CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_features_code ON features(code);
CREATE INDEX idx_features_active ON features(is_active);

-- ============================================
-- SUBSCRIPTION PLANS TABLE
-- Available subscription tiers
-- ============================================

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_monthly NUMERIC(8,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_plans_code ON subscription_plans(code);

-- ============================================
-- PLAN FEATURES TABLE
-- Which features each plan includes
-- ============================================

CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

CREATE INDEX idx_plan_features_plan ON plan_features(plan_id);
CREATE INDEX idx_plan_features_feature ON plan_features(feature_id);

-- ============================================
-- USER FEATURE OVERRIDES TABLE
-- Per-user feature access overrides
-- ============================================

CREATE TABLE user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, feature_id)
);

CREATE INDEX idx_user_feature_overrides_user ON user_feature_overrides(user_id);
CREATE INDEX idx_user_feature_overrides_feature ON user_feature_overrides(feature_id);

-- ============================================
-- UPDATE PROFILES TABLE
-- Add subscription_plan_id column
-- ============================================

ALTER TABLE profiles 
ADD COLUMN subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_subscription_plan ON profiles(subscription_plan_id);

-- ============================================
-- UPDATE FOOD_LOGS TABLE
-- Add new columns for FDA integration (all nullable for backward compat)
-- ============================================

ALTER TABLE food_logs
ADD COLUMN meal_capture_id UUID REFERENCES meal_captures(id) ON DELETE SET NULL,
ADD COLUMN food_item_id UUID REFERENCES food_items(id) ON DELETE SET NULL,
ADD COLUMN nutrient_snapshot JSONB;

CREATE INDEX idx_food_logs_meal_capture ON food_logs(meal_capture_id);
CREATE INDEX idx_food_logs_food_item ON food_logs(food_item_id);

-- ============================================
-- SEED DATA: SUBSCRIPTION PLANS
-- Using fixed UUIDs for idempotency (valid UUIDv4 format)
-- ============================================

INSERT INTO subscription_plans (id, code, name, price_monthly, is_default) VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'free', 'Free', NULL, true),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'premium', 'Premium', 9.99, false)
ON CONFLICT (code) DO NOTHING;

-- Set default subscription for existing users
UPDATE profiles 
SET subscription_plan_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
WHERE subscription_plan_id IS NULL;

-- ============================================
-- SEED DATA: FEATURES
-- Using fixed UUIDs for idempotency (valid UUIDv4 format)
-- ============================================

INSERT INTO features (id, code, name, description, is_active) VALUES
  ('f1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5', 'basic_macros', 'Basic Macros', 'View calories, protein, carbs, and fat', true),
  ('f2a2a2a2-b3b3-4c4c-8d5d-e6e6e6e6e6e6', 'text_food_search', 'Text Food Search', 'Search for foods by name', true),
  ('f3a3a3a3-b4b4-4c5c-8d6d-e7e7e7e7e7e7', 'barcode_scan', 'Barcode Scanning', 'Scan food barcodes to log', true),
  ('f4a4a4a4-b5b5-4c6c-8d7d-e8e8e8e8e8e8', 'ai_photo_recognition', 'AI Photo Analysis', 'Use camera to identify foods', true),
  ('f5a5a5a5-b6b6-4c7c-8d8d-e9e9e9e9e9e9', 'fiber_sugar_display', 'Fiber & Sugar', 'See fiber and sugar values', true),
  ('f6a6a6a6-b7b7-4c8c-8d9d-eaeaeaeaeaea', 'micronutrients', 'Micronutrients', 'See vitamins and minerals', true),
  ('f7a7a7a7-b8b8-4c9c-8daa-ebebebebeb01', 'micronutrient_targets', 'Nutrient Targets', 'Set daily micronutrient goals', true),
  ('f8a8a8a8-b9b9-4cac-8dbb-ececececec02', 'detailed_fats', 'Detailed Fats', 'See saturated, trans, omega breakdown', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: PLAN FEATURES
-- Free tier gets: basic_macros, text_food_search, barcode_scan
-- Premium tier gets: all features
-- ============================================

INSERT INTO plan_features (plan_id, feature_id) VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'f1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'f2a2a2a2-b3b3-4c4c-8d5d-e6e6e6e6e6e6'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'f3a3a3a3-b4b4-4c5c-8d6d-e7e7e7e7e7e7'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f2a2a2a2-b3b3-4c4c-8d5d-e6e6e6e6e6e6'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f3a3a3a3-b4b4-4c5c-8d6d-e7e7e7e7e7e7'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f4a4a4a4-b5b5-4c6c-8d7d-e8e8e8e8e8e8'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f5a5a5a5-b6b6-4c7c-8d8d-e9e9e9e9e9e9'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f6a6a6a6-b7b7-4c8c-8d9d-eaeaeaeaeaea'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f7a7a7a7-b8b8-4c9c-8daa-ebebebebeb01'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f8a8a8a8-b9b9-4cac-8dbb-ececececec02')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED DATA: NUTRIENT DEFINITIONS
-- Core nutrients from FDA (Appendix A of FULL-NUTRITION.md)
-- ============================================

INSERT INTO nutrient_definitions (fdc_nutrient_id, name, unit, nutrient_group, display_order, is_core_macro) VALUES
  (1008, 'Energy', 'kcal', 'macro', 1, true),
  (1003, 'Protein', 'g', 'macro', 2, true),
  (1005, 'Carbohydrate', 'g', 'macro', 3, true),
  (1004, 'Total Fat', 'g', 'macro', 4, true),
  (1079, 'Fiber', 'g', 'macro', 5, false),
  (2000, 'Total Sugars', 'g', 'macro', 6, false),
  (1258, 'Saturated Fat', 'g', 'lipid', 10, false),
  (1257, 'Trans Fat', 'g', 'lipid', 11, false),
  (1253, 'Cholesterol', 'mg', 'lipid', 12, false),
  (1087, 'Calcium', 'mg', 'mineral', 20, false),
  (1089, 'Iron', 'mg', 'mineral', 21, false),
  (1090, 'Magnesium', 'mg', 'mineral', 22, false),
  (1091, 'Phosphorus', 'mg', 'mineral', 23, false),
  (1092, 'Potassium', 'mg', 'mineral', 24, false),
  (1093, 'Sodium', 'mg', 'mineral', 25, false),
  (1095, 'Zinc', 'mg', 'mineral', 26, false),
  (1098, 'Copper', 'mg', 'mineral', 27, false),
  (1101, 'Manganese', 'mg', 'mineral', 28, false),
  (1103, 'Selenium', 'µg', 'mineral', 29, false),
  (1106, 'Vitamin A', 'µg', 'vitamin', 30, false),
  (1162, 'Vitamin C', 'mg', 'vitamin', 31, false),
  (1114, 'Vitamin D', 'µg', 'vitamin', 32, false),
  (1109, 'Vitamin E', 'mg', 'vitamin', 33, false),
  (1185, 'Vitamin K', 'µg', 'vitamin', 34, false),
  (1165, 'Thiamin (B1)', 'mg', 'vitamin', 35, false),
  (1166, 'Riboflavin (B2)', 'mg', 'vitamin', 36, false),
  (1167, 'Niacin (B3)', 'mg', 'vitamin', 37, false),
  (1170, 'Pantothenic Acid (B5)', 'mg', 'vitamin', 38, false),
  (1175, 'Vitamin B6', 'mg', 'vitamin', 39, false),
  (1177, 'Folate (B9)', 'µg', 'vitamin', 40, false),
  (1178, 'Vitamin B12', 'µg', 'vitamin', 41, false)
ON CONFLICT (fdc_nutrient_id) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE nutrient_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_item_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Nutrient definitions: Public read access
CREATE POLICY "Anyone can read nutrient definitions"
  ON nutrient_definitions FOR SELECT
  TO authenticated
  USING (true);

-- Food items: Public read, service role write
CREATE POLICY "Anyone can read food items"
  ON food_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage food items"
  ON food_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Food item nutrients: Public read
CREATE POLICY "Anyone can read food item nutrients"
  ON food_item_nutrients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage food item nutrients"
  ON food_item_nutrients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Meal captures: Users can manage their own
CREATE POLICY "Users can read own meal captures"
  ON meal_captures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own meal captures"
  ON meal_captures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal captures"
  ON meal_captures FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Features: Public read
CREATE POLICY "Anyone can read active features"
  ON features FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage features"
  ON features FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Subscription plans: Public read
CREATE POLICY "Anyone can read subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage subscription plans"
  ON subscription_plans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Plan features: Public read
CREATE POLICY "Anyone can read plan features"
  ON plan_features FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage plan features"
  ON plan_features FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User feature overrides: Users can read own
CREATE POLICY "Users can read own feature overrides"
  ON user_feature_overrides FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user feature overrides"
  ON user_feature_overrides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE nutrient_definitions IS 'FDA nutrient reference data with IDs, names, and units';
COMMENT ON TABLE food_items IS 'FDA-sourced food items with serving information';
COMMENT ON TABLE food_item_nutrients IS 'Normalized nutrient values per food item';
COMMENT ON TABLE meal_captures IS 'Groups food logs from same photo/entry session';
COMMENT ON TABLE features IS 'Gatable features for free/premium tiers';
COMMENT ON TABLE subscription_plans IS 'Available subscription tiers (free, premium)';
COMMENT ON TABLE plan_features IS 'Which features each subscription plan includes';
COMMENT ON TABLE user_feature_overrides IS 'Per-user feature access exceptions';
