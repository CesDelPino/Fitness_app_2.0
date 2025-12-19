-- Profile Photos System
-- Allows clients to upload their own profile photos as primary option
-- with preset avatars as fallback
--
-- IMPORTANT: You must also create a Supabase Storage bucket:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named "profile-photos"
-- 3. Set it to PRIVATE (not public)
-- 4. Add RLS policies as shown below
--
-- ============================================
-- ADD PROFILE_PHOTO_PATH TO PROFILES
-- ============================================

ALTER TABLE profiles 
ADD COLUMN profile_photo_path TEXT DEFAULT NULL;

-- ============================================
-- MUTUAL EXCLUSIVITY CONSTRAINT
-- ============================================
-- Users can have either an uploaded photo OR a preset avatar, not both

ALTER TABLE profiles
ADD CONSTRAINT profiles_photo_xor_preset 
CHECK (
  (profile_photo_path IS NULL) OR (preset_avatar_id IS NULL)
);

-- ============================================
-- STORAGE BUCKET RLS POLICIES
-- ============================================
-- Run these in Supabase Dashboard > Storage > Policies
-- after creating the profile-photos bucket:
--
-- Policy 1: Users can upload their own photos
-- Name: "Users can upload own photo"
-- Allowed operation: INSERT
-- Target roles: authenticated
-- Policy definition: (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 2: Users can update their own photos
-- Name: "Users can update own photo"
-- Allowed operation: UPDATE
-- Target roles: authenticated
-- Policy definition: (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 3: Users can delete their own photos
-- Name: "Users can delete own photo"
-- Allowed operation: DELETE
-- Target roles: authenticated
-- Policy definition: (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 4: Users can read their own photos (for signed URLs)
-- Name: "Users can read own photo"
-- Allowed operation: SELECT
-- Target roles: authenticated
-- Policy definition: (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 5: Service role has full access
-- This is automatic for service_role key
