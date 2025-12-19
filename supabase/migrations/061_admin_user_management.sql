-- Admin User Management: Add columns for premium override and soft delete
-- Run this migration in your Supabase SQL Editor

-- Add admin_premium_override column for admin-granted premium access
-- This JSONB column stores: { active, granted_by, granted_at, expires_at, reason }
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS admin_premium_override jsonb DEFAULT NULL;

-- Add soft delete columns for user deletion
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_by text DEFAULT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

-- Create index for deleted_at to optimize queries filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);

-- Create index for admin_premium_override to quickly find users with overrides
CREATE INDEX IF NOT EXISTS idx_profiles_admin_override ON profiles((admin_premium_override->>'active'));

COMMENT ON COLUMN profiles.admin_premium_override IS 'Admin-granted premium access override. JSON structure: { active: boolean, granted_by: string, granted_at: timestamp, expires_at: timestamp|null, reason: string }';
COMMENT ON COLUMN profiles.deleted_at IS 'Soft delete timestamp. NULL means user is active.';
COMMENT ON COLUMN profiles.deleted_by IS 'Admin username who deleted the user';
COMMENT ON COLUMN profiles.deleted_reason IS 'Reason for user deletion';
