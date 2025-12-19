-- Phase 1: Premium Subscriptions - Database Tables
-- Run this migration in Supabase SQL Editor

-- Add stripe_customer_id to profiles if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Create index on stripe_customer_id for lookup efficiency
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- User Subscriptions table - tracks Stripe subscriptions for each user
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_subscription UNIQUE(user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Promo Codes table - stores promotional discount codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  stripe_coupon_id TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  max_redemptions INTEGER,
  redemption_count INTEGER DEFAULT 0,
  first_time_only BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for promo code lookup
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = TRUE;

-- Promo Redemptions table - tracks which users redeemed which codes
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_promo UNIQUE(promo_code_id, user_id)
);

-- Index for redemption lookup
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);

-- Trial History table - tracks trial periods per user (for once-per-year logic)
CREATE TABLE IF NOT EXISTS trial_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ended_at TIMESTAMPTZ,
  converted_to_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for trial eligibility check
CREATE INDEX IF NOT EXISTS idx_trial_history_user_id ON trial_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_history_started ON trial_history(trial_started_at);

-- Webhook Events table - for idempotency tracking
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- Index for event lookup
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);

-- RPC function to increment promo redemption count atomically
CREATE OR REPLACE FUNCTION increment_promo_redemption(promo_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE promo_codes 
  SET redemption_count = redemption_count + 1 
  WHERE id = promo_id;
END;
$$;

-- RPC function to check trial eligibility (within last 12 months)
CREATE OR REPLACE FUNCTION check_trial_eligibility(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  trial_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trial_count
  FROM trial_history
  WHERE user_id = p_user_id
    AND trial_started_at >= NOW() - INTERVAL '12 months';
  
  RETURN trial_count = 0;
END;
$$;

-- Enable RLS on subscription tables
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for promo_codes (all authenticated users can view active codes)
CREATE POLICY "Anyone can view active promo codes" ON promo_codes
  FOR SELECT USING (is_active = TRUE);

-- RLS Policies for promo_redemptions
CREATE POLICY "Users can view own redemptions" ON promo_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for trial_history  
CREATE POLICY "Users can view own trial history" ON trial_history
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access user_subscriptions" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access promo_codes" ON promo_codes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access promo_redemptions" ON promo_redemptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access trial_history" ON trial_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access webhook_events" ON stripe_webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- RPC function to atomically enforce grace period expiry
CREATE OR REPLACE FUNCTION enforce_grace_period_expiry(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_free_plan_id UUID;
  v_profile_updated BOOLEAN := FALSE;
  v_subscription_updated BOOLEAN := FALSE;
BEGIN
  -- Get free plan ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE code = 'free'
  LIMIT 1;
  
  IF v_free_plan_id IS NULL THEN
    RAISE WARNING 'Free plan not found';
    RETURN FALSE;
  END IF;
  
  -- Update profile and check if row was affected
  UPDATE profiles
  SET subscription_plan_id = v_free_plan_id
  WHERE id = p_user_id
    AND (subscription_plan_id IS NULL OR subscription_plan_id != v_free_plan_id);
  
  IF FOUND THEN
    v_profile_updated := TRUE;
  END IF;
  
  -- Update subscription and check if row was affected
  UPDATE user_subscriptions
  SET status = 'unpaid',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND status != 'unpaid';
  
  IF FOUND THEN
    v_subscription_updated := TRUE;
  END IF;
  
  -- Return true only if at least one table was updated
  RETURN v_profile_updated OR v_subscription_updated;
END;
$$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION increment_promo_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION check_trial_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_grace_period_expiry TO service_role;
