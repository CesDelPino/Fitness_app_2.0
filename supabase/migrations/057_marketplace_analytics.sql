-- Phase 5: Marketplace Analytics & Frozen Access Logic
-- Run this migration in Supabase SQL Editor

-- ============================================================================
-- PART 1: Marketplace Analytics Views
-- ============================================================================

-- View for Marketplace GMV (Gross Merchandise Value) metrics
-- Provides aggregated revenue data for admin dashboard
CREATE OR REPLACE VIEW marketplace_gmv_metrics AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') as total_completed_purchases,
  COUNT(*) FILTER (WHERE status = 'refunded') as total_refunded_purchases,
  COUNT(*) FILTER (WHERE status = 'pending') as total_pending_purchases,
  COALESCE(SUM(amount_total_cents) FILTER (WHERE status = 'completed'), 0) as total_gmv_cents,
  COALESCE(SUM(amount_total_cents) FILTER (WHERE status = 'refunded'), 0) as total_refunded_cents,
  COALESCE(SUM(platform_fee_cents) FILTER (WHERE status = 'completed'), 0) as total_platform_fees_cents,
  COALESCE(SUM(amount_total_cents - platform_fee_cents) FILTER (WHERE status = 'completed'), 0) as total_trainer_earnings_cents,
  COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed') as unique_paying_clients,
  COUNT(DISTINCT trainer_id) FILTER (WHERE status = 'completed') as trainers_with_sales,
  COUNT(DISTINCT product_id) FILTER (WHERE status = 'completed') as products_with_sales
FROM product_purchases;

-- View for GMV by period (daily aggregation for charts)
CREATE OR REPLACE VIEW marketplace_gmv_daily AS
SELECT 
  DATE(purchased_at) as purchase_date,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'refunded') as refunded_count,
  COALESCE(SUM(amount_total_cents) FILTER (WHERE status = 'completed'), 0) as gmv_cents,
  COALESCE(SUM(amount_total_cents) FILTER (WHERE status = 'refunded'), 0) as refunded_cents,
  COALESCE(SUM(platform_fee_cents) FILTER (WHERE status = 'completed'), 0) as platform_fees_cents,
  COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed') as unique_clients
FROM product_purchases
WHERE purchased_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(purchased_at)
ORDER BY purchase_date DESC;

-- View for trainer earnings (per trainer aggregation)
CREATE OR REPLACE VIEW trainer_earnings_summary AS
SELECT 
  pp.trainer_id,
  p.display_name as trainer_name,
  COUNT(*) FILTER (WHERE pp.status = 'completed') as total_sales,
  COUNT(*) FILTER (WHERE pp.status = 'refunded') as total_refunds,
  COALESCE(SUM(pp.amount_total_cents) FILTER (WHERE pp.status = 'completed'), 0) as total_revenue_cents,
  COALESCE(SUM(pp.amount_total_cents - pp.platform_fee_cents) FILTER (WHERE pp.status = 'completed'), 0) as total_earnings_cents,
  COALESCE(SUM(pp.amount_total_cents) FILTER (WHERE pp.status = 'refunded'), 0) as total_refunded_cents,
  COUNT(DISTINCT pp.client_id) FILTER (WHERE pp.status = 'completed') as unique_clients,
  COUNT(DISTINCT pp.product_id) FILTER (WHERE pp.status = 'completed') as products_sold,
  MIN(pp.purchased_at) FILTER (WHERE pp.status = 'completed') as first_sale_at,
  MAX(pp.purchased_at) FILTER (WHERE pp.status = 'completed') as last_sale_at
FROM product_purchases pp
JOIN profiles p ON p.id = pp.trainer_id
GROUP BY pp.trainer_id, p.display_name;

-- View for product sales metrics
CREATE OR REPLACE VIEW product_sales_metrics AS
SELECT 
  tp.id as product_id,
  tp.trainer_id,
  tp.name as product_name,
  tp.product_type,
  tp.status as product_status,
  p.display_name as trainer_name,
  COUNT(pp.id) FILTER (WHERE pp.status = 'completed') as total_sales,
  COUNT(pp.id) FILTER (WHERE pp.status = 'refunded') as total_refunds,
  COALESCE(SUM(pp.amount_total_cents) FILTER (WHERE pp.status = 'completed'), 0) as total_revenue_cents,
  COUNT(DISTINCT pp.client_id) FILTER (WHERE pp.status = 'completed') as unique_buyers,
  MAX(pp.purchased_at) FILTER (WHERE pp.status = 'completed') as last_sale_at
FROM trainer_products tp
LEFT JOIN product_purchases pp ON pp.product_id = tp.id
LEFT JOIN profiles p ON p.id = tp.trainer_id
GROUP BY tp.id, tp.trainer_id, tp.name, tp.product_type, tp.status, p.display_name;

-- View for recent purchases (admin dashboard list)
CREATE OR REPLACE VIEW recent_purchases_admin AS
SELECT 
  pp.id as purchase_id,
  pp.product_id,
  tp.name as product_name,
  tp.product_type,
  pp.client_id,
  client.display_name as client_name,
  pp.trainer_id,
  trainer.display_name as trainer_name,
  pp.amount_total_cents,
  pp.platform_fee_cents,
  pp.currency,
  pp.status,
  pp.purchased_at,
  pp.fulfilled_at,
  pp.frozen_at,
  pp.refunded_at,
  pp.refund_reason,
  pp.stripe_checkout_session_id,
  pp.stripe_payment_intent_id
