-- Phase 1: Professional Profile Enhancements
-- Adds profile photo, certifications, experience years, and accepting clients toggle

-- ============================================
-- ADD NEW COLUMNS TO PROFESSIONAL_PROFILES
-- ============================================

ALTER TABLE professional_profiles 
ADD COLUMN IF NOT EXISTS profile_photo_path TEXT,
ADD COLUMN IF NOT EXISTS experience_years SMALLINT CHECK (experience_years >= 0 AND experience_years <= 80),
ADD COLUMN IF NOT EXISTS accepting_new_clients BOOLEAN NOT NULL DEFAULT true;

-- ============================================
-- CREATE PROFESSIONAL_CERTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS professional_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  date_earned DATE NOT NULL,
  expiration_date DATE,
  certificate_image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_certifications_user 
ON professional_certifications(user_id);

-- Updated_at trigger for certifications
CREATE TRIGGER update_professional_certifications_updated_at
  BEFORE UPDATE ON professional_certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS POLICIES FOR PROFESSIONAL_CERTIFICATIONS
-- ============================================

ALTER TABLE professional_certifications ENABLE ROW LEVEL SECURITY;

-- Professionals can read their own certifications
CREATE POLICY "Professionals can read own certifications"
  ON professional_certifications FOR SELECT
  USING (auth.uid() = user_id);

-- Professionals can create their own certifications
CREATE POLICY "Professionals can create own certifications"
  ON professional_certifications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'professional'
  );

-- Professionals can update their own certifications
CREATE POLICY "Professionals can update own certifications"
  ON professional_certifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Professionals can delete their own certifications
CREATE POLICY "Professionals can delete own certifications"
  ON professional_certifications FOR DELETE
  USING (auth.uid() = user_id);

-- Clients with active relationship can read professional's certifications
CREATE POLICY "Clients can read professional certifications"
  ON professional_certifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships
      WHERE client_id = auth.uid()
      AND professional_id = professional_certifications.user_id
      AND status = 'active'
    )
  );

-- Anyone can view certifications of any professional (for marketplace discovery)
CREATE POLICY "Anyone can view professional certifications"
  ON professional_certifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = professional_certifications.user_id 
      AND role = 'professional'
    )
  );

-- ============================================
-- UPDATE PROMOTE_TO_PROFESSIONAL RPC
-- Add default values for new fields
-- ============================================

CREATE OR REPLACE FUNCTION promote_to_professional(
  p_headline TEXT,
  p_bio TEXT DEFAULT NULL,
  p_specialties TEXT[] DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_metadata JSONB;
  v_professional_profile_id UUID;
BEGIN
  SELECT raw_user_meta_data INTO v_user_metadata
  FROM auth.users
  WHERE id = auth.uid();
  
  IF NOT COALESCE((v_user_metadata->>'professional_signup')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for professional signup');
  END IF;
  
  UPDATE profiles
  SET role = 'professional', updated_at = NOW()
  WHERE id = auth.uid();
  
  INSERT INTO professional_profiles (
    user_id, headline, bio, specialties, location_city, location_state,
    accepting_new_clients
  )
  VALUES (
    auth.uid(),
    p_headline,
    p_bio,
    p_specialties,
    p_city,
    p_state,
    true
  )
  RETURNING id INTO v_professional_profile_id;
  
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'professional_signup'
  WHERE id = auth.uid();
  
  RETURN jsonb_build_object('success', true, 'professional_profile_id', v_professional_profile_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
