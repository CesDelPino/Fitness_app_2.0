-- Nutrition Targets System
-- Allows professionals to send nutrition targets to clients
-- Clients must accept before targets take effect

-- Create nutrition_targets table
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Macro targets
  protein_g INTEGER NOT NULL CHECK (protein_g >= 0 AND protein_g <= 1000),
  carbs_g INTEGER NOT NULL CHECK (carbs_g >= 0 AND carbs_g <= 2000),
  fat_g INTEGER NOT NULL CHECK (fat_g >= 0 AND fat_g <= 500),
  calories INTEGER NOT NULL GENERATED ALWAYS AS ((protein_g * 4) + (carbs_g * 4) + (fat_g * 9)) STORED,
  
  -- Status and provenance
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  source TEXT NOT NULL DEFAULT 'professional' CHECK (source IN ('professional', 'client')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_professional_source CHECK (
    (source = 'professional' AND professional_id IS NOT NULL) OR
    (source = 'client' AND professional_id IS NULL)
  )
);

-- Create indexes
CREATE INDEX idx_nutrition_targets_client_id ON nutrition_targets(client_id);
CREATE INDEX idx_nutrition_targets_professional_id ON nutrition_targets(professional_id);
CREATE INDEX idx_nutrition_targets_status ON nutrition_targets(status);

-- Create unique partial index to ensure only one pending per client
CREATE UNIQUE INDEX idx_nutrition_targets_one_pending_per_client 
ON nutrition_targets(client_id) 
WHERE status = 'pending';

-- Create unique partial index to ensure only one accepted per client
CREATE UNIQUE INDEX idx_nutrition_targets_one_accepted_per_client 
ON nutrition_targets(client_id) 
WHERE status = 'accepted';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_nutrition_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nutrition_targets_updated_at
  BEFORE UPDATE ON nutrition_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_nutrition_targets_updated_at();

-- RLS Policies
ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;

-- Clients can view their own targets
CREATE POLICY "Clients can view their own nutrition targets"
ON nutrition_targets
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

-- Professionals can view targets they set for their clients
CREATE POLICY "Professionals can view targets they set"
ON nutrition_targets
FOR SELECT
TO authenticated
USING (professional_id = auth.uid());

-- Professionals can insert pending targets for clients they have permission for
-- (Permission check done at API level)
CREATE POLICY "Professionals can insert targets"
ON nutrition_targets
FOR INSERT
TO authenticated
WITH CHECK (
  professional_id = auth.uid() AND
  source = 'professional' AND
  status = 'pending'
);

-- Clients can update their own accepted targets (to edit after accepting)
CREATE POLICY "Clients can update their accepted targets"
ON nutrition_targets
FOR UPDATE
TO authenticated
USING (client_id = auth.uid() AND status = 'accepted')
WITH CHECK (client_id = auth.uid());

-- Clients can update pending targets (to accept or decline)
CREATE POLICY "Clients can accept or decline pending targets"
ON nutrition_targets
FOR UPDATE
TO authenticated
USING (client_id = auth.uid() AND status = 'pending')
WITH CHECK (
  client_id = auth.uid() AND
  status IN ('accepted', 'declined')
);

-- Clients can insert their own targets (self-set)
CREATE POLICY "Clients can set their own targets"
ON nutrition_targets
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid() AND
  source = 'client' AND
  professional_id IS NULL
);

-- Create audit table for history
CREATE TABLE IF NOT EXISTS nutrition_targets_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrition_target_id UUID NOT NULL,
  client_id UUID NOT NULL,
  professional_id UUID,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  calories INTEGER NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'accepted', 'declined', 'updated')),
  actor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrition_targets_audit_client ON nutrition_targets_audit(client_id);
CREATE INDEX idx_nutrition_targets_audit_target ON nutrition_targets_audit(nutrition_target_id);

-- RLS for audit table
ALTER TABLE nutrition_targets_audit ENABLE ROW LEVEL SECURITY;

-- Clients can view their own audit history
CREATE POLICY "Clients can view their nutrition targets audit"
ON nutrition_targets_audit
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

-- Professionals can view audit for targets they set
CREATE POLICY "Professionals can view audit for their targets"
ON nutrition_targets_audit
FOR SELECT
TO authenticated
USING (professional_id = auth.uid());

-- Function to log audit entries
CREATE OR REPLACE FUNCTION log_nutrition_target_action(
  p_target_id UUID,
  p_action TEXT,
  p_actor_id UUID
) RETURNS void AS $$
DECLARE
  v_target nutrition_targets%ROWTYPE;
BEGIN
  SELECT * INTO v_target FROM nutrition_targets WHERE id = p_target_id;
  
  INSERT INTO nutrition_targets_audit (
    nutrition_target_id,
    client_id,
    professional_id,
    protein_g,
    carbs_g,
    fat_g,
    calories,
    status,
    source,
    action,
    actor_id
  ) VALUES (
    v_target.id,
    v_target.client_id,
    v_target.professional_id,
    v_target.protein_g,
    v_target.carbs_g,
    v_target.fat_g,
    v_target.calories,
    v_target.status,
    v_target.source,
    p_action,
    p_actor_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
