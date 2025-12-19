-- Fix infinite recursion in profiles UPDATE policy
-- The original policy did a SELECT from profiles in WITH CHECK, 
-- which triggered RLS policies recursively

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create a SECURITY DEFINER function to get current role without triggering RLS
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate the policy using the helper function
-- This prevents recursion because SECURITY DEFINER functions bypass RLS
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent users from changing their own role
    -- Uses SECURITY DEFINER function to avoid RLS recursion
    role = get_user_role(auth.uid())
  );

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
