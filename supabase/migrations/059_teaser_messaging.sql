-- Phase 7: Teaser Messaging - Message Limits for Free Users
-- Run this migration in Supabase SQL Editor

-- ============================================================================
-- PART 1: Teaser Message Usage Table
-- ============================================================================

-- Table to track teaser message usage between clients and trainers
-- Each row represents a client-trainer relationship's message allowance
CREATE TABLE IF NOT EXISTS teaser_message_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_messages_sent INTEGER NOT NULL DEFAULT 0 CHECK (client_messages_sent >= 0),
  trainer_messages_sent INTEGER NOT NULL DEFAULT 0 CHECK (trainer_messages_sent >= 0),
  client_last_message_at TIMESTAMPTZ,
  trainer_last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, trainer_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_teaser_usage_client ON teaser_message_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_teaser_usage_trainer ON teaser_message_usage(trainer_id);
CREATE INDEX IF NOT EXISTS idx_teaser_usage_pair ON teaser_message_usage(client_id, trainer_id);

-- Enable RLS
ALTER TABLE teaser_message_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: RLS Policies
-- ============================================================================

-- Users can view their own teaser usage (as client or trainer)
CREATE POLICY "Users can view own teaser usage" ON teaser_message_usage
  FOR SELECT USING (
    auth.uid() = client_id OR auth.uid() = trainer_id
  );

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access teaser_message_usage" ON teaser_message_usage
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 3: Teaser Limits Configuration
-- ============================================================================

-- Configurable teaser message limits (stored in a simple config table)
CREATE TABLE IF NOT EXISTS teaser_message_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value INTEGER NOT NULL CHECK (config_value >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default limits: 4 messages per side
INSERT INTO teaser_message_config (config_key, config_value, description) VALUES
  ('client_message_limit', 4, 'Maximum teaser messages a free client can send to each trainer'),
  ('trainer_reply_limit', 4, 'Maximum teaser replies a trainer can send to each free client')
ON CONFLICT (config_key) DO NOTHING;

-- RLS for config
ALTER TABLE teaser_message_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config (for display purposes)
CREATE POLICY "Anyone can view teaser config" ON teaser_message_config
  FOR SELECT USING (TRUE);

-- Only service role can modify
CREATE POLICY "Service role full access teaser_message_config" ON teaser_message_config
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 4: Helper Function to Check Premium Status
-- ============================================================================

-- Function to check if a user has active premium subscription
CREATE OR REPLACE FUNCTION is_user_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM user_subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- Premium users have 'active' or 'trialing' status
  RETURN v_status IN ('active', 'trialing');
END;
$$;

-- ============================================================================
-- PART 5: Atomic Increment RPC for Teaser Messages
-- ============================================================================

-- Function to atomically check and increment teaser message count
-- p_sender_id: The user sending the message
-- p_conversation_pro_id: The professional_id from the conversation
-- p_conversation_client_id: The client_id from the conversation
-- Returns: { success: boolean, messages_sent: integer, limit: integer, remaining: integer, bypassed: boolean, error?: string }
CREATE OR REPLACE FUNCTION increment_teaser_message(
  p_sender_id UUID,
  p_conversation_pro_id UUID,
  p_conversation_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_client BOOLEAN;
  v_is_trainer BOOLEAN;
  v_client_id UUID;
  v_trainer_id UUID;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_new_count INTEGER;
  v_is_premium BOOLEAN;
BEGIN
  -- Determine who is sending (client or trainer)
  v_is_client := p_sender_id = p_conversation_client_id;
  v_is_trainer := p_sender_id = p_conversation_pro_id;
  
  IF NOT v_is_client AND NOT v_is_trainer THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Sender is not part of this conversation',
      'messages_sent', 0,
      'limit', 0,
      'remaining', 0,
      'bypassed', FALSE
    );
  END IF;
  
  -- Set client and trainer IDs
  v_client_id := p_conversation_client_id;
  v_trainer_id := p_conversation_pro_id;
  
  -- Check if the CLIENT has premium (this determines if limits apply)
  v_is_premium := is_user_premium(v_client_id);
  
  -- If client is premium, bypass all limits
  IF v_is_premium THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'messages_sent', 0,
      'limit', 0,
      'remaining', 0,
      'bypassed', TRUE
    );
  END IF;
  
  -- Get the appropriate limit
  IF v_is_client THEN
    SELECT config_value INTO v_limit
    FROM teaser_message_config
    WHERE config_key = 'client_message_limit';
  ELSE
    SELECT config_value INTO v_limit
    FROM teaser_message_config
    WHERE config_key = 'trainer_reply_limit';
  END IF;
  
  IF v_limit IS NULL THEN
    v_limit := 4; -- Default fallback
  END IF;
  
  -- Upsert the usage row
  INSERT INTO teaser_message_usage (client_id, trainer_id, client_messages_sent, trainer_messages_sent)
  VALUES (v_client_id, v_trainer_id, 0, 0)
  ON CONFLICT (client_id, trainer_id) DO NOTHING;
  
  -- Lock the row and get current count
  IF v_is_client THEN
    SELECT client_messages_sent INTO v_current_count
    FROM teaser_message_usage
    WHERE client_id = v_client_id AND trainer_id = v_trainer_id
    FOR UPDATE;
  ELSE
    SELECT trainer_messages_sent INTO v_current_count
    FROM teaser_message_usage
    WHERE client_id = v_client_id AND trainer_id = v_trainer_id
    FOR UPDATE;
  END IF;
  
  v_current_count := COALESCE(v_current_count, 0);
  
  -- Check if incrementing would exceed limit
  v_new_count := v_current_count + 1;
  
  IF v_new_count > v_limit THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Teaser message limit exceeded',
      'messages_sent', v_current_count,
      'limit', v_limit,
      'remaining', 0,
      'bypassed', FALSE
    );
  END IF;
  
  -- Increment the appropriate counter
  IF v_is_client THEN
    UPDATE teaser_message_usage
    SET client_messages_sent = v_new_count,
        client_last_message_at = NOW(),
        updated_at = NOW()
    WHERE client_id = v_client_id AND trainer_id = v_trainer_id;
  ELSE
    UPDATE teaser_message_usage
    SET trainer_messages_sent = v_new_count,
        trainer_last_message_at = NOW(),
        updated_at = NOW()
    WHERE client_id = v_client_id AND trainer_id = v_trainer_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'messages_sent', v_new_count,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_new_count),
    'bypassed', FALSE
  );
