-- Migration: 035_daily_water_intake.sql
-- Description: Add water intake tracking for Daily Log page
-- Date: December 2024

-- Daily water intake table (stores totals per day)
CREATE TABLE IF NOT EXISTS daily_water_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_ml INTEGER NOT NULL DEFAULT 0,
  target_ml INTEGER, -- User's daily target (nullable, falls back to profile default)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Optional: Individual water log entries for history/undo
CREATE TABLE IF NOT EXISTS water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount_ml INTEGER NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'quick_add', -- 'quick_add', 'custom', 'undo'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_water_intake_user_date ON daily_water_intake(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, date DESC);

-- RLS Policies
ALTER TABLE daily_water_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own water data
CREATE POLICY "Users can view own water intake" ON daily_water_intake
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water intake" ON daily_water_intake
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water intake" ON daily_water_intake
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own water logs" ON water_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water logs" ON water_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add water_target_ml to profiles for default daily target
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_target_ml INTEGER DEFAULT 2000;

-- RPC function to atomically increment daily water intake
CREATE OR REPLACE FUNCTION increment_daily_water(
  p_user_id UUID,
  p_date DATE,
  p_amount_ml INTEGER,
  p_source VARCHAR DEFAULT 'quick_add'
)
RETURNS TABLE(total_ml INTEGER, target_ml INTEGER) AS $$
DECLARE
  v_total INTEGER;
  v_target INTEGER;
BEGIN
  -- Upsert daily_water_intake
  INSERT INTO daily_water_intake (user_id, date, total_ml, updated_at)
  VALUES (p_user_id, p_date, p_amount_ml, NOW())
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    total_ml = daily_water_intake.total_ml + p_amount_ml,
    updated_at = NOW()
  RETURNING daily_water_intake.total_ml, daily_water_intake.target_ml
  INTO v_total, v_target;
  
  -- Log the individual entry
  INSERT INTO water_logs (user_id, date, amount_ml, source)
  VALUES (p_user_id, p_date, p_amount_ml, p_source);
  
  -- If no custom target, get from profile
  IF v_target IS NULL THEN
    SELECT profiles.water_target_ml INTO v_target
    FROM profiles WHERE id = p_user_id;
  END IF;
  
  RETURN QUERY SELECT v_total, COALESCE(v_target, 2000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_daily_water TO authenticated;

COMMENT ON TABLE daily_water_intake IS 'Daily water intake totals per user';
COMMENT ON TABLE water_logs IS 'Individual water intake log entries for history and undo';
COMMENT ON FUNCTION increment_daily_water IS 'Atomically adds water intake and logs the entry';
