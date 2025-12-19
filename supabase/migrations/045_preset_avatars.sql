-- Preset Avatars System
-- Allows admins to manage preset avatar options for users
--
-- IMPORTANT: You must also create a Supabase Storage bucket:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named "preset-avatars"
-- 3. Set it to PRIVATE (not public)
-- 4. The backend will generate signed URLs for access
--
-- ============================================
-- PRESET AVATARS TABLE
-- ============================================

CREATE TABLE preset_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('female', 'male', 'neutral')),
  image_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preset_avatars_gender ON preset_avatars(gender);
CREATE INDEX idx_preset_avatars_active ON preset_avatars(is_active);

-- ============================================
-- ADD PRESET_AVATAR_ID TO PROFILES
-- ============================================

ALTER TABLE profiles 
ADD COLUMN preset_avatar_id UUID REFERENCES preset_avatars(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_preset_avatar ON profiles(preset_avatar_id);

-- ============================================
-- RLS POLICIES FOR PRESET AVATARS
-- ============================================

ALTER TABLE preset_avatars ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active preset avatars
CREATE POLICY "Users can view active preset avatars"
  ON preset_avatars
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role has full access (for admin operations)
CREATE POLICY "Service role has full access to preset avatars"
  ON preset_avatars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
