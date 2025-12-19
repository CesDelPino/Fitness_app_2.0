-- Phase 6: AI Usage Tracking & Quota Enforcement
-- Run this migration in Supabase SQL Editor

-- ============================================================================
-- PART 1: AI Usage Counters Table
-- ============================================================================

-- Table to track AI feature usage per user per month
CREATE TABLE IF NOT EXISTS ai_usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL CHECK (feature_code IN ('ai_photo_recognition', 'ai_workout_builder')),
  usage_month DATE NOT NULL,  -- First of month for grouping (e.g., 2024-12-01)
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_code, usage_month)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_feature ON ai_usage_counters(user_id, feature_code);
CREATE INDEX IF NOT EXISTS idx_ai_usage_month ON ai_usage_counters(usage_month);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON ai_usage_counters(user_id, usage_month);

-- Enable RLS
ALTER TABLE ai_usage_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view their own usage
CREATE POLICY "Users can view own usage counters" ON ai_usage_counters
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access ai_usage_counters" ON ai_usage_counters
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 2: Quota Limits Configuration
-- ============================================================================

-- Table to store configurable quota limits (admin-managed)
CREATE TABLE IF NOT EXISTS ai_feature_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code TEXT NOT NULL UNIQUE CHECK (feature_code IN ('ai_photo_recognition', 'ai_workout_builder')),
  monthly_limit INTEGER NOT NULL CHECK (monthly_limit > 0),
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default quota limits
INSERT INTO ai_feature_quotas (feature_code, monthly_limit, description) VALUES
  ('ai_photo_recognition', 50, 'AI food photo analysis - 50 scans per month for Premium users'),
  ('ai_workout_builder', 5, 'AI workout routine generation - 5 generations per month for Premium users')
ON CONFLICT (feature_code) DO NOTHING;

-- RLS for quota config
ALTER TABLE ai_feature_quotas ENABLE ROW LEVEL SECURITY;

-- Anyone can read quotas (for display purposes)
CREATE POLICY "Anyone can view quota limits" ON ai_feature_quotas
  FOR SELECT USING (TRUE);

-- Only service role can modify
CREATE POLICY "Service role full access ai_feature_quotas" ON ai_feature_quotas
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 3: Atomic Increment RPC with Quota Check
-- ============================================================================

-- Function to atomically increment usage and check quota
-- Returns: { success: boolean, current_count: integer, limit: integer, remaining: integer, error?: string }
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_feature_code TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage_month DATE;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_new_count INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Get first day of current month (UTC)
  v_usage_month := DATE_TRUNC('month', NOW())::DATE;
  
  -- Get the quota limit for this feature
  SELECT monthly_limit, is_active INTO v_limit, v_is_active
  FROM ai_feature_quotas
  WHERE feature_code = p_feature_code;
  
  -- If feature not found or inactive, deny
  IF v_limit IS NULL OR v_is_active = FALSE THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Feature quota not configured or inactive',
      'current_count', 0,
      'limit', 0,
      'remaining', 0
    );
  END IF;
  
  -- Upsert the usage counter with row-level locking
  INSERT INTO ai_usage_counters (user_id, feature_code, usage_month, usage_count)
  VALUES (p_user_id, p_feature_code, v_usage_month, 0)
  ON CONFLICT (user_id, feature_code, usage_month) DO NOTHING;
  
  -- Lock the row and get current count
  SELECT usage_count INTO v_current_count
  FROM ai_usage_counters
  WHERE user_id = p_user_id 
    AND feature_code = p_feature_code 
    AND usage_month = v_usage_month
  FOR UPDATE;
  
  -- Check if incrementing would exceed limit
  v_new_count := v_current_count + p_increment;
  
  IF v_new_count > v_limit THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Monthly quota exceeded',
      'current_count', v_current_count,
      'limit', v_limit,
      'remaining', GREATEST(0, v_limit - v_current_count)
    );
  END IF;
  
  -- Increment the counter
  UPDATE ai_usage_counters
  SET usage_count = v_new_count,
      updated_at = NOW()
  WHERE user_id = p_user_id 
    AND feature_code = p_feature_code 
    AND usage_month = v_usage_month;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'current_count', v_new_count,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_new_count)
  );
END;
$$;

-- ============================================================================
-- PART 4: Get Current Usage Status RPC
-- ============================================================================

