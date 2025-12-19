-- Migration 024: Professional Verification System
-- Phase 4.3: Professional Verification with document uploads and admin review
-- 
-- This migration adds:
-- 1. Verification status fields to professional_profiles
-- 2. verification_documents table for document metadata
-- 3. RLS policies for secure document access
-- 4. RPCs for verification workflow (submit, review, list)
-- 5. Audit logging integration for all admin actions

-- ============================================================================
-- TRANSACTION START - All changes are atomic
-- ============================================================================
BEGIN;

-- Verify dependency: audit log table must exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'permission_audit_log') THEN
    RAISE EXCEPTION 'Migration 022_audit_logging.sql must be applied first.';
  END IF;
END $$;

-- ============================================================================
-- 4.3.1: Add verification fields to professional_profiles
-- ============================================================================

ALTER TABLE professional_profiles
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Create index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_professional_profiles_verification_status
ON professional_profiles (verification_status)
WHERE verification_status = 'pending';

-- ============================================================================
-- 4.3.1: Create verification_documents table
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('certification', 'license', 'id_verification', 'other')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ,
  review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_verification_documents_user 
ON verification_documents (user_id);

CREATE INDEX IF NOT EXISTS idx_verification_documents_status 
ON verification_documents (review_status)
WHERE review_status = 'pending';

-- ============================================================================
-- 4.3.1: RLS Policies for verification_documents
-- ============================================================================

ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- Professionals can insert their own documents
CREATE POLICY "Professionals can upload own verification documents"
  ON verification_documents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'professional'
  );

-- Professionals can view their own documents
CREATE POLICY "Professionals can view own verification documents"
  ON verification_documents FOR SELECT
  USING (auth.uid() = user_id);

-- Service-role can view all documents (for admin review via signed URLs)
CREATE POLICY "Service role can view all verification documents"
  ON verification_documents FOR SELECT
  USING ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Service-role can update documents (for admin review status)
