-- Storage policies for professional-assets bucket
-- Run this after creating the "professional-assets" bucket in Supabase Dashboard > Storage
-- This bucket stores ONLY certification documents (NOT profile photos - those go in profile-photos bucket)
-- Structure: {userId}/certifications/{certificationId}.{ext}

-- Policy 1: Professionals can upload their own certification documents
CREATE POLICY "Professionals can upload own certifications"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'professional-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'certifications'
);

-- Policy 2: Professionals can update their own certification documents
CREATE POLICY "Professionals can update own certifications"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'professional-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'certifications'
);

-- Policy 3: Professionals can delete their own certification documents
CREATE POLICY "Professionals can delete own certifications"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'professional-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'certifications'
);

-- Policy 4: Professionals can read their own certification documents
CREATE POLICY "Professionals can read own certifications"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'professional-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'certifications'
);
