-- Storage policies for storefront-media bucket
-- Run this after creating the "storefront-media" bucket in Supabase Dashboard > Storage
-- This bucket stores storefront media: hero images, intro videos, service images, testimonial photos, transformation photos
-- Structure: {trainerId}/{type}/{filename}.{ext}
-- Types: hero, video, services, testimonials, transformations

-- Policy 1: Trainers can upload their own storefront media
CREATE POLICY "Trainers can upload own storefront media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'storefront-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] IN ('hero', 'video', 'services', 'testimonials', 'transformations')
);

-- Policy 2: Trainers can update their own storefront media
CREATE POLICY "Trainers can update own storefront media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'storefront-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Trainers can delete their own storefront media
CREATE POLICY "Trainers can delete own storefront media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'storefront-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Anyone can read storefront media (public access for storefronts)
CREATE POLICY "Anyone can read storefront media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'storefront-media');

-- Note: Create the bucket manually in Supabase Dashboard with these settings:
-- Name: storefront-media
-- Public bucket: YES (for public storefront access)
-- File size limit: 50MB (for video support)
-- Allowed MIME types: image/*, video/mp4, video/webm
