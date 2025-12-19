-- Add custom_slugs_enabled feature flag for professional vanity URLs
-- This controls whether professionals can customize their storefront URLs

INSERT INTO features (code, name, description, is_active)
VALUES (
  'custom_slugs',
  'Custom Storefront URLs',
  'Allow professionals to customize their storefront URL slug (e.g., /s/john-smith instead of /s/trainer-123)',
  true
)
ON CONFLICT (code) DO NOTHING;

-- Also add a feature for marketplace visibility as a launch kill-switch
INSERT INTO features (code, name, description, is_active)
VALUES (
  'marketplace_discovery',
  'Marketplace Discovery',
  'Enable professionals to appear in the marketplace trainer discovery. Disable to hide marketplace during staged rollout.',
  true
)
ON CONFLICT (code) DO NOTHING;

-- Add storefront publishing feature for controlling who can publish
INSERT INTO features (code, name, description, is_active)
VALUES (
  'storefront_publishing',
  'Storefront Publishing',
  'Allow professionals to publish their storefronts. Disable to prevent all new publications during maintenance.',
  true
)
ON CONFLICT (code) DO NOTHING;
