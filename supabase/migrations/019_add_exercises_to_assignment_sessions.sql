-- Migration: Add exercises JSONB column to routine_assignment_sessions
-- Purpose: Store denormalized exercise data for client display
-- This allows clients to see all exercises in their assigned routines

-- ============================================
-- ADD EXERCISES JSONB COLUMN
-- ============================================

ALTER TABLE routine_assignment_sessions 
ADD COLUMN IF NOT EXISTS exercises JSONB;

COMMENT ON COLUMN routine_assignment_sessions.exercises IS 'Denormalized exercise data for display: [{exercise_id, name, sets, reps_min, reps_max, rest_seconds, notes, order_in_day, load_directive}]';

-- Index for potential exercise queries (e.g., finding all sessions with a specific exercise)
CREATE INDEX IF NOT EXISTS idx_assignment_sessions_exercises 
ON routine_assignment_sessions USING GIN (exercises);
