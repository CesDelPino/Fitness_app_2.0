-- Progress Photos Storage Bucket Setup
-- Creates storage bucket and RLS policies for progress photos

-- 1. Create the storage bucket (if not exists)
-- Note: Bucket creation is typically done via Supabase dashboard or API
-- This migration sets up the storage policies

-- 2. Storage RLS Policies for progress-photos bucket
-- These policies assume the bucket 'progress-photos' exists

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Users can upload own progress photos" ON storage.objects;
CREATE POLICY "Users can upload own progress photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to view their own photos
DROP POLICY IF EXISTS "Users can view own progress photos" ON storage.objects;
CREATE POLICY "Users can view own progress photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own photos
DROP POLICY IF EXISTS "Users can delete own progress photos" ON storage.objects;
CREATE POLICY "Users can delete own progress photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'progress-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update their own photos (for replacing)
DROP POLICY IF EXISTS "Users can update own progress photos" ON storage.objects;
CREATE POLICY "Users can update own progress photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'progress-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'progress-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow professionals to view client photos if they have permission
DROP POLICY IF EXISTS "Professionals can view client progress photos" ON storage.objects;
CREATE POLICY "Professionals can view client progress photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND EXISTS (
      SELECT 1 
      FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.id = pcr.professional_id
      JOIN client_permissions cp ON cp.relationship_id = pcr.id
      WHERE pcr.client_id::text = (storage.foldername(name))[1]
        AND pp.user_id = auth.uid()
        AND pcr.status = 'active'
        AND cp.permission_slug = 'view_progress_photos'
        AND cp.status = 'granted'
    )
  );

-- Note: The bucket must be created manually in Supabase dashboard with:
-- Name: progress-photos
-- Public: false (private bucket - use signed URLs)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
