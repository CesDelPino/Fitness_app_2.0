-- Migration 043: Add default to invitations.expires_at
-- The RPC create_invitation_with_permissions doesn't set expires_at,
-- but the column is NOT NULL, causing insert failures.

ALTER TABLE invitations 
ALTER COLUMN expires_at SET DEFAULT now() + interval '7 days';
