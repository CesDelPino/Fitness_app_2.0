-- Migration 042: Fix invitations table column names
-- The RPC functions in migration 021 expect 'client_email' and 'token' columns
-- but the original schema (001) created 'email' and 'token_hash'
-- 
-- NOTE on token vs token_hash: The code stores plain tokens and the app compares
-- them directly. There is no hashing involved in the current implementation.
-- This is acceptable because tokens are already random 32-byte hex strings.

BEGIN;

-- 1. Rename 'email' to 'client_email' if it exists and new column doesn't
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'email'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE invitations RENAME COLUMN email TO client_email;
    RAISE NOTICE 'Renamed column email -> client_email';
  ELSE
    RAISE NOTICE 'Column rename email -> client_email not needed';
  END IF;
END $$;

-- 2. Rename 'token_hash' to 'token' if it exists and new column doesn't
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'token_hash'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'token'
  ) THEN
    ALTER TABLE invitations RENAME COLUMN token_hash TO token;
    RAISE NOTICE 'Renamed column token_hash -> token';
  ELSE
    RAISE NOTICE 'Column rename token_hash -> token not needed';
  END IF;
END $$;

-- 3. Update indexes (only drop old ones if they exist, only create new ones if column exists)
DO $$ 
BEGIN
  -- Drop old indexes if they exist
  DROP INDEX IF EXISTS idx_invitations_token_hash;
  DROP INDEX IF EXISTS idx_invitations_email;
  
  -- Create new indexes only if the columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'token'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
    RAISE NOTICE 'Created index idx_invitations_token';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'client_email'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_invitations_client_email ON invitations(client_email);
    RAISE NOTICE 'Created index idx_invitations_client_email';
  END IF;
END $$;

COMMIT;
