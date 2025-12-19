-- Migration 066: Fix stale published_at on unpublished storefronts
-- Clears published_at for any storefronts where is_published=false but published_at is not null
-- This is a one-time data normalization to ensure consistency

UPDATE trainer_storefronts
SET published_at = NULL
WHERE is_published = false AND published_at IS NOT NULL;

-- Add index on is_published + published_at for marketplace queries
CREATE INDEX IF NOT EXISTS idx_storefronts_published_status 
ON trainer_storefronts(is_published, published_at) 
WHERE is_published = true;
