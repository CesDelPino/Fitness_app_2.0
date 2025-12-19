-- Migration: Admin Users Table for Legacy Admin Panel
-- This migrates the admin_users table from Neon to Supabase

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS but add no policies - only service role can access
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON TABLE admin_users IS 'Admin users for legacy admin panel. Access restricted to service role only (no RLS policies = service role only access).';

-- Create index on username for fast lookups
CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users(username);
