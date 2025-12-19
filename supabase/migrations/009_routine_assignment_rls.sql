-- LOBA SaaS Migration: Routine Assignment RLS Policies
-- Phase 1: Row-Level Security for routine assignment tables
-- See: docs/ROUTINE_ASSIGNMENT_ARCHITECTURE.md

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE equipment_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_version_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_ai_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- EQUIPMENT OPTIONS POLICIES
-- Read: All authenticated users
-- Write: Admins only
-- ============================================

CREATE POLICY "equipment_options_select_all"
  ON equipment_options FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "equipment_options_insert_admin"
  ON equipment_options FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "equipment_options_update_admin"
  ON equipment_options FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "equipment_options_delete_admin"
  ON equipment_options FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================
-- GOAL TYPES POLICIES
-- Read: All authenticated users
-- Write: Admins only
-- ============================================

CREATE POLICY "goal_types_select_all"
  ON goal_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "goal_types_insert_admin"
  ON goal_types FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "goal_types_update_admin"
  ON goal_types FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "goal_types_delete_admin"
  ON goal_types FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================
-- EXERCISE LIBRARY POLICIES
-- Read: All authenticated users
-- Write: Admins for system exercises, creators for their own
-- ============================================

CREATE POLICY "exercise_library_select_all"
  ON exercise_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "exercise_library_insert_admin"
  ON exercise_library FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid()) 
    OR (is_system = false AND created_by = auth.uid())
  );

CREATE POLICY "exercise_library_update"
  ON exercise_library FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (is_system = false AND created_by = auth.uid())
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR (is_system = false AND created_by = auth.uid())
  );

CREATE POLICY "exercise_library_delete"
  ON exercise_library FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (is_system = false AND created_by = auth.uid())
  );

-- ============================================
-- ROUTINE BLUEPRINTS POLICIES
-- Complex ownership model: platform, professional, client_proxy
-- ============================================

-- SELECT: View blueprints user owns, platform templates, client's blueprints, or assigned via routine_assignments
CREATE POLICY "routine_blueprints_select"
  ON routine_blueprints FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all
    is_admin(auth.uid())
    -- Platform templates are visible to all
    OR (owner_type = 'platform' AND is_template = true)
    -- Professionals can see their own
    OR (owner_type = 'professional' AND owner_id = auth.uid())
    -- Clients can see blueprints created for them
    OR (owner_type = 'client_proxy' AND created_for_client_id = auth.uid())
    -- Professionals can see client_proxy blueprints if they have relationship with the client
    OR (
      owner_type = 'client_proxy' 
      AND is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), created_for_client_id)
    )
    -- Clients can see blueprints assigned to them via routine_assignments
    OR EXISTS (
      SELECT 1 FROM routine_versions rv
      JOIN routine_assignments ra ON ra.routine_version_id = rv.id
      WHERE rv.blueprint_id = routine_blueprints.id
      AND ra.client_id = auth.uid()
      AND ra.status IN ('active', 'paused', 'completed')
    )
  );

-- INSERT: Admins create platform, pros create professional, anyone creates client_proxy for themselves
CREATE POLICY "routine_blueprints_insert"
  ON routine_blueprints FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can create platform blueprints
    (owner_type = 'platform' AND is_admin(auth.uid()))
    -- Professionals can create their own blueprints
    OR (owner_type = 'professional' AND owner_id = auth.uid() AND is_professional(auth.uid()))
    -- Anyone can create client_proxy blueprints for themselves (AI-generated)
    OR (owner_type = 'client_proxy' AND created_for_client_id = auth.uid())
    -- Professionals can create client_proxy blueprints for their clients
    OR (
      owner_type = 'client_proxy'
      AND is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), created_for_client_id)
    )
  );

-- UPDATE: Admins update platform, owners update their own
CREATE POLICY "routine_blueprints_update"
  ON routine_blueprints FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (owner_type = 'professional' AND owner_id = auth.uid())
    OR (owner_type = 'client_proxy' AND created_for_client_id = auth.uid())
    -- Professionals can update client_proxy blueprints if they have relationship
    OR (
      owner_type = 'client_proxy'
      AND is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), created_for_client_id)
    )
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR (owner_type = 'professional' AND owner_id = auth.uid())
    OR (owner_type = 'client_proxy' AND created_for_client_id = auth.uid())
    OR (
      owner_type = 'client_proxy'
      AND is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), created_for_client_id)
    )
  );

-- DELETE: Admins delete platform, owners delete their own
CREATE POLICY "routine_blueprints_delete"
  ON routine_blueprints FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (owner_type = 'professional' AND owner_id = auth.uid())
  );

-- ============================================
-- ROUTINE VERSIONS POLICIES
-- Inherits access from parent blueprint
-- ============================================

CREATE POLICY "routine_versions_select"
  ON routine_versions FOR SELECT
  TO authenticated
  USING (
    -- Access via parent blueprint ownership
    EXISTS (
      SELECT 1 FROM routine_blueprints rb
      WHERE rb.id = routine_versions.blueprint_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'platform' AND rb.is_template = true)
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
    -- OR access via routine_assignments (clients can see versions assigned to them)
    OR EXISTS (
      SELECT 1 FROM routine_assignments ra
      WHERE ra.routine_version_id = routine_versions.id
      AND ra.client_id = auth.uid()
      AND ra.status IN ('active', 'paused', 'completed')
    )
  );

