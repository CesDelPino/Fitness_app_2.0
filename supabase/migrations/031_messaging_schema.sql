-- Messaging System Schema Migration
-- Phase 6A: In-App Communication between professionals and clients

-- ============================================================================
-- 1. CONVERSATIONS TABLE
-- One conversation per professional-client pair
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  UNIQUE(professional_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_professional ON conversations(professional_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id, last_message_at DESC);

COMMENT ON TABLE conversations IS 'One conversation per professional-client pair for direct messaging';
COMMENT ON COLUMN conversations.last_message_preview IS 'First 100 chars of last message for list view';

-- ============================================================================
-- 2. MESSAGES TABLE
-- Text messages with delivery status tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'system')),
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent ON messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

COMMENT ON TABLE messages IS 'Text and voice messages within conversations';
COMMENT ON COLUMN messages.message_type IS 'text = regular message, voice = has voice_message attachment, system = automated notification';
COMMENT ON COLUMN messages.delivery_status IS 'pending = not yet sent, sent = delivered to server, delivered = received by client app, failed = send failed';

-- ============================================================================
-- 3. VOICE MESSAGES TABLE
-- Audio attachments with 14-day expiry
-- ============================================================================
CREATE TABLE IF NOT EXISTS voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 120),
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'audio/webm',
  waveform_data JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_messages_expires ON voice_messages(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voice_messages_message ON voice_messages(message_id);

COMMENT ON TABLE voice_messages IS 'Voice memo attachments with 14-day auto-expiry';
COMMENT ON COLUMN voice_messages.duration_seconds IS 'Audio duration (max 120 seconds / 2 minutes)';
COMMENT ON COLUMN voice_messages.waveform_data IS 'Pre-computed waveform for visualization';
COMMENT ON COLUMN voice_messages.expires_at IS 'Auto-delete after this timestamp (14 days from creation)';

-- ============================================================================
-- 4. UNREAD COUNTS TABLE
-- Materialized counts maintained via triggers for performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS unread_counts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0 CHECK (unread_count >= 0),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_id)
);

COMMENT ON TABLE unread_counts IS 'Materialized unread message counts per user per conversation';

-- ============================================================================
-- 5. MESSAGING PREFERENCES TABLE
-- User notification settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS messaging_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  muted_conversations UUID[] DEFAULT '{}',
  push_token TEXT,
  push_platform TEXT CHECK (push_platform IS NULL OR push_platform IN ('web', 'android', 'ios')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE messaging_preferences IS 'Per-user messaging notification preferences';
COMMENT ON COLUMN messaging_preferences.quiet_hours_start IS 'Start of quiet hours (no notifications)';
COMMENT ON COLUMN messaging_preferences.quiet_hours_end IS 'End of quiet hours';
COMMENT ON COLUMN messaging_preferences.muted_conversations IS 'Array of conversation IDs to suppress notifications for';
COMMENT ON COLUMN messaging_preferences.push_token IS 'FCM/APNs token for push notifications';

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS POLICIES - CONVERSATIONS
-- ============================================================================

-- Users can view conversations they are part of
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid() OR client_id = auth.uid());

-- Conversations are created via RPC (see below), not direct insert
-- But allow insert for the RPC function context
DROP POLICY IF EXISTS "Users can create conversations with connected users" ON conversations;
CREATE POLICY "Users can create conversations with connected users"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (professional_id = auth.uid() OR client_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.id = pcr.professional_id
      WHERE pcr.status = 'active'
        AND (
          (pp.user_id = conversations.professional_id AND pcr.client_id = conversations.client_id)
          OR (pp.user_id = conversations.client_id AND pcr.client_id = conversations.professional_id)
        )
    )
  );

-- Users can update conversations they're part of (for last_message_at)
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid() OR client_id = auth.uid());

-- ============================================================================
-- 8. RLS POLICIES - MESSAGES
-- ============================================================================

-- Users can view messages in their conversations
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE professional_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- Users can send messages to their conversations
DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE professional_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- Users can update messages (for read_at, delivered_at)
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON messages;
CREATE POLICY "Users can update messages in own conversations"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE professional_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. RLS POLICIES - VOICE MESSAGES
-- ============================================================================

-- Users can view voice messages in their conversations
DROP POLICY IF EXISTS "Users can view voice messages in own conversations" ON voice_messages;
CREATE POLICY "Users can view voice messages in own conversations"
  ON voice_messages FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.professional_id = auth.uid() OR c.client_id = auth.uid()
    )
  );

-- Users can insert voice messages for their own messages
DROP POLICY IF EXISTS "Users can insert voice messages for own messages" ON voice_messages;
CREATE POLICY "Users can insert voice messages for own messages"
  ON voice_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    message_id IN (
      SELECT id FROM messages
      WHERE sender_id = auth.uid()
    )
  );

-- ============================================================================
-- 10. RLS POLICIES - UNREAD COUNTS
-- ============================================================================

-- Users can only view their own unread counts
DROP POLICY IF EXISTS "Users can view own unread counts" ON unread_counts;
CREATE POLICY "Users can view own unread counts"
  ON unread_counts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Unread counts are managed by triggers, not direct user updates
-- But we need INSERT/UPDATE for trigger functions
DROP POLICY IF EXISTS "System can manage unread counts" ON unread_counts;
CREATE POLICY "System can manage unread counts"
  ON unread_counts FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 11. RLS POLICIES - MESSAGING PREFERENCES
-- ============================================================================

