-- LOBA SaaS RLS Policies
-- Run this after 001_initial_schema.sql

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_client_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weigh_ins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Check Active Relationship
-- ============================================

CREATE OR REPLACE FUNCTION has_active_relationship(
  p_professional_id UUID,
  p_client_id UUID,
  p_allowed_roles TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM professional_client_relationships
    WHERE professional_id = p_professional_id
    AND client_id = p_client_id
    AND status = 'active'
    AND role_type::TEXT = ANY(p_allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Verify invitation token and accept
-- This is the ONLY way to create a relationship
-- ============================================

CREATE OR REPLACE FUNCTION accept_invitation(
  p_token TEXT
) RETURNS JSONB AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
  v_relationship_id UUID;
BEGIN
  -- Find the invitation by hashed token
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token_hash = encode(sha256(p_token::bytea), 'hex')
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user email matches invitation email
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != v_invitation.email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;
  
  -- Update invitation status
  UPDATE invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  -- Create the relationship
  INSERT INTO professional_client_relationships (
    professional_id, client_id, role_type, status, invitation_id, invited_at, accepted_at
  )
  VALUES (
    v_invitation.professional_id,
    auth.uid(),
    v_invitation.role_type,
    'active',
    v_invitation.id,
    v_invitation.created_at,
    NOW()
  )
  RETURNING id INTO v_relationship_id;
  
  RETURN jsonb_build_object('success', true, 'relationship_id', v_relationship_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Promote user to professional
-- Only users with professional_signup metadata can use this
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
  -- Get user metadata
  SELECT raw_user_meta_data INTO v_user_metadata
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if user has professional_signup flag (COALESCE handles NULL/missing key)
  IF NOT COALESCE((v_user_metadata->>'professional_signup')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for professional signup');
  END IF;
  
  -- Update profile role to professional
  UPDATE profiles
  SET role = 'professional', updated_at = NOW()
  WHERE id = auth.uid();
  
  -- Create professional profile
  INSERT INTO professional_profiles (
    user_id, headline, bio, specialties, location_city, location_state
  )
  VALUES (
    auth.uid(),
    p_headline,
    p_bio,
    p_specialties,
    p_city,
    p_state
  )
  RETURNING id INTO v_professional_profile_id;
  
  -- Clear the professional_signup flag (optional, for security)
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'professional_signup'
  WHERE id = auth.uid();
  
  RETURN jsonb_build_object('success', true, 'professional_profile_id', v_professional_profile_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Create invitation (for professionals)
-- ============================================

CREATE OR REPLACE FUNCTION create_invitation(
  p_email TEXT,
  p_role_type professional_role_type,
  p_token TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_role user_role;
  v_invitation_id UUID;
BEGIN
  -- Verify caller is a professional
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
  IF v_user_role != 'professional' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only professionals can create invitations');
  END IF;
  
  -- Create the invitation with hashed token
  INSERT INTO invitations (
    professional_id, email, role_type, token_hash, expires_at
  )
  VALUES (
    auth.uid(),
    p_email,
    p_role_type,
    encode(sha256(p_token::bytea), 'hex'),
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_invitation_id;
  
  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (EXCEPT role field)
-- Role field is protected via CHECK constraint
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent users from changing their own role
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Professionals can read profiles of their active clients
CREATE POLICY "Professionals can read client profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships
      WHERE professional_id = auth.uid()
      AND client_id = profiles.id
      AND status = 'active'
    )
  );

-- Clients can read profiles of their active professionals
CREATE POLICY "Clients can read professional profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_client_relationships
      WHERE client_id = auth.uid()
      AND professional_id = profiles.id
      AND status = 'active'
    )
  );

-- ============================================
-- PROFESSIONAL PROFILES POLICIES
-- ============================================

-- Anyone can read professional profiles (for marketplace)
CREATE POLICY "Anyone can read professional profiles"
  ON professional_profiles FOR SELECT
  USING (true);

-- Professionals can insert their own profile (if their role is professional)
CREATE POLICY "Professionals can create own profile"
  ON professional_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'professional'
  );

-- Professionals can update their own profile
CREATE POLICY "Professionals can update own profile"
  ON professional_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- INVITATIONS POLICIES
-- Note: Direct access is restricted, use RPC functions instead
-- ============================================

-- Professionals can read their own invitations (to see status)
CREATE POLICY "Professionals can read own invitations"
  ON invitations FOR SELECT
  USING (auth.uid() = professional_id);

-- NO direct insert - use create_invitation RPC function
-- This prevents bypassing the professional role check

-- Professionals can update their own pending invitations (e.g., cancel)
CREATE POLICY "Professionals can update own invitations"
  ON invitations FOR UPDATE
  USING (auth.uid() = professional_id AND status = 'pending');

-- ============================================
-- RELATIONSHIPS POLICIES
-- Note: Relationships are created via accept_invitation RPC only
-- ============================================

-- Professionals can read their relationships
CREATE POLICY "Professionals can read own relationships"
  ON professional_client_relationships FOR SELECT
  USING (auth.uid() = professional_id);

-- Clients can read their relationships
CREATE POLICY "Clients can read own relationships"
  ON professional_client_relationships FOR SELECT
  USING (auth.uid() = client_id);

-- NO direct insert - use accept_invitation RPC function
-- This prevents creating arbitrary relationships

-- Professionals can end relationships (update to ended)
CREATE POLICY "Professionals can end relationships"
  ON professional_client_relationships FOR UPDATE
  USING (auth.uid() = professional_id AND status = 'active')
  WITH CHECK (status = 'ended');

-- Clients can end relationships (update to ended)
CREATE POLICY "Clients can end relationships"
  ON professional_client_relationships FOR UPDATE
  USING (auth.uid() = client_id AND status = 'active')
  WITH CHECK (status = 'ended');

-- ============================================
-- FOOD LOGS POLICIES
-- ============================================

-- Clients can read their own food logs
CREATE POLICY "Clients can read own food logs"
  ON food_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Clients can create their own food logs
CREATE POLICY "Clients can create own food logs"
  ON food_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() = logged_by_user_id);

-- Clients can update their own food logs
CREATE POLICY "Clients can update own food logs"
  ON food_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Clients can delete their own food logs
CREATE POLICY "Clients can delete own food logs"
  ON food_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Nutritionists/Coaches can read client food logs
CREATE POLICY "Nutritionists can read client food logs"
  ON food_logs FOR SELECT
  USING (
    has_active_relationship(auth.uid(), user_id, ARRAY['nutritionist', 'coach'])
  );

-- Nutritionists/Coaches can create food logs for clients
CREATE POLICY "Nutritionists can create client food logs"
  ON food_logs FOR INSERT
  WITH CHECK (
    has_active_relationship(auth.uid(), user_id, ARRAY['nutritionist', 'coach'])
    AND auth.uid() = logged_by_user_id
  );

-- ============================================
-- WORKOUT SESSIONS POLICIES
-- ============================================

-- Clients can read their own workout sessions
CREATE POLICY "Clients can read own workouts"
  ON workout_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Clients can create their own workout sessions
CREATE POLICY "Clients can create own workouts"
  ON workout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() = logged_by_user_id);

