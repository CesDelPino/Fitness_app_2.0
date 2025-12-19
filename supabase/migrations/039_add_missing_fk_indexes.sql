-- Migration 039: Add missing indexes on foreign key columns
-- These indexes improve JOIN and DELETE performance on foreign key lookups
-- Using IF NOT EXISTS so this is safe to re-run

-- check_in_answers
CREATE INDEX IF NOT EXISTS idx_check_in_answers_question_id 
  ON check_in_answers(question_id);

-- check_in_submissions
CREATE INDEX IF NOT EXISTS idx_check_in_submissions_template_version_id 
  ON check_in_submissions(template_version_id);

-- check_in_template_assignments
CREATE INDEX IF NOT EXISTS idx_check_in_template_assignments_template_id 
  ON check_in_template_assignments(template_id);

CREATE INDEX IF NOT EXISTS idx_check_in_template_assignments_template_version_id 
  ON check_in_template_assignments(template_version_id);

-- check_in_templates
CREATE INDEX IF NOT EXISTS idx_check_in_templates_active_version_id 
  ON check_in_templates(active_version_id);

-- exercise_library
CREATE INDEX IF NOT EXISTS idx_exercise_library_created_by 
  ON exercise_library(created_by);

-- fasts
CREATE INDEX IF NOT EXISTS idx_fasts_breaking_food_log_id 
  ON fasts(breaking_food_log_id);

-- food_logs
CREATE INDEX IF NOT EXISTS idx_food_logs_logged_by_user_id 
  ON food_logs(logged_by_user_id);

-- invitations
CREATE INDEX IF NOT EXISTS idx_invitations_professional_id 
  ON invitations(professional_id);

-- permission_audit_log
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_target_professional_id 
  ON permission_audit_log(target_professional_id);

CREATE INDEX IF NOT EXISTS idx_permission_audit_log_target_relationship_id 
  ON permission_audit_log(target_relationship_id);

-- permission_presets
CREATE INDEX IF NOT EXISTS idx_permission_presets_created_by 
  ON permission_presets(created_by);

-- permission_requests
CREATE INDEX IF NOT EXISTS idx_permission_requests_permission_slug 
  ON permission_requests(permission_slug);

-- professional_client_relationships
CREATE INDEX IF NOT EXISTS idx_professional_client_relationships_invitation_id 
  ON professional_client_relationships(invitation_id);

-- professional_profiles
CREATE INDEX IF NOT EXISTS idx_professional_profiles_verification_reviewed_by 
  ON professional_profiles(verification_reviewed_by);

-- routine_ai_requests
CREATE INDEX IF NOT EXISTS idx_routine_ai_requests_for_client_id 
  ON routine_ai_requests(for_client_id);

CREATE INDEX IF NOT EXISTS idx_routine_ai_requests_goal_type_id 
  ON routine_ai_requests(goal_type_id);

-- routine_assignment_update_events
CREATE INDEX IF NOT EXISTS idx_routine_assignment_update_events_from_version_id 
  ON routine_assignment_update_events(from_version_id);

CREATE INDEX IF NOT EXISTS idx_routine_assignment_update_events_performed_by 
  ON routine_assignment_update_events(performed_by);

CREATE INDEX IF NOT EXISTS idx_routine_assignment_update_events_to_version_id 
  ON routine_assignment_update_events(to_version_id);

-- routine_blueprints
CREATE INDEX IF NOT EXISTS idx_routine_blueprints_owner_id 
  ON routine_blueprints(owner_id);

-- unread_counts
CREATE INDEX IF NOT EXISTS idx_unread_counts_conversation_id 
  ON unread_counts(conversation_id);

-- workout_sessions
CREATE INDEX IF NOT EXISTS idx_workout_sessions_logged_by_user_id 
  ON workout_sessions(logged_by_user_id);