-- Users can only view/modify their own preferences
DROP POLICY IF EXISTS "Users can view own messaging preferences" ON messaging_preferences;
CREATE POLICY "Users can view own messaging preferences"
  ON messaging_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own messaging preferences" ON messaging_preferences;
CREATE POLICY "Users can insert own messaging preferences"
  ON messaging_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own messaging preferences" ON messaging_preferences;
CREATE POLICY "Users can update own messaging preferences"
  ON messaging_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 12. TRIGGERS FOR UNREAD COUNT MANAGEMENT
-- ============================================================================

-- Function to increment unread count when a message is sent
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  conv RECORD;
BEGIN
  -- Get conversation details
  SELECT * INTO conv FROM conversations WHERE id = NEW.conversation_id;
  
  -- Determine recipient (the other party in the conversation)
  IF NEW.sender_id = conv.professional_id THEN
    recipient_id := conv.client_id;
  ELSE
    recipient_id := conv.professional_id;
  END IF;
  
  -- Upsert unread count for recipient
  INSERT INTO unread_counts (user_id, conversation_id, unread_count, last_updated)
  VALUES (recipient_id, NEW.conversation_id, 1, NOW())
  ON CONFLICT (user_id, conversation_id)
  DO UPDATE SET 
    unread_count = unread_counts.unread_count + 1,
    last_updated = NOW();
  
  -- Update conversation's last message timestamp and preview
  UPDATE conversations 
  SET 
    last_message_at = NEW.sent_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_increment_unread_count ON messages;
CREATE TRIGGER trigger_increment_unread_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_unread_count();

-- Note: Unread count reset is handled by the mark_messages_read RPC function,
-- not by a trigger, since we need the user_id passed explicitly for service-role calls.

-- ============================================================================
-- 13. RPC FUNCTIONS
-- ============================================================================

-- Get or create a conversation between two users
-- Note: p_current_user_id is passed explicitly since service-role calls don't have auth.uid()
CREATE OR REPLACE FUNCTION get_or_create_conversation(p_current_user_id UUID, p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  is_current_user_pro BOOLEAN;
  pro_id UUID;
  cli_id UUID;
BEGIN
  -- Check if current user is a professional
  SELECT EXISTS (
    SELECT 1 FROM professional_profiles WHERE user_id = p_current_user_id
  ) INTO is_current_user_pro;
  
  -- Determine professional_id and client_id based on roles
  IF is_current_user_pro THEN
    pro_id := p_current_user_id;
    cli_id := p_other_user_id;
  ELSE
    pro_id := p_other_user_id;
    cli_id := p_current_user_id;
  END IF;
  
  -- Verify there's an active relationship
  IF NOT EXISTS (
    SELECT 1 FROM professional_client_relationships pcr
    JOIN professional_profiles pp ON pp.id = pcr.professional_id
    WHERE pcr.status = 'active'
      AND pp.user_id = pro_id
      AND pcr.client_id = cli_id
  ) THEN
    RAISE EXCEPTION 'No active relationship exists between these users';
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO conv_id
  FROM conversations
  WHERE professional_id = pro_id AND client_id = cli_id;
  
  -- Create if not exists
  IF conv_id IS NULL THEN
    INSERT INTO conversations (professional_id, client_id)
    VALUES (pro_id, cli_id)
    RETURNING id INTO conv_id;
  END IF;
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all messages as read up to a specific message
-- Note: p_user_id is passed explicitly since service-role calls don't have auth.uid()
CREATE OR REPLACE FUNCTION mark_messages_read(p_user_id UUID, p_conversation_id UUID, p_up_to_message_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
  up_to_timestamp TIMESTAMPTZ;
BEGIN
  -- If specific message provided, get its timestamp
  IF p_up_to_message_id IS NOT NULL THEN
    SELECT sent_at INTO up_to_timestamp
    FROM messages
    WHERE id = p_up_to_message_id;
  END IF;
  
  -- Mark messages as read (those NOT sent by the current user)
  WITH updated AS (
    UPDATE messages
    SET read_at = NOW()
    WHERE conversation_id = p_conversation_id
      AND sender_id != p_user_id
      AND read_at IS NULL
      AND (up_to_timestamp IS NULL OR sent_at <= up_to_timestamp)
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  -- Reset unread count for this conversation
  UPDATE unread_counts
  SET unread_count = 0, last_updated = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total unread count across all conversations
-- Note: p_user_id is passed explicitly since service-role calls don't have auth.uid()
CREATE OR REPLACE FUNCTION get_total_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(unread_count) FROM unread_counts WHERE user_id = p_user_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. VOICE MEMO CLEANUP FUNCTION (for scheduled job)
-- ============================================================================

-- Function to delete expired voice memos and their storage files
-- This should be called by a scheduled job (e.g., pg_cron or external cron)
CREATE OR REPLACE FUNCTION cleanup_expired_voice_memos()
RETURNS TABLE(deleted_count INTEGER, storage_paths TEXT[]) AS $$
DECLARE
  paths TEXT[];
  count INTEGER;
BEGIN
  -- Get storage paths of expired voice memos
  SELECT ARRAY_AGG(storage_path) INTO paths
  FROM voice_messages
  WHERE expires_at < NOW() AND deleted_at IS NULL;
  
  -- Soft delete expired voice memos
  WITH deleted AS (
    UPDATE voice_messages
    SET deleted_at = NOW()
    WHERE expires_at < NOW() AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO count FROM deleted;
  
  RETURN QUERY SELECT count, COALESCE(paths, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_voice_memos IS 'Marks expired voice memos as deleted and returns storage paths for external cleanup';
