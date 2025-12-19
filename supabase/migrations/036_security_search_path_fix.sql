-- Migration: Fix function search_path security issues
-- Purpose: Set immutable search_path on all functions to prevent search path manipulation attacks
-- Also enables RLS on routine_assignment_events table
-- 
-- NOTE: Functions in 022_audit_logging.sql, 023_exclusivity_refactor.sql, 
--       024_verification_system.sql, and 025_permission_presets.sql already 
--       have SET search_path = public in their CREATE statements, so they are skipped here.

-- ============================================
-- ENABLE RLS ON ROUTINE_ASSIGNMENT_EVENTS
-- ============================================

ALTER TABLE routine_assignment_events ENABLE ROW LEVEL SECURITY;

-- Policy: Professionals can view events for their assigned routines
CREATE POLICY "Professionals can view assignment events"
  ON routine_assignment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routine_assignments ra
      WHERE ra.id = routine_assignment_events.assignment_id
      AND ra.assigned_by_pro_id = auth.uid()
    )
  );

-- Policy: Clients can view events for their own assignments
CREATE POLICY "Clients can view own assignment events"
  ON routine_assignment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routine_assignments ra
      WHERE ra.id = routine_assignment_events.assignment_id
      AND ra.client_id = auth.uid()
    )
  );

-- ============================================
-- SET IMMUTABLE SEARCH_PATH ON ALL FUNCTIONS
-- This prevents search path manipulation attacks
-- ============================================

-- 001_initial_schema.sql functions
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';

-- 002_rls_policies.sql functions
ALTER FUNCTION public.has_active_relationship(UUID, UUID, TEXT[]) SET search_path = '';
ALTER FUNCTION public.accept_invitation(TEXT) SET search_path = '';
ALTER FUNCTION public.promote_to_professional(TEXT, TEXT, TEXT[], TEXT, TEXT) SET search_path = '';
ALTER FUNCTION public.create_invitation(TEXT, public.professional_role_type, TEXT) SET search_path = '';

-- 006_health_data_rls.sql functions
ALTER FUNCTION public.can_view_user_data(UUID, public.professional_role_type) SET search_path = '';
ALTER FUNCTION public.get_accessible_clients(public.professional_role_type) SET search_path = '';

-- 008_routine_assignment_system.sql functions
ALTER FUNCTION public.is_admin(UUID) SET search_path = '';
ALTER FUNCTION public.is_professional(UUID) SET search_path = '';
ALTER FUNCTION public.pro_has_client_relationship(UUID, UUID) SET search_path = '';

-- 012_routine_assignment_events.sql functions
ALTER FUNCTION public.log_assignment_event() SET search_path = '';

-- 013_client_programme_acceptance.sql functions
ALTER FUNCTION public.get_client_tier(UUID) SET search_path = '';
ALTER FUNCTION public.cleanup_old_rejected_assignments() SET search_path = '';

-- 014_programme_update_flow.sql functions
ALTER FUNCTION public.log_assignment_update_event() SET search_path = '';
ALTER FUNCTION public.clear_pending_update(UUID) SET search_path = '';
ALTER FUNCTION public.push_programme_update(UUID, UUID, TEXT) SET search_path = '';

-- 015_expire_pending_update_rpc.sql functions
ALTER FUNCTION public.expire_pending_update(UUID, UUID, UUID, UUID, INTEGER) SET search_path = '';

-- 018_weekly_checkin_system.sql functions
ALTER FUNCTION public.update_check_in_updated_at() SET search_path = '';

-- 020_permission_system.sql functions
ALTER FUNCTION public.migrate_role_to_permissions(UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.has_permission(UUID, UUID, VARCHAR) SET search_path = '';
ALTER FUNCTION public.set_client_id_on_permission() SET search_path = '';

-- 023_exclusivity_refactor.sql functions
ALTER FUNCTION public.sync_perm_is_exclusive() SET search_path = '';

-- 021_invitation_permissions.sql functions
ALTER FUNCTION public.get_role_default_permissions(TEXT) SET search_path = '';
ALTER FUNCTION public.create_invitation_with_permissions(TEXT, TEXT, TEXT, TEXT[]) SET search_path = '';
ALTER FUNCTION public.fetch_invitation_details(TEXT) SET search_path = '';
ALTER FUNCTION public.get_client_permission_requests() SET search_path = '';
ALTER FUNCTION public.respond_to_permission_request(UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.create_permission_request(UUID, TEXT) SET search_path = '';

-- 021_invitation_permissions.sql - original token-based version
ALTER FUNCTION public.finalize_invitation_permissions(TEXT, TEXT[], TEXT[]) SET search_path = '';

-- 026_rename_notes_to_message.sql - UUID-based version
ALTER FUNCTION public.finalize_invitation_permissions(UUID, TEXT[], TEXT[]) SET search_path = '';

-- 031_messaging_schema.sql functions
ALTER FUNCTION public.increment_unread_count() SET search_path = '';
ALTER FUNCTION public.get_or_create_conversation(UUID, UUID) SET search_path = '';
ALTER FUNCTION public.mark_messages_read(UUID, UUID, UUID) SET search_path = '';
ALTER FUNCTION public.get_total_unread_count(UUID) SET search_path = '';
ALTER FUNCTION public.cleanup_expired_voice_memos() SET search_path = '';

-- 034_nutrition_targets.sql functions
ALTER FUNCTION public.update_nutrition_targets_updated_at() SET search_path = '';
ALTER FUNCTION public.log_nutrition_target_action(UUID, TEXT, UUID) SET search_path = '';

-- 035_daily_water_intake.sql functions
ALTER FUNCTION public.increment_daily_water(UUID, DATE, INTEGER, VARCHAR) SET search_path = '';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE routine_assignment_events IS 'Audit log of routine assignment changes - now RLS protected';
