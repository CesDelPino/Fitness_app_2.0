-- Migration 072: Create client_connection_requests table
-- Allows clients to request to work with professionals who are accepting new clients
-- Professionals see these requests and can send invitations in response

CREATE TABLE IF NOT EXISTS client_connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Partial unique index: Only one pending request per client-professional pair
-- This allows clients to re-request after rejection/expiration
CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_pending_unique 
  ON client_connection_requests(client_id, professional_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_connection_requests_client ON client_connection_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_professional ON client_connection_requests(professional_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON client_connection_requests(status);

COMMENT ON TABLE client_connection_requests IS 'Requests from clients to work with professionals. Professionals review and can send invitations.';
COMMENT ON COLUMN client_connection_requests.status IS 'pending = awaiting review, approved = invitation sent, rejected = declined, expired = timed out';

-- RLS Policies
ALTER TABLE client_connection_requests ENABLE ROW LEVEL SECURITY;

-- Clients can view their own requests
CREATE POLICY client_connection_requests_client_select ON client_connection_requests
  FOR SELECT USING (auth.uid() = client_id);

-- Clients can insert their own requests
CREATE POLICY client_connection_requests_client_insert ON client_connection_requests
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Professionals can view requests sent to them
CREATE POLICY client_connection_requests_pro_select ON client_connection_requests
  FOR SELECT USING (auth.uid() = professional_id);

-- Professionals can update requests sent to them (approve/reject)
CREATE POLICY client_connection_requests_pro_update ON client_connection_requests
  FOR UPDATE USING (auth.uid() = professional_id);