FROM product_purchases pp
JOIN trainer_products tp ON tp.id = pp.product_id
LEFT JOIN profiles client ON client.id = pp.client_id
LEFT JOIN profiles trainer ON trainer.id = pp.trainer_id
ORDER BY pp.purchased_at DESC;

-- ============================================================================
-- PART 2: Frozen Access Logic - RPC Functions
-- ============================================================================

-- Function to freeze all purchases for a user when their Premium lapses
-- Called from webhook handler when subscription status changes to canceled/expired
CREATE OR REPLACE FUNCTION freeze_user_purchases(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE product_purchases
  SET frozen_at = NOW(),
      updated_at = NOW()
  WHERE client_id = p_user_id
    AND status = 'completed'
    AND frozen_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Froze % purchases for user %', v_count, p_user_id;
  RETURN v_count;
END;
$$;

-- Function to unfreeze all purchases for a user when their Premium reactivates
-- Called from webhook handler when subscription becomes active again
CREATE OR REPLACE FUNCTION unfreeze_user_purchases(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE product_purchases
  SET frozen_at = NULL,
      updated_at = NOW()
  WHERE client_id = p_user_id
    AND status = 'completed'
    AND frozen_at IS NOT NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Unfroze % purchases for user %', v_count, p_user_id;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- PART 3: Checkout Session Tracking for Abandonment Analytics
-- ============================================================================

-- Table to track checkout sessions for abandonment analysis
CREATE TABLE IF NOT EXISTS checkout_sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  product_id UUID REFERENCES trainer_products(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  session_type TEXT NOT NULL CHECK (session_type IN ('product', 'subscription')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'completed', 'expired', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ
);

-- Indexes for checkout_sessions_log
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_client ON checkout_sessions_log(client_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions_log(status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_created ON checkout_sessions_log(created_at);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe_id ON checkout_sessions_log(stripe_session_id);

-- Enable RLS
ALTER TABLE checkout_sessions_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for checkout_sessions_log
CREATE POLICY "Service role full access checkout_sessions_log" ON checkout_sessions_log
  FOR ALL USING (auth.role() = 'service_role');

-- View for checkout abandonment metrics
CREATE OR REPLACE VIEW checkout_abandonment_metrics AS
SELECT 
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
  COUNT(*) FILTER (WHERE status = 'expired' OR status = 'abandoned') as abandoned_sessions,
  COUNT(*) FILTER (WHERE status = 'created') as pending_sessions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0),
    2
  ) as completion_rate_percent,
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed'), 0) as completed_revenue_cents,
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'expired' OR status = 'abandoned'), 0) as abandoned_revenue_cents
FROM checkout_sessions_log
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Daily checkout metrics for trend analysis
CREATE OR REPLACE VIEW checkout_metrics_daily AS
SELECT 
  DATE(created_at) as session_date,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'expired' OR status = 'abandoned') as abandoned,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0),
    2
  ) as completion_rate
FROM checkout_sessions_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY session_date DESC;

-- ============================================================================
-- PART 4: Webhook Event Summary View for Admin
-- ============================================================================

-- View for Connect webhook events summary (uses existing stripe_connect_webhook_events)
-- This assumes stripe_connect_webhook_events table exists from Phase 3
-- Note: Table uses processed_at timestamp, stripe_event_id, stripe_account_id columns
CREATE OR REPLACE VIEW webhook_events_summary AS
SELECT 
  event_type,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_count,
  COUNT(*) FILTER (WHERE processed_at IS NULL) as pending_count,
  MAX(processed_at) as last_event_at
FROM stripe_connect_webhook_events
WHERE processed_at >= NOW() - INTERVAL '7 days' OR processed_at IS NULL
GROUP BY event_type
ORDER BY total_events DESC;

-- View for unprocessed webhook events requiring attention
CREATE OR REPLACE VIEW webhook_events_requiring_attention AS
SELECT 
  id,
  stripe_event_id as event_id,
  event_type,
  stripe_account_id as account_id,
  (processed_at IS NOT NULL) as processed,
  processed_at,
  EXTRACT(EPOCH FROM (NOW() - processed_at)) / 3600 as hours_since_processed
FROM stripe_connect_webhook_events
WHERE processed_at IS NULL
ORDER BY id DESC;

-- ============================================================================
-- PART 5: Grant permissions
-- ============================================================================

-- Grant select on analytics views to authenticated users (admin check done in API)
GRANT SELECT ON marketplace_gmv_metrics TO authenticated;
GRANT SELECT ON marketplace_gmv_daily TO authenticated;
GRANT SELECT ON trainer_earnings_summary TO authenticated;
GRANT SELECT ON product_sales_metrics TO authenticated;
GRANT SELECT ON recent_purchases_admin TO authenticated;
GRANT SELECT ON checkout_abandonment_metrics TO authenticated;
GRANT SELECT ON checkout_metrics_daily TO authenticated;
GRANT SELECT ON webhook_events_summary TO authenticated;
GRANT SELECT ON webhook_events_requiring_attention TO authenticated;

-- Grant execute on freeze/unfreeze functions
GRANT EXECUTE ON FUNCTION freeze_user_purchases TO authenticated;
GRANT EXECUTE ON FUNCTION unfreeze_user_purchases TO authenticated;
