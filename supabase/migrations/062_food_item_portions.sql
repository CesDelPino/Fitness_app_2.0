-- ============================================
-- LOBA Tracker - Food Item Portions
-- Migration 062
-- 
-- NOTE: This migration is for Supabase only.
-- Commented out to prevent Replit deployment from parsing it.
-- Already applied to Supabase successfully.
-- ============================================

/*
-- ============================================
-- HELPER FUNCTION (if not exists)
-- ============================================

-- Create set_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FOOD ITEM PORTIONS TABLE
-- ============================================

CREATE TABLE food_item_portions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id UUID NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  source_portion_id TEXT,
  description TEXT NOT NULL DEFAULT 'unspecified portion',
  amount NUMERIC(10,4),
  gram_weight NUMERIC(10,4),
  unit TEXT,
  sequence SMALLINT,
  modifier TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  data_source data_source_type NOT NULL DEFAULT 'fda_foundation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast joins on food_item_id
CREATE INDEX idx_food_item_portions_food_id ON food_item_portions(food_item_id);

-- Partial unique index to enforce at most one default portion per food
CREATE UNIQUE INDEX idx_food_item_portions_single_default 
  ON food_item_portions(food_item_id) 
  WHERE is_default = true;

-- Dedupe constraint: prevent storing semantically identical portions
CREATE INDEX idx_food_item_portions_dedupe 
  ON food_item_portions(food_item_id, description);

-- Trigger for updated_at
CREATE TRIGGER update_food_item_portions_updated_at
  BEFORE UPDATE ON food_item_portions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE food_item_portions IS 'Stores multiple portion/serving options per food item for the portion selector';
COMMENT ON COLUMN food_item_portions.source_portion_id IS 'FDA portion ID for provenance tracking';
COMMENT ON COLUMN food_item_portions.description IS 'Human-readable portion description (e.g., "1 cup, chopped")';
COMMENT ON COLUMN food_item_portions.amount IS 'Serving multiplier (nullable - some FDA data omits this)';
COMMENT ON COLUMN food_item_portions.gram_weight IS 'Weight in grams (nullable - FDA data sometimes missing)';
COMMENT ON COLUMN food_item_portions.unit IS 'Unit abbreviation (g, mL, serving)';
COMMENT ON COLUMN food_item_portions.sequence IS 'Display order from FDA';
COMMENT ON COLUMN food_item_portions.modifier IS 'Additional context (e.g., "package (7 oz)")';
COMMENT ON COLUMN food_item_portions.is_default IS 'Marks the default portion for this food (max one per food)';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE food_item_portions ENABLE ROW LEVEL SECURITY;

-- Food portions are shared reference data - anyone can read
CREATE POLICY "Anyone can read food portions"
  ON food_item_portions FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (via backend)
CREATE POLICY "Service role can manage food portions"
  ON food_item_portions FOR ALL
  USING (auth.role() = 'service_role');
*/
