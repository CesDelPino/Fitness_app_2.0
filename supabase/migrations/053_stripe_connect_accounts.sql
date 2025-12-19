-- Phase 2: Stripe Connect Foundation - Connected Accounts Table
-- Run this migration in Supabase SQL Editor

-- Connected Accounts table - stores Stripe Connect Express account info for trainers
CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'express' CHECK (account_type IN ('express', 'standard', 'custom')),
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  requirements_current_deadline TIMESTAMPTZ,
  requirements_disabled_reason TEXT,
  default_currency TEXT DEFAULT 'usd',
  country TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_connected_account UNIQUE(user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_stripe_account_id ON connected_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_onboarding_complete ON connected_accounts(onboarding_complete);

-- Connect Webhook Events table - for idempotency tracking of Connect-specific events
CREATE TABLE IF NOT EXISTS stripe_connect_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  stripe_account_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- Index for event lookup
CREATE INDEX IF NOT EXISTS idx_stripe_connect_webhook_events_event_id ON stripe_connect_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_webhook_events_account_id ON stripe_connect_webhook_events(stripe_account_id);

-- Enable RLS on new tables
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_connect_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connected_accounts
-- Trainers can view their own connected account
CREATE POLICY "Users can view own connected account" ON connected_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access connected_accounts" ON connected_accounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access connect_webhook_events" ON stripe_connect_webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- RPC function to check if trainer has completed Connect onboarding
CREATE OR REPLACE FUNCTION check_connect_onboarding_status(p_user_id UUID)
RETURNS TABLE(
  has_account BOOLEAN,
  onboarding_complete BOOLEAN,
  charges_enabled BOOLEAN,
  payouts_enabled BOOLEAN,
  requirements_disabled_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN ca.id IS NOT NULL THEN TRUE ELSE FALSE END as has_account,
    COALESCE(ca.onboarding_complete, FALSE) as onboarding_complete,
    COALESCE(ca.charges_enabled, FALSE) as charges_enabled,
    COALESCE(ca.payouts_enabled, FALSE) as payouts_enabled,
    ca.requirements_disabled_reason
  FROM auth.users u
  LEFT JOIN connected_accounts ca ON ca.user_id = u.id
  WHERE u.id = p_user_id;
END;
$$;

-- RPC function to update connected account status from webhook
CREATE OR REPLACE FUNCTION update_connected_account_status(
  p_stripe_account_id TEXT,
  p_charges_enabled BOOLEAN,
  p_payouts_enabled BOOLEAN,
  p_details_submitted BOOLEAN,
  p_requirements_disabled_reason TEXT DEFAULT NULL,
  p_requirements_current_deadline TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE connected_accounts
  SET 
    charges_enabled = p_charges_enabled,
    payouts_enabled = p_payouts_enabled,
    details_submitted = p_details_submitted,
    onboarding_complete = (p_charges_enabled AND p_payouts_enabled AND p_details_submitted),
    requirements_disabled_reason = p_requirements_disabled_reason,
    requirements_current_deadline = p_requirements_current_deadline,
    updated_at = NOW()
  WHERE stripe_account_id = p_stripe_account_id;
  
  IF FOUND THEN
    v_updated := TRUE;
  END IF;
  
  RETURN v_updated;
END;
$$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION check_connect_onboarding_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_connected_account_status TO service_role;
