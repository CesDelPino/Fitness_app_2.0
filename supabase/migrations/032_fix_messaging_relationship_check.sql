-- Fix messaging relationship check to handle both ID formats
-- The professional_client_relationships.professional_id field currently stores user.id (profiles.id)
-- but the original check expected professional_profiles.id. This fix allows both formats.

-- ============================================================================
-- 1. UPDATE get_or_create_conversation RPC
-- ============================================================================

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
  -- NOTE: Handle both formats - pcr.professional_id could be professional_profiles.id OR user.id
  IF NOT EXISTS (
    SELECT 1 FROM professional_client_relationships pcr
    JOIN professional_profiles pp ON pp.id = pcr.professional_id OR pp.user_id = pcr.professional_id
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

-- ============================================================================
-- 2. UPDATE conversations INSERT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can create conversations with connected users" ON conversations;
CREATE POLICY "Users can create conversations with connected users"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (professional_id = auth.uid() OR client_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.id = pcr.professional_id OR pp.user_id = pcr.professional_id
      WHERE pcr.status = 'active'
        AND (
          (pp.user_id = conversations.professional_id AND pcr.client_id = conversations.client_id)
          OR (pp.user_id = conversations.client_id AND pcr.client_id = conversations.professional_id)
        )
    )
  );

COMMENT ON FUNCTION get_or_create_conversation IS 'Creates or retrieves a conversation between a professional and client. Handles both ID formats in professional_client_relationships.';