CREATE POLICY "Service role can update verification documents"
  ON verification_documents FOR UPDATE
  USING ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- 4.3.3: RPC - Submit verification request
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_verification_request(
  p_document_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_status VARCHAR(20);
  v_doc_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Verify user is a professional
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_user_id AND role = 'professional'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only professionals can submit verification requests');
  END IF;
  
  -- Get current verification status
  SELECT verification_status INTO v_current_status
  FROM professional_profiles
  WHERE user_id = v_user_id;
  
  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Professional profile not found');
  END IF;
  
  -- Check if already pending or verified
  IF v_current_status = 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification request already pending');
  END IF;
  
  IF v_current_status = 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already verified');
  END IF;
  
  -- Verify documents exist if provided
  IF p_document_ids IS NOT NULL AND array_length(p_document_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_doc_count
    FROM verification_documents
    WHERE id = ANY(p_document_ids)
      AND user_id = v_user_id;
    
    IF v_doc_count != array_length(p_document_ids, 1) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Some documents not found or not owned by user');
    END IF;
  ELSE
    -- Check if user has at least one document
    SELECT COUNT(*) INTO v_doc_count
    FROM verification_documents
    WHERE user_id = v_user_id;
    
    IF v_doc_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'At least one verification document is required');
    END IF;
  END IF;
  
  -- Update professional_profiles status to pending
  UPDATE professional_profiles
  SET 
    verification_status = 'pending',
    verification_submitted_at = NOW(),
    verification_reviewed_at = NULL,
    verification_reviewed_by = NULL,
    verification_notes = NULL
  WHERE user_id = v_user_id;
  
  -- Log the submission event
  PERFORM log_permission_event(
    'verification_submit',
    'professional',
    v_user_id,
    NULL,  -- target_client_id
    NULL,  -- target_relationship_id
    v_user_id,  -- target_professional_id (self)
    NULL,  -- permission_slug
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', 'pending'),
    NULL,  -- reason (not required for professional actions)
    jsonb_build_object('document_count', v_doc_count)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification request submitted successfully',
    'document_count', v_doc_count
  );
END;
$$;

-- ============================================================================
-- 4.3.3: RPC - Review verification request (Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION review_verification_request(
  p_user_id UUID,
  p_decision VARCHAR(20),  -- 'verified' or 'rejected'
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status VARCHAR(20);
  v_professional_name TEXT;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role required');
  END IF;
  
  -- Validate reason is provided and long enough
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin action requires a reason of at least 10 characters');
  END IF;
  
  -- Validate decision
  IF p_decision NOT IN ('verified', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Decision must be verified or rejected');
  END IF;
  
  -- Get current status and name
  SELECT pp.verification_status, p.full_name 
  INTO v_current_status, v_professional_name
  FROM professional_profiles pp
  JOIN profiles p ON p.id = pp.user_id
  WHERE pp.user_id = p_user_id;
  
  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Professional profile not found');
  END IF;
  
  IF v_current_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending verifications can be reviewed');
  END IF;
  
  -- Update professional_profiles with decision
  UPDATE professional_profiles
  SET 
    verification_status = p_decision,
    verification_reviewed_at = NOW(),
    verification_reviewed_by = p_admin_id,
    verification_notes = p_reason
  WHERE user_id = p_user_id;
  
  -- Update all pending documents to match decision
  UPDATE verification_documents
  SET 
    review_status = CASE WHEN p_decision = 'verified' THEN 'approved' ELSE 'rejected' END,
    reviewed_at = NOW(),
    review_notes = p_reason
  WHERE user_id = p_user_id
    AND review_status = 'pending';
  
  -- Log the review event
  PERFORM log_permission_event(
    'verification_review',
    'admin',
    p_admin_id,
    NULL,  -- target_client_id
    NULL,  -- target_relationship_id
    p_user_id,  -- target_professional_id
    NULL,  -- permission_slug
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', p_decision),
    p_reason,
    jsonb_build_object(
      'professional_name', v_professional_name,
      'decision', p_decision
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification ' || p_decision,
    'professional_id', p_user_id,
    'professional_name', v_professional_name,
    'decision', p_decision
  );
END;
$$;

-- ============================================================================
-- 4.3.3: RPC - List pending verifications (Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION list_pending_verifications(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status VARCHAR(20) DEFAULT 'pending'
)
RETURNS TABLE (
  user_id UUID,
  professional_name TEXT,
  email TEXT,
  headline TEXT,
  verification_status VARCHAR(20),
  verification_submitted_at TIMESTAMPTZ,
  document_count BIGINT,
  specialties TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    pp.user_id,
    COALESCE(p.full_name, p.display_name, 'Unknown')::TEXT as professional_name,
    p.email::TEXT,
    pp.headline::TEXT,
    pp.verification_status,
    pp.verification_submitted_at,
    (SELECT COUNT(*) FROM verification_documents vd WHERE vd.user_id = pp.user_id)::BIGINT as document_count,
    pp.specialties
  FROM professional_profiles pp
  JOIN profiles p ON p.id = pp.user_id
  WHERE 
    (p_status IS NULL OR pp.verification_status = p_status)
  ORDER BY 
    CASE WHEN pp.verification_status = 'pending' THEN 0 ELSE 1 END,
    pp.verification_submitted_at ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4.3.3: RPC - Count pending verifications (Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION count_pending_verifications(
  p_status VARCHAR(20) DEFAULT 'pending'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM professional_profiles
  WHERE 
    (p_status IS NULL OR verification_status = p_status);
  
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 4.3.3: RPC - Get verification details for a professional (Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_verification_details(
  p_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  professional_name TEXT,
  email TEXT,
  headline TEXT,
  bio TEXT,
  specialties TEXT[],
  experience_years SMALLINT,
  location_city TEXT,
  location_state TEXT,
  verification_status VARCHAR(20),
  verification_submitted_at TIMESTAMPTZ,
  verification_reviewed_at TIMESTAMPTZ,
  verification_reviewed_by UUID,
  reviewer_name TEXT,
  verification_notes TEXT,
  documents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has service_role
  IF (SELECT auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    pp.user_id,
    COALESCE(p.full_name, p.display_name, 'Unknown')::TEXT as professional_name,
    p.email::TEXT,
    pp.headline::TEXT,
    pp.bio::TEXT,
    pp.specialties,
    pp.experience_years,
    pp.location_city::TEXT,
    pp.location_state::TEXT,
    pp.verification_status,
    pp.verification_submitted_at,
    pp.verification_reviewed_at,
    pp.verification_reviewed_by,
    COALESCE(reviewer.full_name, 'Unknown')::TEXT as reviewer_name,
    pp.verification_notes::TEXT,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', vd.id,
        'document_type', vd.document_type,
        'file_path', vd.file_path,
        'file_name', vd.file_name,
        'file_size_bytes', vd.file_size_bytes,
        'mime_type', vd.mime_type,
        'uploaded_at', vd.uploaded_at,
        'review_status', vd.review_status
      ) ORDER BY vd.uploaded_at DESC), '[]'::jsonb)
      FROM verification_documents vd
      WHERE vd.user_id = pp.user_id
    ) as documents
  FROM professional_profiles pp
  JOIN profiles p ON p.id = pp.user_id
  LEFT JOIN profiles reviewer ON reviewer.id = pp.verification_reviewed_by
  WHERE pp.user_id = p_user_id;
END;
$$;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

-- Professional-facing functions
GRANT EXECUTE ON FUNCTION submit_verification_request TO authenticated;

-- Admin-facing functions (service_role only)
GRANT EXECUTE ON FUNCTION review_verification_request TO service_role;
GRANT EXECUTE ON FUNCTION list_pending_verifications TO service_role;
GRANT EXECUTE ON FUNCTION count_pending_verifications TO service_role;
GRANT EXECUTE ON FUNCTION get_verification_details TO service_role;

-- ============================================================================
-- TRANSACTION END
-- ============================================================================
COMMIT;

-- ============================================================================
-- 4.3.2: Storage Bucket and Policies (runs outside transaction)
-- NOTE: Storage operations cannot be in a transaction block
-- ============================================================================

-- Create the verification-documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,  -- Private bucket - only accessible via signed URLs
  10485760,  -- 10MB max file size
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Professionals can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Professionals can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Professionals can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role has full access to verification documents" ON storage.objects;

-- Policy: Professionals can upload documents to their own folder
-- File path pattern: {user_id}/{filename}
CREATE POLICY "Professionals can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'verification-documents'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'professional'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Professionals can view their own documents
CREATE POLICY "Professionals can view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Professionals can delete their own documents (before submission)
CREATE POLICY "Professionals can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.professional_profiles pp
    WHERE pp.user_id = auth.uid()
    AND pp.verification_status NOT IN ('pending', 'verified')
  )
);

-- Policy: Service role has full access (for admin signed URL generation)
CREATE POLICY "Service role has full access to verification documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'verification-documents'
  AND (SELECT auth.jwt() ->> 'role') = 'service_role'
)
WITH CHECK (
  bucket_id = 'verification-documents'
  AND (SELECT auth.jwt() ->> 'role') = 'service_role'
);

-- ============================================================================
-- Verification queries (for testing after migration)
-- ============================================================================

-- Verify columns were added:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'professional_profiles' 
-- AND column_name LIKE 'verification%';

-- Verify verification_documents table exists:
-- SELECT * FROM information_schema.tables 
-- WHERE table_name = 'verification_documents';

-- Test list pending verifications:
-- SELECT * FROM list_pending_verifications(10, 0, 'pending');
