-- Fix invitation cancellation RLS policy
-- The existing policy only allowed updates where status = 'pending' in both USING and WITH CHECK
-- This prevented changing status to 'expired' since the new row wouldn't match 'pending'

-- Drop the existing policy
DROP POLICY IF EXISTS "Professionals can update own invitations" ON invitations;

-- Create a corrected policy that:
-- - USING: Only allows updating invitations that are pending and belong to the professional
-- - WITH CHECK: Allows the new row to have status = 'expired' (for cancellation)
CREATE POLICY "Professionals can update own invitations"
  ON invitations FOR UPDATE
  USING (auth.uid() = professional_id AND status = 'pending')
  WITH CHECK (auth.uid() = professional_id AND status IN ('pending', 'expired'));
