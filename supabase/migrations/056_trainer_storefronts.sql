-- Phase 4: Trainer Storefronts - Database Tables
-- Run this migration in Supabase SQL Editor

-- Trainer Storefronts table - stores public storefront settings for trainers
CREATE TABLE IF NOT EXISTS trainer_storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT,
  bio TEXT,
  cover_image_url TEXT,
  specialties TEXT[] DEFAULT '{}',
  credentials TEXT[] DEFAULT '{}',
  experience_years INTEGER,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trainer_storefronts
CREATE INDEX IF NOT EXISTS idx_trainer_storefronts_trainer_id ON trainer_storefronts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_storefronts_slug ON trainer_storefronts(slug);
CREATE INDEX IF NOT EXISTS idx_trainer_storefronts_published ON trainer_storefronts(is_published) WHERE is_published = TRUE;

-- Slug validation - lowercase alphanumeric and hyphens, 3-50 chars
ALTER TABLE trainer_storefronts 
  ADD CONSTRAINT slug_format CHECK (
    slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'
  );

-- Reserved slugs that cannot be used
CREATE OR REPLACE FUNCTION check_reserved_slug()
RETURNS TRIGGER AS $$
DECLARE
  reserved_slugs TEXT[] := ARRAY[
    'admin', 'api', 'app', 'auth', 'blog', 'dashboard', 'help', 
    'login', 'logout', 'marketplace', 'privacy', 'pro', 'profile',
    'settings', 'shop', 'signup', 'support', 'terms', 'trainer', 'trainers'
  ];
BEGIN
  IF NEW.slug = ANY(reserved_slugs) THEN
    RAISE EXCEPTION 'This URL is reserved and cannot be used';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_reserved_slug_trigger
  BEFORE INSERT OR UPDATE OF slug ON trainer_storefronts
  FOR EACH ROW EXECUTE FUNCTION check_reserved_slug();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trainer_storefronts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trainer_storefronts_updated_at
  BEFORE UPDATE ON trainer_storefronts
  FOR EACH ROW EXECUTE FUNCTION update_trainer_storefronts_updated_at();

-- Enable RLS on trainer_storefronts
ALTER TABLE trainer_storefronts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trainer_storefronts

-- Trainers can view and manage their own storefront
CREATE POLICY "Trainers can view own storefront" ON trainer_storefronts
  FOR SELECT USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can insert own storefront" ON trainer_storefronts
  FOR INSERT WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can update own storefront" ON trainer_storefronts
  FOR UPDATE USING (auth.uid() = trainer_id);

-- Anyone can view published storefronts (public access for browsing)
CREATE POLICY "Anyone can view published storefronts" ON trainer_storefronts
  FOR SELECT USING (is_published = TRUE);

-- Service role full access
CREATE POLICY "Service role full access trainer_storefronts" ON trainer_storefronts
  FOR ALL USING (auth.role() = 'service_role');

-- Function to auto-generate slug from display name
CREATE OR REPLACE FUNCTION generate_storefront_slug(display_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces and special chars with hyphens
  base_slug := lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Trim leading/trailing hyphens
  base_slug := trim(BOTH '-' FROM base_slug);
  -- Ensure minimum length
  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-trainer';
  END IF;
  -- Truncate to max length minus room for suffix
  base_slug := left(base_slug, 45);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add suffix if needed
  WHILE EXISTS (SELECT 1 FROM trainer_storefronts WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- View to get storefront with trainer info and approved products count
CREATE OR REPLACE VIEW storefront_with_products AS
SELECT 
  ts.id,
  ts.trainer_id,
  ts.slug,
  ts.headline,
  ts.bio,
  ts.cover_image_url,
  ts.specialties,
  ts.credentials,
  ts.experience_years,
  ts.is_published,
  ts.published_at,
  ts.created_at,
  ts.updated_at,
  p.display_name as trainer_name,
  p.profile_photo_path as trainer_photo_path,
  p.preset_avatar_id as trainer_preset_avatar_id,
  p.role as trainer_role,
  (
    SELECT COUNT(*) 
    FROM trainer_products tp 
    WHERE tp.trainer_id = ts.trainer_id 
    AND tp.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM product_pricing pp 
      WHERE pp.product_id = tp.id AND pp.is_active = TRUE
    )
  ) as approved_products_count
FROM trainer_storefronts ts
JOIN profiles p ON p.id = ts.trainer_id;

-- Grant access to view
GRANT SELECT ON storefront_with_products TO authenticated;
GRANT SELECT ON storefront_with_products TO anon;

COMMENT ON TABLE trainer_storefronts IS 'Public storefront pages for trainers to market their products';
COMMENT ON COLUMN trainer_storefronts.slug IS 'URL-friendly unique identifier for the storefront (e.g., /trainer/john-smith)';
COMMENT ON COLUMN trainer_storefronts.is_published IS 'Whether the storefront is publicly visible';
