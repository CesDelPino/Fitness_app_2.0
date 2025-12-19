-- Migration 067: Add accepting_new_clients to trainer_storefronts
-- This separates "accepting clients" from "waitlist enabled" for clearer UX
-- 
-- Logic:
-- - accepting_new_clients = true: Show "Work with me" CTA
-- - accepting_new_clients = false AND waitlist_enabled = true: Show "Join Waitlist"
-- - accepting_new_clients = false AND waitlist_enabled = false: Show "Not accepting clients"

ALTER TABLE trainer_storefronts
  ADD COLUMN IF NOT EXISTS accepting_new_clients BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN trainer_storefronts.accepting_new_clients IS 'Whether trainer is currently accepting new clients. When false, shows waitlist or "not accepting" message based on waitlist_enabled.';
