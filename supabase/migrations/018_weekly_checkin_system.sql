-- Migration 018: Weekly Check-in System
-- Phase 5.5: Structured weekly check-ins from clients to trainers

-- Trainer-defined check-in templates
CREATE TABLE check_in_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly', 'biweekly')),
  active_version_id UUID, -- Will be set after first version is published
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Versioned template content (enables template editing without breaking history)
CREATE TABLE check_in_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES check_in_templates(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE(template_id, version_number)
);

-- Add FK constraint for active_version_id after check_in_template_versions exists
ALTER TABLE check_in_templates
ADD CONSTRAINT fk_active_version
FOREIGN KEY (active_version_id)
REFERENCES check_in_template_versions(id)
ON DELETE SET NULL;

-- Custom questions within a template version (max 8 per version enforced at app level)
CREATE TABLE check_in_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID REFERENCES check_in_template_versions(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('short_text', 'long_text', 'single_select', 'multi_select', 'scale_1_5', 'boolean')),
  options JSONB, -- For select fields: ["Option A", "Option B"]
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER NOT NULL CHECK (display_order >= 1 AND display_order <= 8),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Links template to specific clients with scheduling
CREATE TABLE check_in_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES check_in_templates(id) ON DELETE CASCADE NOT NULL,
  template_version_id UUID REFERENCES check_in_template_versions(id) NOT NULL,
  client_id UUID REFERENCES profiles(id) NOT NULL,
  professional_id UUID REFERENCES profiles(id) NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly', 'biweekly')),
  anchor_weekday INTEGER NOT NULL CHECK (anchor_weekday >= 0 AND anchor_weekday <= 6), -- 0=Sunday, 1=Monday, etc.
  start_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, professional_id) -- One active assignment per pro-client pair
);

-- Individual check-in submissions
CREATE TABLE check_in_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES check_in_template_assignments(id) ON DELETE CASCADE NOT NULL,
  template_version_id UUID REFERENCES check_in_template_versions(id) NOT NULL,
  client_id UUID REFERENCES profiles(id) NOT NULL,
  professional_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'submitted', 'missed')),
  week_start DATE NOT NULL, -- Monday of the week this check-in covers
  due_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  auto_marked_missed_at TIMESTAMPTZ,
  metrics_snapshot JSONB, -- Auto-populated data at submission time
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, week_start) -- One submission per week per assignment
);

-- Client answers to custom questions
CREATE TABLE check_in_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES check_in_submissions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES check_in_questions(id) NOT NULL,
  answer_value TEXT, -- Stored as text, parsed based on field_type
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(submission_id, question_id)
);

-- Cached weekly metrics for fast form population
CREATE TABLE check_in_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week
  metrics JSONB NOT NULL, -- Aggregated data
  refreshed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, week_start)
);

-- AI analysis results (premium feature)
CREATE TABLE check_in_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES check_in_submissions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  summary TEXT,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  flags JSONB, -- Array of { severity, category, issue, data_points }
  wins JSONB, -- Array of positive observations
  suggested_response TEXT,
  coaching_notes TEXT,
  data_quality JSONB,
  ai_model TEXT,
  error_message TEXT, -- For failed analyses
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_check_in_templates_professional ON check_in_templates(professional_id) WHERE NOT is_archived;
CREATE INDEX idx_check_in_template_versions_template ON check_in_template_versions(template_id);
CREATE INDEX idx_check_in_template_versions_status ON check_in_template_versions(status) WHERE status = 'active';
CREATE INDEX idx_check_in_questions_version ON check_in_questions(template_version_id);
CREATE INDEX idx_check_in_assignments_client ON check_in_template_assignments(client_id) WHERE is_active;
CREATE INDEX idx_check_in_assignments_professional ON check_in_template_assignments(professional_id) WHERE is_active;
CREATE INDEX idx_check_in_submissions_assignment ON check_in_submissions(assignment_id);
CREATE INDEX idx_check_in_submissions_client ON check_in_submissions(client_id);
CREATE INDEX idx_check_in_submissions_professional ON check_in_submissions(professional_id);
CREATE INDEX idx_check_in_submissions_status ON check_in_submissions(status) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX idx_check_in_submissions_due ON check_in_submissions(due_at) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX idx_check_in_answers_submission ON check_in_answers(submission_id);
CREATE INDEX idx_check_in_metrics_cache_client_week ON check_in_metrics_cache(client_id, week_start);
CREATE INDEX idx_check_in_analysis_submission ON check_in_analysis(submission_id);
CREATE INDEX idx_check_in_analysis_pending ON check_in_analysis(status) WHERE status = 'pending';

-- RLS Policies

-- Enable RLS on all tables
ALTER TABLE check_in_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_template_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_analysis ENABLE ROW LEVEL SECURITY;

