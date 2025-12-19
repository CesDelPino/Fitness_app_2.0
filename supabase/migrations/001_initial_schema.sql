-- LOBA SaaS Initial Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('client', 'professional', 'admin');
CREATE TYPE professional_role_type AS ENUM ('nutritionist', 'trainer', 'coach');
CREATE TYPE relationship_status AS ENUM ('pending', 'active', 'ended');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- ============================================
-- PROFILES TABLE
-- Extends Supabase auth.users
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  current_weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,1),
  birthdate DATE,
  gender TEXT,
  activity_multiplier NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PROFESSIONAL PROFILES TABLE
-- ============================================

CREATE TABLE professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  headline TEXT,
  specialties TEXT[],
  credentials JSONB,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  pricing_summary TEXT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INVITATIONS TABLE
-- ============================================

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_type professional_role_type NOT NULL,
  token_hash TEXT NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_email ON invitations(email);

-- ============================================
-- PROFESSIONAL-CLIENT RELATIONSHIPS TABLE
-- ============================================

CREATE TABLE professional_client_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_type professional_role_type NOT NULL,
  status relationship_status NOT NULL DEFAULT 'pending',
  invitation_id UUID REFERENCES invitations(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  UNIQUE(professional_id, client_id, role_type)
);

CREATE INDEX idx_relationships_professional ON professional_client_relationships(professional_id);
CREATE INDEX idx_relationships_client ON professional_client_relationships(client_id);

-- ============================================
-- FOOD LOGS TABLE
-- ============================================

CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_by_user_id UUID NOT NULL REFERENCES profiles(id),
  food_name TEXT NOT NULL,
  serving_description TEXT,
  servings NUMERIC(6,2) NOT NULL DEFAULT 1,
  calories NUMERIC(7,2),
  protein NUMERIC(6,2),
  carbs NUMERIC(6,2),
  fat NUMERIC(6,2),
  fiber NUMERIC(6,2),
  sugar NUMERIC(6,2),
  meal_type meal_type NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_logs_user ON food_logs(user_id);
CREATE INDEX idx_food_logs_logged_at ON food_logs(logged_at);

-- ============================================
-- WORKOUT SESSIONS TABLE
-- ============================================

CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_by_user_id UUID NOT NULL REFERENCES profiles(id),
  routine_id UUID,
  name TEXT NOT NULL,
  exercises JSONB,
  duration_minutes INTEGER,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_sessions_user ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_logged_at ON workout_sessions(logged_at);

-- ============================================
-- WEIGH-INS TABLE
-- ============================================

CREATE TABLE weigh_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2) NOT NULL,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weigh_ins_user ON weigh_ins(user_id);
CREATE INDEX idx_weigh_ins_logged_at ON weigh_ins(logged_at);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_professional_profiles_updated_at
  BEFORE UPDATE ON professional_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
