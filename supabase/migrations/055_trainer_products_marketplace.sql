-- Phase 3: Marketplace Payments & Products - Database Tables
-- Run this migration in Supabase SQL Editor

-- Product status enum for state machine
-- States: draft -> pending_review -> approved/rejected -> archived
-- Live = approved + at least one active price

-- Trainer Products table - stores products created by trainers
CREATE TABLE IF NOT EXISTS trainer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_product_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('one_time', 'subscription', 'package', 'free')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  rejection_reason TEXT,
  media_urls TEXT[] DEFAULT '{}',
  features_included TEXT[] DEFAULT '{}',
  publish_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trainer_products
CREATE INDEX IF NOT EXISTS idx_trainer_products_trainer_id ON trainer_products(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_products_status ON trainer_products(status);
CREATE INDEX IF NOT EXISTS idx_trainer_products_stripe_product_id ON trainer_products(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_trainer_products_trainer_status ON trainer_products(trainer_id, status);

-- Product Pricing table - stores pricing options for products
CREATE TABLE IF NOT EXISTS product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES trainer_products(id) ON DELETE CASCADE,
  stripe_price_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT CHECK (billing_interval IN ('day', 'week', 'month', 'year')),
  interval_count INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for product_pricing
CREATE INDEX IF NOT EXISTS idx_product_pricing_product_id ON product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_stripe_price_id ON product_pricing(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_active ON product_pricing(product_id, is_active) WHERE is_active = TRUE;

-- Product Purchases table - tracks client purchases of trainer products
CREATE TABLE IF NOT EXISTS product_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES trainer_products(id) ON DELETE RESTRICT,
  pricing_id UUID REFERENCES product_pricing(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  amount_total_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requires_action', 'completed', 'refunded', 'canceled')),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  frozen_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  access_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for product_purchases
CREATE INDEX IF NOT EXISTS idx_product_purchases_client_id ON product_purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_trainer_id ON product_purchases(trainer_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_product_id ON product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_status ON product_purchases(status);
CREATE INDEX IF NOT EXISTS idx_product_purchases_client_status ON product_purchases(client_id, status);
CREATE INDEX IF NOT EXISTS idx_product_purchases_trainer_status ON product_purchases(trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_product_purchases_checkout_session ON product_purchases(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_payment_intent ON product_purchases(stripe_payment_intent_id);

-- Enable RLS on new tables
ALTER TABLE trainer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trainer_products

-- Trainers can view and manage their own products
CREATE POLICY "Trainers can view own products" ON trainer_products
  FOR SELECT USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can insert own products" ON trainer_products
  FOR INSERT WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can update own draft/pending products" ON trainer_products
  FOR UPDATE USING (
    auth.uid() = trainer_id 
    AND status IN ('draft', 'pending_review', 'rejected')
  );

-- Clients can view approved products (for browsing marketplace)
CREATE POLICY "Anyone can view approved products" ON trainer_products
  FOR SELECT USING (status = 'approved');

-- Service role full access
CREATE POLICY "Service role full access trainer_products" ON trainer_products
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for product_pricing

-- Anyone can view active pricing for approved products
CREATE POLICY "Anyone can view active pricing" ON product_pricing
  FOR SELECT USING (
    is_active = TRUE 
    AND EXISTS (
      SELECT 1 FROM trainer_products 
      WHERE trainer_products.id = product_pricing.product_id 
      AND trainer_products.status = 'approved'
    )
  );

-- Trainers can view all pricing for their own products
CREATE POLICY "Trainers can view own product pricing" ON product_pricing
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_products 
      WHERE trainer_products.id = product_pricing.product_id 
      AND trainer_products.trainer_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access product_pricing" ON product_pricing
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for product_purchases

-- Clients can view their own purchases
CREATE POLICY "Clients can view own purchases" ON product_purchases
  FOR SELECT USING (auth.uid() = client_id);

-- Trainers can view purchases of their products
CREATE POLICY "Trainers can view purchases of own products" ON product_purchases
  FOR SELECT USING (auth.uid() = trainer_id);

-- Service role full access
CREATE POLICY "Service role full access product_purchases" ON product_purchases
  FOR ALL USING (auth.role() = 'service_role');

-- View for fast purchase access entitlement checks
CREATE OR REPLACE VIEW purchase_access AS
SELECT 
  pp.id as purchase_id,
  pp.client_id,
  pp.trainer_id,
  pp.product_id,
  tp.name as product_name,
  tp.product_type,
  pp.status as purchase_status,
  pp.purchased_at,
  pp.fulfilled_at,
  pp.frozen_at,
  pp.access_expires_at,
  CASE 
    WHEN pp.status != 'completed' THEN FALSE
    WHEN pp.frozen_at IS NOT NULL THEN FALSE
    WHEN pp.access_expires_at IS NOT NULL AND pp.access_expires_at < NOW() THEN FALSE
    ELSE TRUE
  END as has_access
FROM product_purchases pp
JOIN trainer_products tp ON tp.id = pp.product_id;

-- RPC function to submit product for review
CREATE OR REPLACE FUNCTION submit_product_for_review(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trainer_id UUID;
  v_status TEXT;
  v_has_connect BOOLEAN;
BEGIN
  -- Get product info
  SELECT trainer_id, status INTO v_trainer_id, v_status
  FROM trainer_products
  WHERE id = p_product_id;
  
  -- Verify ownership
  IF v_trainer_id IS NULL OR v_trainer_id != auth.uid() THEN
    RAISE EXCEPTION 'Product not found or not owned by user';
  END IF;
  
  -- Verify status allows submission
  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Product cannot be submitted from current status: %', v_status;
  END IF;
  
  -- Verify trainer has completed Connect onboarding
  SELECT charges_enabled AND payouts_enabled INTO v_has_connect
  FROM connected_accounts
  WHERE user_id = v_trainer_id;
  
  IF v_has_connect IS NULL OR v_has_connect = FALSE THEN
    RAISE EXCEPTION 'Complete Stripe Connect onboarding before submitting products';
  END IF;
  
  -- Update product status
  UPDATE trainer_products
  SET status = 'pending_review',
      submitted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_product_id;
  
  RETURN TRUE;
END;
$$;

-- RPC function for admin to approve product
CREATE OR REPLACE FUNCTION approve_product(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE trainer_products
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid(),
      rejection_reason = NULL,
      updated_at = NOW()
  WHERE id = p_product_id
    AND status = 'pending_review';
  
  RETURN FOUND;
END;
$$;

-- RPC function for admin to reject product
CREATE OR REPLACE FUNCTION reject_product(p_product_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE trainer_products
  SET status = 'rejected',
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_product_id
    AND status = 'pending_review';
  
  RETURN FOUND;
END;
$$;

-- RPC function to archive product (trainer action)
CREATE OR REPLACE FUNCTION archive_product(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trainer_id UUID;
BEGIN
  -- Get trainer_id
  SELECT trainer_id INTO v_trainer_id
  FROM trainer_products
  WHERE id = p_product_id;
  
  -- Verify ownership
  IF v_trainer_id IS NULL OR v_trainer_id != auth.uid() THEN
    RAISE EXCEPTION 'Product not found or not owned by user';
  END IF;
  
  UPDATE trainer_products
  SET status = 'archived',
      updated_at = NOW()
  WHERE id = p_product_id;
  
  RETURN TRUE;
END;
$$;

-- RPC function to check if client has access to a product
CREATE OR REPLACE FUNCTION check_product_access(p_client_id UUID, p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  SELECT has_access INTO v_has_access
  FROM purchase_access
  WHERE client_id = p_client_id
    AND product_id = p_product_id
  ORDER BY purchased_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_has_access, FALSE);
END;
$$;

-- RPC function to record a purchase (called after webhook confirmation)
CREATE OR REPLACE FUNCTION record_product_purchase(
  p_product_id UUID,
  p_pricing_id UUID,
  p_client_id UUID,
  p_trainer_id UUID,
  p_checkout_session_id TEXT,
  p_payment_intent_id TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT DEFAULT 'usd'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  INSERT INTO product_purchases (
    product_id,
    pricing_id,
    client_id,
    trainer_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    amount_total_cents,
    currency,
    status,
    fulfilled_at
  ) VALUES (
    p_product_id,
    p_pricing_id,
    p_client_id,
    p_trainer_id,
    p_checkout_session_id,
    p_payment_intent_id,
    p_amount_cents,
    p_currency,
    'completed',
    NOW()
  )
  ON CONFLICT (stripe_checkout_session_id) DO UPDATE
  SET status = 'completed',
      fulfilled_at = NOW(),
      updated_at = NOW()
  RETURNING id INTO v_purchase_id;
  
  RETURN v_purchase_id;
END;
$$;

-- Add unique constraint on checkout_session_id for idempotency
ALTER TABLE product_purchases 
ADD CONSTRAINT unique_checkout_session 
UNIQUE (stripe_checkout_session_id);

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION submit_product_for_review TO authenticated;
GRANT EXECUTE ON FUNCTION approve_product TO service_role;
GRANT EXECUTE ON FUNCTION reject_product TO service_role;
GRANT EXECUTE ON FUNCTION archive_product TO authenticated;
GRANT EXECUTE ON FUNCTION check_product_access TO authenticated;
GRANT EXECUTE ON FUNCTION record_product_purchase TO service_role;
