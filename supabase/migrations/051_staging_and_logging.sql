-- ============================================
-- LOBA Tracker - Staging & Logging Tables
-- 
-- This migration creates:
-- 1. staging_food_items - AI-generated foods pending admin verification
-- 2. fda_request_logs - FDA API call tracking for quota monitoring
-- 3. Add 'ai_generated' to data_source_type enum
-- ============================================

-- ============================================
-- ADD 'ai_generated' TO DATA SOURCE ENUM
-- ============================================

ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'ai_generated';

-- ============================================
-- STAGING FOOD ITEMS TABLE
-- Holds AI-generated foods until admin verification
-- ============================================

CREATE TYPE staging_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE staging_food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  brand_name TEXT,
  serving_size_description TEXT,
  serving_size_grams NUMERIC(8,2),
  household_serving_text TEXT,
  raw_ai_response JSONB,
  submitted_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  status staging_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  approved_food_item_id UUID REFERENCES food_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_staging_food_items_status ON staging_food_items(status);
CREATE INDEX idx_staging_food_items_submitted_by ON staging_food_items(submitted_by_user_id);
CREATE INDEX idx_staging_food_items_created ON staging_food_items(created_at DESC);

-- ============================================
-- STAGING FOOD NUTRIENTS TABLE
-- Nutrient values for staging foods
-- ============================================

CREATE TABLE staging_food_nutrients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_food_id UUID NOT NULL REFERENCES staging_food_items(id) ON DELETE CASCADE,
  nutrient_id UUID NOT NULL REFERENCES nutrient_definitions(id) ON DELETE CASCADE,
  amount_per_100g NUMERIC(10,4),
  amount_per_serving NUMERIC(10,4),
  UNIQUE(staging_food_id, nutrient_id)
);

CREATE INDEX idx_staging_food_nutrients_food ON staging_food_nutrients(staging_food_id);

-- ============================================
-- FDA REQUEST LOGS TABLE
-- Track all FDA API calls for quota monitoring
-- ============================================

CREATE TYPE fda_request_type AS ENUM ('search', 'barcode', 'food_detail', 'batch');

CREATE TABLE fda_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type fda_request_type NOT NULL,
  query_params TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  response_status INTEGER NOT NULL,
  hit_cache BOOLEAN NOT NULL DEFAULT false,
  result_count INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fda_request_logs_type ON fda_request_logs(request_type);
CREATE INDEX idx_fda_request_logs_created ON fda_request_logs(created_at DESC);
CREATE INDEX idx_fda_request_logs_user ON fda_request_logs(user_id);

-- ============================================
-- HOURLY QUOTA VIEW
-- Aggregates FDA requests per hour for quota monitoring
-- ============================================

CREATE OR REPLACE VIEW fda_hourly_quota AS
SELECT 
  date_trunc('hour', created_at) AS hour_start,
  COUNT(*) FILTER (WHERE NOT hit_cache) AS api_calls,
  COUNT(*) FILTER (WHERE hit_cache) AS cache_hits,
  COUNT(*) AS total_requests,
  AVG(response_time_ms)::INTEGER AS avg_response_time_ms
FROM fda_request_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at)
ORDER BY hour_start DESC;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE staging_food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fda_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own staging submissions"
  ON staging_food_items FOR SELECT
  TO authenticated
  USING (submitted_by_user_id = auth.uid());

CREATE POLICY "Service role can manage staging foods"
  ON staging_food_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view staging nutrients for their submissions"
  ON staging_food_nutrients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staging_food_items s 
      WHERE s.id = staging_food_nutrients.staging_food_id 
      AND s.submitted_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage staging nutrients"
  ON staging_food_nutrients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage FDA request logs"
  ON fda_request_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- GRANT VIEW ACCESS
-- ============================================

GRANT SELECT ON fda_hourly_quota TO authenticated;
GRANT SELECT ON fda_hourly_quota TO service_role;
