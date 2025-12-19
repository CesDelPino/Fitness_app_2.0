-- LOBA SaaS Migration: Routine Assignment System
-- Phase 1: Database Foundation
-- Tables: exercise_library, equipment_options, goal_types, routine_blueprints,
--         routine_versions, routine_version_exercises, routine_assignments, routine_ai_requests
-- See: docs/ROUTINE_ASSIGNMENT_ARCHITECTURE.md

-- ============================================
-- ADDITIONAL ENUMS
-- ============================================

CREATE TYPE routine_owner_type AS ENUM ('platform', 'professional', 'client_proxy');
CREATE TYPE routine_creation_method AS ENUM ('manual', 'template', 'ai_assisted');
CREATE TYPE routine_version_status AS ENUM ('draft', 'pending_review', 'active', 'archived');
CREATE TYPE routine_assignment_status AS ENUM ('active', 'paused', 'completed', 'cancelled');
CREATE TYPE ai_request_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE exercise_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');

-- ============================================
-- EQUIPMENT OPTIONS TABLE
-- Structured equipment list for selection UI
-- ============================================

CREATE TABLE equipment_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- free_weights, machines, racks_benches, cardio, other
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_options_category ON equipment_options(category);
CREATE INDEX idx_equipment_options_order ON equipment_options(display_order);

-- ============================================
-- GOAL TYPES TABLE
-- Training goal definitions
-- ============================================

CREATE TABLE goal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_rep_range TEXT, -- e.g., "8-12"
  default_rest_seconds INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_types_order ON goal_types(display_order);

-- ============================================
-- EXERCISE LIBRARY TABLE
-- Central repository of exercises (ready for future video integration)
-- ============================================

CREATE TABLE exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- strength, cardio, flexibility, compound, isolation
  muscle_groups TEXT[] NOT NULL DEFAULT '{}', -- primary muscles targeted
  equipment_tags TEXT[] NOT NULL DEFAULT '{}', -- required equipment
  difficulty_level exercise_difficulty NOT NULL DEFAULT 'intermediate',
  instructions TEXT,
  video_url TEXT, -- future use
  thumbnail_url TEXT, -- future use
  demonstration_notes TEXT, -- future use
  is_system BOOLEAN NOT NULL DEFAULT true, -- system-provided vs user-created
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercise_library_category ON exercise_library(category);
CREATE INDEX idx_exercise_library_muscle_groups ON exercise_library USING GIN(muscle_groups);
CREATE INDEX idx_exercise_library_equipment ON exercise_library USING GIN(equipment_tags);
CREATE INDEX idx_exercise_library_system ON exercise_library(is_system);
CREATE INDEX idx_exercise_library_name ON exercise_library(name);

CREATE TRIGGER update_exercise_library_updated_at
  BEFORE UPDATE ON exercise_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROUTINE BLUEPRINTS TABLE
-- Master routine definitions
-- ============================================

CREATE TABLE routine_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_type routine_owner_type NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- professional's user_id, null for platform
  created_for_client_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- for client_proxy type only
  creation_method routine_creation_method NOT NULL,
  source_blueprint_id UUID REFERENCES routine_blueprints(id) ON DELETE SET NULL, -- if cloned
  goal_type_id UUID REFERENCES goal_types(id) ON DELETE SET NULL,
  equipment_profile JSONB, -- selected equipment as JSON array
  duration_weeks INTEGER,
  sessions_per_week INTEGER,
  ai_prompt TEXT, -- original prompt if AI-created
  ai_response JSONB, -- AI's raw response for audit
  is_template BOOLEAN NOT NULL DEFAULT false, -- for system library
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routine_blueprints_owner ON routine_blueprints(owner_type, owner_id);
CREATE INDEX idx_routine_blueprints_client ON routine_blueprints(created_for_client_id);
CREATE INDEX idx_routine_blueprints_template ON routine_blueprints(is_template) WHERE is_template = true;
CREATE INDEX idx_routine_blueprints_goal ON routine_blueprints(goal_type_id);
CREATE INDEX idx_routine_blueprints_source ON routine_blueprints(source_blueprint_id);