-- check_in_templates: Professionals can manage their own templates
CREATE POLICY "Professionals can view own templates"
  ON check_in_templates FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "Professionals can create templates"
  ON check_in_templates FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can update own templates"
  ON check_in_templates FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can delete own templates"
  ON check_in_templates FOR DELETE
  USING (professional_id = auth.uid());

-- check_in_template_versions: Access through parent template
CREATE POLICY "View versions through template ownership"
  ON check_in_template_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_in_templates t
      WHERE t.id = template_id AND t.professional_id = auth.uid()
    )
  );

CREATE POLICY "Create versions for own templates"
  ON check_in_template_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM check_in_templates t
      WHERE t.id = template_id AND t.professional_id = auth.uid()
    )
  );

CREATE POLICY "Update versions for own templates"
  ON check_in_template_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM check_in_templates t
      WHERE t.id = template_id AND t.professional_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM check_in_templates t
      WHERE t.id = template_id AND t.professional_id = auth.uid()
    )
  );

-- check_in_questions: Access through parent version/template
CREATE POLICY "View questions through template ownership"
  ON check_in_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_in_template_versions v
      JOIN check_in_templates t ON t.id = v.template_id
      WHERE v.id = template_version_id AND t.professional_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM check_in_template_assignments a
      WHERE a.template_version_id = template_version_id AND a.client_id = auth.uid()
    )
  );

CREATE POLICY "Manage questions for own templates"
  ON check_in_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM check_in_template_versions v
      JOIN check_in_templates t ON t.id = v.template_id
      WHERE v.id = template_version_id AND t.professional_id = auth.uid()
    )
  );

CREATE POLICY "Update questions for own templates"
  ON check_in_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM check_in_template_versions v
      JOIN check_in_templates t ON t.id = v.template_id
      WHERE v.id = template_version_id AND t.professional_id = auth.uid()
    )
  );

CREATE POLICY "Delete questions for own templates"
  ON check_in_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM check_in_template_versions v
      JOIN check_in_templates t ON t.id = v.template_id
      WHERE v.id = template_version_id AND t.professional_id = auth.uid()
    )
  );

-- check_in_template_assignments: Professionals manage, clients view their own
CREATE POLICY "Professionals can view assignments for their clients"
  ON check_in_template_assignments FOR SELECT
  USING (professional_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Professionals can create assignments"
  ON check_in_template_assignments FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can update assignments"
  ON check_in_template_assignments FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can delete assignments"
  ON check_in_template_assignments FOR DELETE
  USING (professional_id = auth.uid());

-- check_in_submissions: Professionals and clients can view, clients can update their own
CREATE POLICY "View own submissions"
  ON check_in_submissions FOR SELECT
  USING (client_id = auth.uid() OR professional_id = auth.uid());

CREATE POLICY "Create submissions for assigned clients"
  ON check_in_submissions FOR INSERT
  WITH CHECK (
    professional_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM check_in_template_assignments a
      WHERE a.id = assignment_id AND a.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own submissions"
  ON check_in_submissions FOR UPDATE
  USING (client_id = auth.uid() OR professional_id = auth.uid())
  WITH CHECK (client_id = auth.uid() OR professional_id = auth.uid());

-- check_in_answers: Clients can manage their own answers
CREATE POLICY "View answers for accessible submissions"
  ON check_in_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND (s.client_id = auth.uid() OR s.professional_id = auth.uid())
    )
  );

CREATE POLICY "Clients can create answers"
  ON check_in_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND s.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own answers"
  ON check_in_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND s.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND s.client_id = auth.uid()
    )
  );

-- check_in_metrics_cache: Clients can view their own, system can manage
CREATE POLICY "Clients can view own metrics cache"
  ON check_in_metrics_cache FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Professionals can view client metrics"
  ON check_in_metrics_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_in_template_assignments a
      WHERE a.client_id = check_in_metrics_cache.client_id 
        AND a.professional_id = auth.uid()
        AND a.is_active = true
    )
  );

CREATE POLICY "System can manage metrics cache"
  ON check_in_metrics_cache FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- check_in_analysis: Professionals can view for their submissions
CREATE POLICY "Professionals can view analysis for their clients"
  ON check_in_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND s.professional_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their own analysis"
  ON check_in_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND s.client_id = auth.uid()
    )
  );

-- Allow system to create and update analysis (service role only for AI processing)
CREATE POLICY "System can manage analysis"
  ON check_in_analysis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM check_in_submissions s
      WHERE s.id = submission_id AND (s.professional_id = auth.uid() OR s.client_id = auth.uid())
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_check_in_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_check_in_templates_updated_at
  BEFORE UPDATE ON check_in_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_check_in_updated_at();

CREATE TRIGGER update_check_in_template_assignments_updated_at
  BEFORE UPDATE ON check_in_template_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_check_in_updated_at();

CREATE TRIGGER update_check_in_answers_updated_at
  BEFORE UPDATE ON check_in_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_check_in_updated_at();
