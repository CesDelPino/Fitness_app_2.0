-- Storage policies for profile-photos bucket
-- Run this after creating the "profile-photos" bucket in Supabase Dashboard > Storage

-- Policy 1: Users can upload their own photos
CREATE POLICY "Users can upload own photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can update their own photos
CREATE POLICY "Users can update own photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own photos
CREATE POLICY "Users can delete own photo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can read their own photos
CREATE POLICY "Users can read own photo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
