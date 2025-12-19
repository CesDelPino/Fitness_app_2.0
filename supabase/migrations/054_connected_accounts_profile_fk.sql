-- Phase 2: Add Foreign Key from connected_accounts to profiles
-- This enables Supabase join syntax and ensures data integrity
-- Run this migration in Supabase SQL Editor AFTER migration 053

-- Add foreign key constraint from connected_accounts.user_id to profiles.id
-- Note: This assumes all existing connected_accounts have valid profile references
ALTER TABLE connected_accounts
ADD CONSTRAINT fk_connected_accounts_profile
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Create index for the foreign key if not exists (improves join performance)
CREATE INDEX IF NOT EXISTS idx_connected_accounts_profile_id ON connected_accounts(user_id);