-- Function to get current usage status for a user (all features or specific)
CREATE OR REPLACE FUNCTION get_ai_usage_status(
  p_user_id UUID,
  p_feature_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  feature_code TEXT,
  usage_count INTEGER,
  monthly_limit INTEGER,
  remaining INTEGER,
  usage_percent NUMERIC,
  reset_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage_month DATE;
BEGIN
  -- Get first day of current month
  v_usage_month := DATE_TRUNC('month', NOW())::DATE;
  
  RETURN QUERY
  SELECT 
    q.feature_code,
    COALESCE(u.usage_count, 0) as usage_count,
    q.monthly_limit,
    GREATEST(0, q.monthly_limit - COALESCE(u.usage_count, 0)) as remaining,
    ROUND((COALESCE(u.usage_count, 0)::NUMERIC / q.monthly_limit::NUMERIC) * 100, 1) as usage_percent,
    (v_usage_month + INTERVAL '1 month')::DATE as reset_date
  FROM ai_feature_quotas q
  LEFT JOIN ai_usage_counters u ON u.feature_code = q.feature_code 
    AND u.user_id = p_user_id 
    AND u.usage_month = v_usage_month
  WHERE q.is_active = TRUE
    AND (p_feature_code IS NULL OR q.feature_code = p_feature_code);
END;
$$;

-- ============================================================================
-- PART 5: View for Admin Analytics
-- ============================================================================

-- View for admin to see usage analytics across all users
CREATE OR REPLACE VIEW ai_usage_analytics AS
SELECT 
  feature_code,
  usage_month,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(usage_count) as total_usage,
  AVG(usage_count)::NUMERIC(10,2) as avg_usage_per_user,
  MAX(usage_count) as max_usage,
  COUNT(*) FILTER (WHERE usage_count >= (SELECT monthly_limit FROM ai_feature_quotas q WHERE q.feature_code = ai_usage_counters.feature_code)) as users_at_limit
FROM ai_usage_counters
WHERE usage_month >= DATE_TRUNC('month', NOW() - INTERVAL '6 months')::DATE
GROUP BY feature_code, usage_month
ORDER BY usage_month DESC, feature_code;

-- ============================================================================
-- PART 6: Active AI Programs Constraint
-- ============================================================================

-- Table to track active AI-generated workout programs per user
-- Enforces the "max 1 active AI program" rule
CREATE TABLE IF NOT EXISTS active_ai_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  UNIQUE(user_id, blueprint_id)
);

-- Index for active program lookup
CREATE INDEX IF NOT EXISTS idx_active_ai_programs_user_active ON active_ai_programs(user_id, is_active) WHERE is_active = TRUE;

-- RLS policies
ALTER TABLE active_ai_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own active programs" ON active_ai_programs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access active_ai_programs" ON active_ai_programs
  FOR ALL USING (auth.role() = 'service_role');

-- Function to check and set active AI program (returns false if already have one)
CREATE OR REPLACE FUNCTION set_active_ai_program(
  p_user_id UUID,
  p_blueprint_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_count INTEGER;
  v_existing_blueprint_id UUID;
BEGIN
  -- Check for existing active program
  SELECT COUNT(*), MAX(blueprint_id) INTO v_existing_count, v_existing_blueprint_id
  FROM active_ai_programs
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- If same program, just return success
  IF v_existing_blueprint_id = p_blueprint_id THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Program already active'
    );
  END IF;
  
  -- If different active program exists, deactivate it first
  IF v_existing_count > 0 THEN
    UPDATE active_ai_programs
    SET is_active = FALSE, deactivated_at = NOW()
    WHERE user_id = p_user_id AND is_active = TRUE;
  END IF;
  
  -- Insert or update the new active program
  INSERT INTO active_ai_programs (user_id, blueprint_id, is_active, activated_at)
  VALUES (p_user_id, p_blueprint_id, TRUE, NOW())
  ON CONFLICT (user_id, blueprint_id) DO UPDATE
  SET is_active = TRUE, activated_at = NOW(), deactivated_at = NULL;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Program activated',
    'previous_deactivated', v_existing_count > 0
  );
END;
$$;

-- Function to get user's active AI program
CREATE OR REPLACE FUNCTION get_active_ai_program(p_user_id UUID)
RETURNS TABLE (
  blueprint_id UUID,
  activated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ap.blueprint_id, ap.activated_at
  FROM active_ai_programs ap
  WHERE ap.user_id = p_user_id AND ap.is_active = TRUE
  LIMIT 1;
END;
$$;

-- ============================================================================
-- PART 7: Grant Permissions
-- ============================================================================

GRANT SELECT ON ai_usage_counters TO authenticated;
GRANT SELECT ON ai_feature_quotas TO authenticated;
GRANT SELECT ON ai_usage_analytics TO authenticated;
GRANT SELECT ON active_ai_programs TO authenticated;

GRANT EXECUTE ON FUNCTION increment_ai_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_usage_status TO authenticated;
GRANT EXECUTE ON FUNCTION set_active_ai_program TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_ai_program TO authenticated;