CREATE POLICY "routine_versions_insert"
  ON routine_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routine_blueprints rb
      WHERE rb.id = routine_versions.blueprint_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
  );

CREATE POLICY "routine_versions_update"
  ON routine_versions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routine_blueprints rb
      WHERE rb.id = routine_versions.blueprint_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routine_blueprints rb
      WHERE rb.id = routine_versions.blueprint_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
  );

CREATE POLICY "routine_versions_delete"
  ON routine_versions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routine_blueprints rb
      WHERE rb.id = routine_versions.blueprint_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
      )
    )
  );

-- ============================================
-- ROUTINE VERSION EXERCISES POLICIES
-- Inherits from routine version -> blueprint
-- ============================================

CREATE POLICY "routine_version_exercises_select"
  ON routine_version_exercises FOR SELECT
  TO authenticated
  USING (
    -- Access via parent blueprint ownership
    EXISTS (
      SELECT 1 FROM routine_versions rv
      JOIN routine_blueprints rb ON rb.id = rv.blueprint_id
      WHERE rv.id = routine_version_exercises.routine_version_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'platform' AND rb.is_template = true)
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
    -- OR access via routine_assignments (clients can see exercises in assigned versions)
    OR EXISTS (
      SELECT 1 FROM routine_assignments ra
      WHERE ra.routine_version_id = routine_version_exercises.routine_version_id
      AND ra.client_id = auth.uid()
      AND ra.status IN ('active', 'paused', 'completed')
    )
  );

CREATE POLICY "routine_version_exercises_insert"
  ON routine_version_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routine_versions rv
      JOIN routine_blueprints rb ON rb.id = rv.blueprint_id
      WHERE rv.id = routine_version_exercises.routine_version_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
  );

CREATE POLICY "routine_version_exercises_update"
  ON routine_version_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routine_versions rv
      JOIN routine_blueprints rb ON rb.id = rv.blueprint_id
      WHERE rv.id = routine_version_exercises.routine_version_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routine_versions rv
      JOIN routine_blueprints rb ON rb.id = rv.blueprint_id
      WHERE rv.id = routine_version_exercises.routine_version_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
        OR (rb.owner_type = 'client_proxy' AND rb.created_for_client_id = auth.uid())
        OR (
          rb.owner_type = 'client_proxy'
          AND is_professional(auth.uid())
          AND pro_has_client_relationship(auth.uid(), rb.created_for_client_id)
        )
      )
    )
  );

CREATE POLICY "routine_version_exercises_delete"
  ON routine_version_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routine_versions rv
      JOIN routine_blueprints rb ON rb.id = rv.blueprint_id
      WHERE rv.id = routine_version_exercises.routine_version_id
      AND (
        is_admin(auth.uid())
        OR (rb.owner_type = 'professional' AND rb.owner_id = auth.uid())
      )
    )
  );

-- ============================================
-- ROUTINE ASSIGNMENTS POLICIES
-- Clients see their own, pros see their clients'
-- ============================================

CREATE POLICY "routine_assignments_select"
  ON routine_assignments FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR client_id = auth.uid()
    OR assigned_by_pro_id = auth.uid()
    OR (
      is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), client_id)
    )
  );

CREATE POLICY "routine_assignments_insert"
  ON routine_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    -- Client self-assigns (for AI-generated routines)
    OR (client_id = auth.uid() AND assigned_by_pro_id IS NULL)
    -- Pro assigns to their client
    OR (
      assigned_by_pro_id = auth.uid()
      AND is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), client_id)
    )
  );

CREATE POLICY "routine_assignments_update"
  ON routine_assignments FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR client_id = auth.uid()
    OR assigned_by_pro_id = auth.uid()
    OR (
      is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), client_id)
    )
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR client_id = auth.uid()
    OR assigned_by_pro_id = auth.uid()
    OR (
      is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), client_id)
    )
  );

CREATE POLICY "routine_assignments_delete"
  ON routine_assignments FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR assigned_by_pro_id = auth.uid()
  );

-- ============================================
-- ROUTINE AI REQUESTS POLICIES
-- Users see their own requests
-- ============================================

CREATE POLICY "routine_ai_requests_select"
  ON routine_ai_requests FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR requester_id = auth.uid()
    -- Pro can see requests for their clients
    OR (
      for_client_id IS NOT NULL
      AND is_professional(auth.uid())
      AND pro_has_client_relationship(auth.uid(), for_client_id)
    )
  );

CREATE POLICY "routine_ai_requests_insert"
  ON routine_ai_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND (
      -- Requesting for self
      for_client_id IS NULL
      -- Or pro requesting for client
      OR (
        is_professional(auth.uid())
        AND pro_has_client_relationship(auth.uid(), for_client_id)
      )
    )
  );

CREATE POLICY "routine_ai_requests_update"
  ON routine_ai_requests FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR requester_id = auth.uid()
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR requester_id = auth.uid()
  );

-- No delete policy - AI requests are audit records
