-- Phase 1: Storefront Expansion - Additional columns and child tables
-- Extends existing trainer_storefronts table (created in migration 056)
--
-- NOTE: RLS policies on trainer_storefronts are PRESERVED from migration 056:
--   - "Trainers can view own storefront" (owner SELECT)
--   - "Trainers can insert own storefront" (owner INSERT)
--   - "Trainers can update own storefront" (owner UPDATE)
--   - "Anyone can view published storefronts" (public SELECT when is_published=true)
--   - "Service role full access trainer_storefronts"
-- This migration only adds columns; it does NOT modify existing policies.

-- ============================================
-- Add new columns to trainer_storefronts
-- ============================================

ALTER TABLE trainer_storefronts
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS intro_video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_url TEXT,
  ADD COLUMN IF NOT EXISTS profession_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_premium_slug BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS slug_purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storefront_variation TEXT DEFAULT 'classic';

-- Add check constraint for storefront_variation
ALTER TABLE trainer_storefronts
  ADD CONSTRAINT storefront_variation_check CHECK (
    storefront_variation IN ('classic', 'bold', 'services-first', 'story-driven')
  );

-- ============================================
-- Storefront Services table
-- ============================================

CREATE TABLE IF NOT EXISTS storefront_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES trainer_storefronts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_display TEXT,
  duration TEXT,
  image_url TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_services_storefront_id ON storefront_services(storefront_id);
CREATE INDEX IF NOT EXISTS idx_storefront_services_sort_order ON storefront_services(storefront_id, sort_order);

ALTER TABLE storefront_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view own services" ON storefront_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_services.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can insert own services" ON storefront_services
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_services.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can update own services" ON storefront_services
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_services.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can delete own services" ON storefront_services
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_services.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view published storefront services" ON storefront_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_services.storefront_id 
      AND ts.is_published = TRUE
    )
  );

CREATE POLICY "Service role full access storefront_services" ON storefront_services
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Storefront Testimonials table
-- ============================================

CREATE TABLE IF NOT EXISTS storefront_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES trainer_storefronts(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_photo_url TEXT,
  quote TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  result_achieved TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_testimonials_storefront_id ON storefront_testimonials(storefront_id);
CREATE INDEX IF NOT EXISTS idx_storefront_testimonials_featured ON storefront_testimonials(storefront_id, is_featured) WHERE is_featured = TRUE;

ALTER TABLE storefront_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view own testimonials" ON storefront_testimonials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_testimonials.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can insert own testimonials" ON storefront_testimonials
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_testimonials.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can update own testimonials" ON storefront_testimonials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_testimonials.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can delete own testimonials" ON storefront_testimonials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_testimonials.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view published storefront testimonials" ON storefront_testimonials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_testimonials.storefront_id 
      AND ts.is_published = TRUE
    )
  );

CREATE POLICY "Service role full access storefront_testimonials" ON storefront_testimonials
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Storefront Transformations table
-- ============================================

CREATE TABLE IF NOT EXISTS storefront_transformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES trainer_storefronts(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  duration_weeks INTEGER,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_transformations_storefront_id ON storefront_transformations(storefront_id);
CREATE INDEX IF NOT EXISTS idx_storefront_transformations_featured ON storefront_transformations(storefront_id, is_featured) WHERE is_featured = TRUE;

ALTER TABLE storefront_transformations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view own transformations" ON storefront_transformations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_transformations.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can insert own transformations" ON storefront_transformations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_transformations.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can update own transformations" ON storefront_transformations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_transformations.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can delete own transformations" ON storefront_transformations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_transformations.storefront_id 
      AND ts.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view published storefront transformations" ON storefront_transformations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_storefronts ts 
      WHERE ts.id = storefront_transformations.storefront_id 
      AND ts.is_published = TRUE
    )
  );

CREATE POLICY "Service role full access storefront_transformations" ON storefront_transformations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Auto-update triggers for new tables
-- ============================================

CREATE OR REPLACE FUNCTION update_storefront_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER storefront_services_updated_at
  BEFORE UPDATE ON storefront_services
  FOR EACH ROW EXECUTE FUNCTION update_storefront_services_updated_at();

CREATE OR REPLACE FUNCTION update_storefront_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER storefront_testimonials_updated_at
  BEFORE UPDATE ON storefront_testimonials
  FOR EACH ROW EXECUTE FUNCTION update_storefront_testimonials_updated_at();

CREATE OR REPLACE FUNCTION update_storefront_transformations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER storefront_transformations_updated_at
  BEFORE UPDATE ON storefront_transformations
  FOR EACH ROW EXECUTE FUNCTION update_storefront_transformations_updated_at();

-- ============================================
-- Update storefront_with_products view
-- ============================================

DROP VIEW IF EXISTS storefront_with_products;

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
  ts.business_name,
  ts.intro_video_url,
  ts.video_thumbnail_url,
  ts.accent_color,
  ts.social_links,
  ts.waitlist_enabled,
  ts.booking_url,
  ts.profession_types,
  ts.timezone,
  ts.languages,
  ts.has_premium_slug,
  ts.slug_purchased_at,
  ts.storefront_variation,
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
  ) as approved_products_count,
  (
    SELECT COUNT(*) 
    FROM storefront_services ss 
    WHERE ss.storefront_id = ts.id
  ) as services_count,
  (
    SELECT COUNT(*) 
    FROM storefront_testimonials st 
    WHERE st.storefront_id = ts.id
  ) as testimonials_count,
  (
    SELECT COUNT(*) 
    FROM storefront_transformations stf 
    WHERE stf.storefront_id = ts.id
  ) as transformations_count
FROM trainer_storefronts ts
JOIN profiles p ON p.id = ts.trainer_id;

GRANT SELECT ON storefront_with_products TO authenticated;
GRANT SELECT ON storefront_with_products TO anon;

-- ============================================
-- Comments
-- ============================================

COMMENT ON COLUMN trainer_storefronts.business_name IS 'Optional business/brand name to display instead of personal name';
COMMENT ON COLUMN trainer_storefronts.intro_video_url IS 'URL to intro/welcome video';
COMMENT ON COLUMN trainer_storefronts.storefront_variation IS 'Layout variation: classic, bold, services-first, story-driven';
COMMENT ON COLUMN trainer_storefronts.has_premium_slug IS 'Whether trainer has purchased/been granted custom slug';
COMMENT ON COLUMN trainer_storefronts.social_links IS 'JSONB containing social media links (instagram, youtube, etc)';

COMMENT ON TABLE storefront_services IS 'Services offered by trainer, displayed on public storefront';
COMMENT ON TABLE storefront_testimonials IS 'Client testimonials/reviews for storefront';
COMMENT ON TABLE storefront_transformations IS 'Before/after transformation photos for storefront';