CREATE TRIGGER update_routine_blueprints_updated_at
  BEFORE UPDATE ON routine_blueprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROUTINE VERSIONS TABLE
-- Version control for routines (enables draft/review workflow)
-- ============================================

CREATE TABLE routine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES routine_blueprints(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  status routine_version_status NOT NULL DEFAULT 'draft',
  notes TEXT, -- version notes/changes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(blueprint_id, version_number)
);

CREATE INDEX idx_routine_versions_blueprint ON routine_versions(blueprint_id);
CREATE INDEX idx_routine_versions_status ON routine_versions(status);

-- ============================================
-- ROUTINE VERSION EXERCISES TABLE
-- Exercises within a routine version
-- ============================================

CREATE TABLE routine_version_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_version_id UUID NOT NULL REFERENCES routine_versions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL, -- null if custom exercise
  custom_exercise_name TEXT, -- for exercises not in library
  day_number INTEGER NOT NULL, -- which day of the routine (1, 2, 3, etc.)
  order_in_day INTEGER NOT NULL, -- order within that day
  sets INTEGER NOT NULL DEFAULT 3,
  reps_min INTEGER,
  reps_max INTEGER,
  rest_seconds INTEGER,
  notes TEXT,
  superset_group TEXT, -- optional: for grouping supersets (e.g., "A", "B")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routine_version_exercises_version ON routine_version_exercises(routine_version_id);
CREATE INDEX idx_routine_version_exercises_exercise ON routine_version_exercises(exercise_id);
CREATE INDEX idx_routine_version_exercises_day ON routine_version_exercises(routine_version_id, day_number, order_in_day);

-- ============================================
-- ROUTINE ASSIGNMENTS TABLE
-- Links routines to clients
-- ============================================

CREATE TABLE routine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_version_id UUID NOT NULL REFERENCES routine_versions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by_pro_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- null if self-assigned
  status routine_assignment_status NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routine_assignments_client ON routine_assignments(client_id);
CREATE INDEX idx_routine_assignments_pro ON routine_assignments(assigned_by_pro_id);
CREATE INDEX idx_routine_assignments_version ON routine_assignments(routine_version_id);
CREATE INDEX idx_routine_assignments_status ON routine_assignments(status);
CREATE INDEX idx_routine_assignments_client_active ON routine_assignments(client_id, status) WHERE status = 'active';

CREATE TRIGGER update_routine_assignments_updated_at
  BEFORE UPDATE ON routine_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROUTINE AI REQUESTS TABLE
-- Audit trail for AI routine generation
-- ============================================

CREATE TABLE routine_ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_role TEXT NOT NULL, -- 'professional', 'client', 'admin'
  for_client_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- if pro requesting for client
  prompt_text TEXT NOT NULL,
  equipment_selected TEXT[] NOT NULL DEFAULT '{}',
  goal_type_id UUID REFERENCES goal_types(id) ON DELETE SET NULL,
  additional_params JSONB, -- sessions_per_week, duration, etc.
  ai_response JSONB,
  resulting_blueprint_id UUID REFERENCES routine_blueprints(id) ON DELETE SET NULL,
  status ai_request_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_routine_ai_requests_requester ON routine_ai_requests(requester_id);
CREATE INDEX idx_routine_ai_requests_status ON routine_ai_requests(status);
CREATE INDEX idx_routine_ai_requests_blueprint ON routine_ai_requests(resulting_blueprint_id);

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Check if user is professional
-- ============================================

CREATE OR REPLACE FUNCTION is_professional(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'professional'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Check if pro has relationship with client
-- ============================================

CREATE OR REPLACE FUNCTION pro_has_client_relationship(pro_id UUID, client_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM professional_client_relationships 
    WHERE professional_id = pro_id 
    AND client_id = client_id 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