END;
$$;

-- ============================================================================
-- PART 6: Get Teaser Usage Status RPC
-- ============================================================================

-- Function to get teaser usage status for a specific conversation
-- Can be called by either party in the conversation
CREATE OR REPLACE FUNCTION get_teaser_usage_status(
  p_user_id UUID,
  p_conversation_pro_id UUID,
  p_conversation_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_client BOOLEAN;
  v_is_trainer BOOLEAN;
  v_client_id UUID;
  v_trainer_id UUID;
  v_client_messages INTEGER;
  v_trainer_messages INTEGER;
  v_client_limit INTEGER;
  v_trainer_limit INTEGER;
  v_is_premium BOOLEAN;
BEGIN
  -- Determine who is asking
  v_is_client := p_user_id = p_conversation_client_id;
  v_is_trainer := p_user_id = p_conversation_pro_id;
  
  IF NOT v_is_client AND NOT v_is_trainer THEN
    RETURN jsonb_build_object(
      'error', 'User is not part of this conversation'
    );
  END IF;
  
  v_client_id := p_conversation_client_id;
  v_trainer_id := p_conversation_pro_id;
  
  -- Check if client is premium
  v_is_premium := is_user_premium(v_client_id);
  
  -- If client is premium, return unlimited status
  IF v_is_premium THEN
    RETURN jsonb_build_object(
      'is_premium', TRUE,
      'client_messages_sent', 0,
      'client_limit', 0,
      'client_remaining', -1,
      'trainer_messages_sent', 0,
      'trainer_limit', 0,
      'trainer_remaining', -1,
      'is_client_blocked', FALSE,
      'is_trainer_blocked', FALSE
    );
  END IF;
  
  -- Get limits
  SELECT config_value INTO v_client_limit
  FROM teaser_message_config
  WHERE config_key = 'client_message_limit';
  v_client_limit := COALESCE(v_client_limit, 4);
  
  SELECT config_value INTO v_trainer_limit
  FROM teaser_message_config
  WHERE config_key = 'trainer_reply_limit';
  v_trainer_limit := COALESCE(v_trainer_limit, 4);
  
  -- Get current usage
  SELECT client_messages_sent, trainer_messages_sent
  INTO v_client_messages, v_trainer_messages
  FROM teaser_message_usage
  WHERE client_id = v_client_id AND trainer_id = v_trainer_id;
  
  v_client_messages := COALESCE(v_client_messages, 0);
  v_trainer_messages := COALESCE(v_trainer_messages, 0);
  
  RETURN jsonb_build_object(
    'is_premium', FALSE,
    'client_messages_sent', v_client_messages,
    'client_limit', v_client_limit,
    'client_remaining', GREATEST(0, v_client_limit - v_client_messages),
    'trainer_messages_sent', v_trainer_messages,
    'trainer_limit', v_trainer_limit,
    'trainer_remaining', GREATEST(0, v_trainer_limit - v_trainer_messages),
    'is_client_blocked', v_client_messages >= v_client_limit,
    'is_trainer_blocked', v_trainer_messages >= v_trainer_limit
  );
END;
$$;

-- ============================================================================
-- PART 7: View for Admin Metrics
-- ============================================================================

-- View for teaser message analytics
CREATE OR REPLACE VIEW teaser_messaging_metrics AS
SELECT
  COUNT(*) AS total_relationships,
  COUNT(*) FILTER (WHERE client_messages_sent > 0) AS relationships_with_client_messages,
  COUNT(*) FILTER (WHERE trainer_messages_sent > 0) AS relationships_with_trainer_messages,
  SUM(client_messages_sent) AS total_client_messages,
  SUM(trainer_messages_sent) AS total_trainer_messages,
  COUNT(*) FILTER (WHERE client_messages_sent >= 4) AS clients_at_limit,
  COUNT(*) FILTER (WHERE trainer_messages_sent >= 4) AS trainers_at_limit,
  ROUND(AVG(client_messages_sent), 2) AS avg_client_messages,
  ROUND(AVG(trainer_messages_sent), 2) AS avg_trainer_messages
FROM teaser_message_usage;

-- Grant access to the view
GRANT SELECT ON teaser_messaging_metrics TO authenticated;