-- Clients can update their own workout sessions
CREATE POLICY "Clients can update own workouts"
  ON workout_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Clients can delete their own workout sessions
CREATE POLICY "Clients can delete own workouts"
  ON workout_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trainers/Coaches can read client workout sessions
CREATE POLICY "Trainers can read client workouts"
  ON workout_sessions FOR SELECT
  USING (
    has_active_relationship(auth.uid(), user_id, ARRAY['trainer', 'coach'])
  );

-- Trainers/Coaches can create workout sessions for clients
CREATE POLICY "Trainers can create client workouts"
  ON workout_sessions FOR INSERT
  WITH CHECK (
    has_active_relationship(auth.uid(), user_id, ARRAY['trainer', 'coach'])
    AND auth.uid() = logged_by_user_id
  );

-- ============================================
-- WEIGH-INS POLICIES
-- ============================================

-- Clients can read their own weigh-ins
CREATE POLICY "Clients can read own weigh-ins"
  ON weigh_ins FOR SELECT
  USING (auth.uid() = user_id);

-- Clients can create their own weigh-ins
CREATE POLICY "Clients can create own weigh-ins"
  ON weigh_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Clients can update their own weigh-ins
CREATE POLICY "Clients can update own weigh-ins"
  ON weigh_ins FOR UPDATE
  USING (auth.uid() = user_id);

-- Clients can delete their own weigh-ins
CREATE POLICY "Clients can delete own weigh-ins"
  ON weigh_ins FOR DELETE
  USING (auth.uid() = user_id);

-- All professionals can read client weigh-ins (weight is relevant to all)
CREATE POLICY "Professionals can read client weigh-ins"
  ON weigh_ins FOR SELECT
  USING (
    has_active_relationship(auth.uid(), user_id, ARRAY['nutritionist', 'trainer', 'coach'])
  );
