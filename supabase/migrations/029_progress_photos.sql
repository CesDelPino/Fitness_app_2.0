-- Progress Photos Table Migration
-- Standalone progress photos for client transformation tracking

-- 1. Create progress_photos table
CREATE TABLE IF NOT EXISTS progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_path TEXT NOT NULL,
  pose TEXT NOT NULL CHECK (pose IN ('front', 'side', 'back')),
  is_flexed BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_date ON progress_photos(user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_pose ON progress_photos(user_id, pose);

-- 3. Enable Row Level Security
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Clients can view their own photos
DROP POLICY IF EXISTS "Users can view own progress photos" ON progress_photos;
CREATE POLICY "Users can view own progress photos"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Clients can insert their own photos
DROP POLICY IF EXISTS "Users can insert own progress photos" ON progress_photos;
CREATE POLICY "Users can insert own progress photos"
  ON progress_photos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Clients can update their own photos (for notes)
DROP POLICY IF EXISTS "Users can update own progress photos" ON progress_photos;
CREATE POLICY "Users can update own progress photos"
  ON progress_photos FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Clients can delete their own photos
DROP POLICY IF EXISTS "Users can delete own progress photos" ON progress_photos;
CREATE POLICY "Users can delete own progress photos"
  ON progress_photos FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Professionals can view client photos if they have view_progress_photos permission
DROP POLICY IF EXISTS "Professionals can view client progress photos with permission" ON progress_photos;
CREATE POLICY "Professionals can view client progress photos with permission"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM professional_client_relationships pcr
      JOIN professional_profiles pp ON pp.id = pcr.professional_id
      JOIN client_permissions cp ON cp.relationship_id = pcr.id
      WHERE pcr.client_id = progress_photos.user_id
        AND pp.user_id = auth.uid()
        AND pcr.status = 'active'
        AND cp.permission_slug = 'view_progress_photos'
        AND cp.status = 'granted'
    )
  );

-- 5. Add comment for documentation
COMMENT ON TABLE progress_photos IS 'Standalone progress photos for client transformation tracking. Photos are categorized by pose (front/side/back) with optional flexed variant.';
COMMENT ON COLUMN progress_photos.pose IS 'Photo angle: front, side, or back';
COMMENT ON COLUMN progress_photos.is_flexed IS 'Whether the photo shows flexed muscles';
COMMENT ON COLUMN progress_photos.captured_at IS 'When the photo was taken (may differ from upload time)';
