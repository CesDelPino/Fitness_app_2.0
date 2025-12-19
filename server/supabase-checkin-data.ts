import { supabaseAdmin } from './supabase-admin';

export type CheckInCadence = 'weekly' | 'biweekly';
export type CheckInQuestionFieldType = 'short_text' | 'long_text' | 'single_select' | 'multi_select' | 'scale_1_5' | 'boolean';
export type CheckInVersionStatus = 'draft' | 'active' | 'archived';
export type CheckInSubmissionStatus = 'scheduled' | 'in_progress' | 'submitted' | 'missed';
export type CheckInAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CheckInTemplate {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  cadence: CheckInCadence;
  active_version_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckInTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  status: CheckInVersionStatus;
  created_at: string;
  published_at: string | null;
}

export interface CheckInQuestion {
  id: string;
  template_version_id: string;
  question_text: string;
  field_type: CheckInQuestionFieldType;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface CheckInTemplateAssignment {
  id: string;
  template_id: string;
  template_version_id: string;
  client_id: string;
  professional_id: string;
  cadence: CheckInCadence;
  anchor_weekday: number;
  start_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckInSubmission {
  id: string;
  assignment_id: string;
  template_version_id: string;
  client_id: string;
  professional_id: string;
  status: CheckInSubmissionStatus;
  week_start: string;
  due_at: string;
  started_at: string | null;
  submitted_at: string | null;
  auto_marked_missed_at: string | null;
  metrics_snapshot: MetricsSnapshot | null;
  created_at: string;
}

export interface CheckInAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  answer_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckInMetricsCache {
  id: string;
  client_id: string;
  week_start: string;
  metrics: MetricsSnapshot;
  refreshed_at: string;
}

export interface CheckInAnalysis {
  id: string;
  submission_id: string;
  status: CheckInAnalysisStatus;
  summary: string | null;
  risk_score: number | null;
  flags: AnalysisFlag[] | null;
  wins: string[] | null;
  suggested_response: string | null;
  coaching_notes: string | null;
  data_quality: DataQuality | null;
  ai_model: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface MetricsSnapshot {
  weight: {
    current_kg: number | null;
    delta_kg: number | null;
    trend_4_week: 'gaining' | 'losing' | 'stable' | null;
  };
  training: {
    sessions_completed: number;
    sessions_assigned: number;
    adherence_percent: number;
    missed_days: string[];
    notable_performances: string[];
  };
  nutrition: {
    avg_calories: number | null;
    target_calories: number | null;
    avg_protein_g: number | null;
    target_protein_g: number | null;
    days_logged: number;
    adherence_percent: number | null;
  };
  cardio: {
    total_minutes: number;
    activities: string[];
  };
  fasting: {
    fasts_completed: number;
    avg_duration_hours: number | null;
    adherence_percent: number | null;
  };
  data_quality: DataQuality;
}

export interface DataQuality {
  missing_data: string[];
  reliability: 'high' | 'medium' | 'low';
}

export interface AnalysisFlag {
  severity: 'high' | 'medium' | 'low';
  category: 'weight' | 'adherence' | 'nutrition' | 'recovery' | 'motivation' | 'other';
  issue: string;
  data_points: string[];
}

// ============ CLIENT PROFILE ============

export interface ClientProfile {
  id: string;
  email: string | null;
  display_name: string | null;
}

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, display_name')
    .eq('id', clientId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch client profile: ${error.message}`);
  }
  return data;
}

// ============ TEMPLATE OPERATIONS ============

export async function getProCheckInTemplates(professionalId: string): Promise<CheckInTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('check_in_templates')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch check-in templates: ${error.message}`);
  return data || [];
}

export async function getCheckInTemplate(templateId: string): Promise<CheckInTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch check-in template: ${error.message}`);
  }
  return data;
}

export interface CreateCheckInTemplateInput {
  professional_id: string;
  name: string;
  description?: string;
  cadence?: CheckInCadence;
}

export async function createCheckInTemplate(input: CreateCheckInTemplateInput): Promise<CheckInTemplate> {
  const { data, error } = await supabaseAdmin
    .from('check_in_templates')
    .insert({
      professional_id: input.professional_id,
      name: input.name,
      description: input.description || null,
      cadence: input.cadence || 'weekly',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create check-in template: ${error.message}`);
  return data;
}

export async function updateCheckInTemplate(
  templateId: string,
  updates: Partial<Pick<CheckInTemplate, 'name' | 'description' | 'cadence' | 'is_archived'>>
): Promise<CheckInTemplate> {
  const { data, error } = await supabaseAdmin
    .from('check_in_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update check-in template: ${error.message}`);
  return data;
}

export async function archiveCheckInTemplate(templateId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('check_in_templates')
    .update({ is_archived: true })
    .eq('id', templateId);

  if (error) throw new Error(`Failed to archive check-in template: ${error.message}`);
}

// ============ TEMPLATE VERSION OPERATIONS ============

export async function getTemplateVersions(templateId: string): Promise<CheckInTemplateVersion[]> {
  const { data, error } = await supabaseAdmin
    .from('check_in_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false });

  if (error) throw new Error(`Failed to fetch template versions: ${error.message}`);
  return data || [];
}

export async function getTemplateVersion(versionId: string): Promise<CheckInTemplateVersion | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_template_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch template version: ${error.message}`);
  }
  return data;
}

export async function createTemplateVersion(templateId: string): Promise<CheckInTemplateVersion> {
  const existingVersions = await getTemplateVersions(templateId);
  const nextVersionNumber = existingVersions.length > 0 
    ? Math.max(...existingVersions.map(v => v.version_number)) + 1 
    : 1;

  const { data, error } = await supabaseAdmin
    .from('check_in_template_versions')
    .insert({
      template_id: templateId,
      version_number: nextVersionNumber,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create template version: ${error.message}`);
  return data;
}

export async function publishTemplateVersion(versionId: string): Promise<CheckInTemplateVersion> {
  const version = await getTemplateVersion(versionId);
  if (!version) throw new Error('Template version not found');

  const { error: archiveError } = await supabaseAdmin
    .from('check_in_template_versions')
    .update({ status: 'archived' })
    .eq('template_id', version.template_id)
    .eq('status', 'active');

  if (archiveError) throw new Error(`Failed to archive old version: ${archiveError.message}`);

  const { data, error } = await supabaseAdmin
    .from('check_in_template_versions')
    .update({ status: 'active', published_at: new Date().toISOString() })
    .eq('id', versionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish template version: ${error.message}`);

  await supabaseAdmin
    .from('check_in_templates')
    .update({ active_version_id: versionId })
    .eq('id', version.template_id);

  return data;
}

// ============ QUESTION OPERATIONS ============

export async function getVersionQuestions(versionId: string): Promise<CheckInQuestion[]> {
  const { data, error } = await supabaseAdmin
    .from('check_in_questions')
    .select('*')
    .eq('template_version_id', versionId)
    .order('display_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch questions: ${error.message}`);
  return data || [];
}

export interface CreateQuestionInput {
  template_version_id: string;
  question_text: string;
  field_type: CheckInQuestionFieldType;
  options?: string[];
  is_required?: boolean;
  display_order: number;
}

export async function createQuestion(input: CreateQuestionInput): Promise<CheckInQuestion> {
  const { data, error } = await supabaseAdmin
    .from('check_in_questions')
    .insert({
      template_version_id: input.template_version_id,
      question_text: input.question_text,
      field_type: input.field_type,
      options: input.options || null,
      is_required: input.is_required || false,
      display_order: input.display_order,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create question: ${error.message}`);
  return data;
}

export async function updateQuestion(
  questionId: string,
  updates: Partial<Pick<CheckInQuestion, 'question_text' | 'field_type' | 'options' | 'is_required' | 'display_order'>>
): Promise<CheckInQuestion> {
  const { data, error } = await supabaseAdmin
    .from('check_in_questions')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update question: ${error.message}`);
  return data;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('check_in_questions')
    .delete()
    .eq('id', questionId);

  if (error) throw new Error(`Failed to delete question: ${error.message}`);
}

export async function setVersionQuestions(versionId: string, questions: Omit<CreateQuestionInput, 'template_version_id'>[]): Promise<CheckInQuestion[]> {
  if (questions.length > 8) {
    throw new Error('Maximum 8 questions allowed per template version');
  }

  const { error: deleteError } = await supabaseAdmin
    .from('check_in_questions')
    .delete()
    .eq('template_version_id', versionId);

  if (deleteError) throw new Error(`Failed to clear existing questions: ${deleteError.message}`);

  if (questions.length === 0) return [];

  const questionsToInsert = questions.map((q, index) => ({
    template_version_id: versionId,
    question_text: q.question_text,
    field_type: q.field_type,
    options: q.options || null,
    is_required: q.is_required || false,
    display_order: q.display_order ?? index + 1,
  }));

  const { data, error } = await supabaseAdmin
    .from('check_in_questions')
    .insert(questionsToInsert)
    .select()
    .order('display_order', { ascending: true });

  if (error) throw new Error(`Failed to create questions: ${error.message}`);
  return data || [];
}

// ============ ASSIGNMENT OPERATIONS ============

export async function getProCheckInAssignments(professionalId: string): Promise<CheckInTemplateAssignment[]> {
  const { data, error } = await supabaseAdmin
    .from('check_in_template_assignments')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch check-in assignments: ${error.message}`);
  return data || [];
}

export async function getClientCheckInAssignment(clientId: string): Promise<CheckInTemplateAssignment | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_template_assignments')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch client check-in assignment: ${error.message}`);
  }
  return data;
}

export interface CreateAssignmentInput {
  template_id: string;
  template_version_id: string;
  client_id: string;
  professional_id: string;
  cadence?: CheckInCadence;
  anchor_weekday: number;
  start_date: string;
}

export async function createCheckInAssignment(input: CreateAssignmentInput): Promise<CheckInTemplateAssignment> {
  const existing = await getClientCheckInAssignment(input.client_id);
  if (existing && existing.professional_id === input.professional_id) {
    throw new Error('Client already has an active check-in assignment with this professional');
  }

  const { data, error } = await supabaseAdmin
    .from('check_in_template_assignments')
    .insert({
      template_id: input.template_id,
      template_version_id: input.template_version_id,
      client_id: input.client_id,
      professional_id: input.professional_id,
      cadence: input.cadence || 'weekly',
      anchor_weekday: input.anchor_weekday,
      start_date: input.start_date,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create check-in assignment: ${error.message}`);
  return data;
}

export async function deactivateCheckInAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('check_in_template_assignments')
    .update({ is_active: false })
    .eq('id', assignmentId);

  if (error) throw new Error(`Failed to deactivate check-in assignment: ${error.message}`);
}

// ============ SUBMISSION OPERATIONS ============

export async function getClientUpcomingSubmission(clientId: string): Promise<CheckInSubmission | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['scheduled', 'in_progress'])
    .order('due_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch upcoming submission: ${error.message}`);
  }
  return data;
}

export async function getSubmission(submissionId: string): Promise<CheckInSubmission | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch submission: ${error.message}`);
  }
  return data;
}

export async function getProSubmission(
  submissionId: string, 
  professionalId: string
): Promise<CheckInSubmission | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('professional_id', professionalId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch submission: ${error.message}`);
  }
  return data;
}

export async function getClientSubmission(
  submissionId: string, 
  clientId: string
): Promise<CheckInSubmission | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('client_id', clientId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch submission: ${error.message}`);
  }
  return data;
}

export async function getProSubmissions(
  professionalId: string,
  filters?: { clientId?: string; status?: CheckInSubmissionStatus; limit?: number }
): Promise<CheckInSubmission[]> {
  let query = supabaseAdmin
    .from('check_in_submissions')
    .select('*')
    .eq('professional_id', professionalId)
    .order('due_at', { ascending: false });

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
  return data || [];
}

export interface CreateSubmissionInput {
  assignment_id: string;
  template_version_id: string;
  client_id: string;
  professional_id: string;
  week_start: string;
  due_at: string;
}

export async function createSubmission(input: CreateSubmissionInput): Promise<CheckInSubmission> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .insert({
      assignment_id: input.assignment_id,
      template_version_id: input.template_version_id,
      client_id: input.client_id,
      professional_id: input.professional_id,
      week_start: input.week_start,
      due_at: input.due_at,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create submission: ${error.message}`);
  return data;
}

export async function startSubmission(submissionId: string): Promise<CheckInSubmission> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to start submission: ${error.message}`);
  return data;
}

export async function submitCheckIn(submissionId: string, metricsSnapshot: MetricsSnapshot): Promise<CheckInSubmission> {
  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      metrics_snapshot: metricsSnapshot,
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to submit check-in: ${error.message}`);
  return data;
}

export async function markSubmissionMissed(submissionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('check_in_submissions')
    .update({
      status: 'missed',
      auto_marked_missed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .in('status', ['scheduled', 'in_progress']);

  if (error) throw new Error(`Failed to mark submission as missed: ${error.message}`);
}

export async function markOverdueSubmissions(): Promise<number> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data, error } = await supabaseAdmin
    .from('check_in_submissions')
    .update({
      status: 'missed',
      auto_marked_missed_at: new Date().toISOString(),
    })
    .in('status', ['scheduled', 'in_progress'])
    .lt('due_at', threeDaysAgo.toISOString())
    .select('id');

  if (error) throw new Error(`Failed to mark overdue submissions: ${error.message}`);
  return data?.length || 0;
}

// ============ ANSWER OPERATIONS ============

export async function getSubmissionAnswers(submissionId: string): Promise<CheckInAnswer[]> {
  const { data, error } = await supabaseAdmin
    .from('check_in_answers')
    .select('*')
    .eq('submission_id', submissionId);

  if (error) throw new Error(`Failed to fetch answers: ${error.message}`);
  return data || [];
}

export interface SaveAnswerInput {
  submission_id: string;
  question_id: string;
  answer_value: string | null;
}

export async function saveAnswer(input: SaveAnswerInput): Promise<CheckInAnswer> {
  const { data, error } = await supabaseAdmin
    .from('check_in_answers')
    .upsert({
      submission_id: input.submission_id,
      question_id: input.question_id,
      answer_value: input.answer_value,
    }, {
      onConflict: 'submission_id,question_id',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save answer: ${error.message}`);
  return data;
}

export async function saveAnswers(submissionId: string, answers: { question_id: string; answer_value: string | null }[]): Promise<CheckInAnswer[]> {
  if (answers.length === 0) return [];

  const answersToUpsert = answers.map(a => ({
    submission_id: submissionId,
    question_id: a.question_id,
    answer_value: a.answer_value,
  }));

  const { data, error } = await supabaseAdmin
    .from('check_in_answers')
    .upsert(answersToUpsert, {
      onConflict: 'submission_id,question_id',
    })
    .select();

  if (error) throw new Error(`Failed to save answers: ${error.message}`);
  return data || [];
}

// ============ METRICS CACHE OPERATIONS ============

export async function getMetricsCache(clientId: string, weekStart: string): Promise<CheckInMetricsCache | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_metrics_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('week_start', weekStart)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch metrics cache: ${error.message}`);
  }
  return data;
}

export async function upsertMetricsCache(clientId: string, weekStart: string, metrics: MetricsSnapshot): Promise<CheckInMetricsCache> {
  const { data, error } = await supabaseAdmin
    .from('check_in_metrics_cache')
    .upsert({
      client_id: clientId,
      week_start: weekStart,
      metrics: metrics,
      refreshed_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id,week_start',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert metrics cache: ${error.message}`);
  return data;
}

// ============ ANALYSIS OPERATIONS ============

export async function getSubmissionAnalysis(submissionId: string): Promise<CheckInAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from('check_in_analysis')
    .select('*')
    .eq('submission_id', submissionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch analysis: ${error.message}`);
  }
  return data;
}

export async function createAnalysisRequest(submissionId: string): Promise<CheckInAnalysis> {
  const { data, error } = await supabaseAdmin
    .from('check_in_analysis')
    .insert({
      submission_id: submissionId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create analysis request: ${error.message}`);
  return data;
}

export async function updateAnalysis(
  analysisId: string,
  updates: Partial<Pick<CheckInAnalysis, 'status' | 'summary' | 'risk_score' | 'flags' | 'wins' | 'suggested_response' | 'coaching_notes' | 'data_quality' | 'ai_model' | 'error_message' | 'completed_at'>>
): Promise<CheckInAnalysis> {
  const { data, error } = await supabaseAdmin
    .from('check_in_analysis')
    .update(updates)
    .eq('id', analysisId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update analysis: ${error.message}`);
  return data;
}

// ============ METRICS AGGREGATION ============

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export async function aggregateClientMetrics(clientId: string, weekStart: string): Promise<MetricsSnapshot> {
  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const fourWeeksAgo = new Date(weekStart);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const [weighIns, workoutSessions, foodLogs, cardioActivities, fasts, profile] = await Promise.all([
    supabaseAdmin
      .from('weigh_ins')
      .select('*')
      .eq('user_id', clientId)
      .gte('recorded_at', fourWeeksAgo.toISOString())
      .lte('recorded_at', weekEndDate.toISOString())
      .order('recorded_at', { ascending: false }),

    supabaseAdmin
      .from('workout_sessions')
      .select('*')
      .eq('user_id', clientId)
      .gte('started_at', weekStartDate.toISOString())
      .lt('started_at', weekEndDate.toISOString()),

    supabaseAdmin
      .from('food_logs')
      .select('*')
      .eq('user_id', clientId)
      .gte('logged_at', weekStartDate.toISOString())
      .lt('logged_at', weekEndDate.toISOString()),

    supabaseAdmin
      .from('cardio_activities')
      .select('*')
      .eq('user_id', clientId)
      .gte('started_at', weekStartDate.toISOString())
      .lt('started_at', weekEndDate.toISOString()),

    supabaseAdmin
      .from('fasts')
      .select('*')
      .eq('user_id', clientId)
      .gte('started_at', weekStartDate.toISOString())
      .lt('started_at', weekEndDate.toISOString()),

    supabaseAdmin
      .from('profiles')
      .select('daily_calorie_goal, daily_protein_goal')
      .eq('id', clientId)
      .single(),
  ]);

  const missingData: string[] = [];
  
  const currentWeekWeighIns = (weighIns.data || []).filter(w => 
    new Date(w.recorded_at) >= weekStartDate && new Date(w.recorded_at) < weekEndDate
  );
  const olderWeighIns = (weighIns.data || []).filter(w => 
    new Date(w.recorded_at) < weekStartDate
  );

  let currentWeight: number | null = null;
  let deltaKg: number | null = null;
  let trend4Week: 'gaining' | 'losing' | 'stable' | null = null;

  if (currentWeekWeighIns.length > 0) {
    currentWeight = currentWeekWeighIns[0].weight_kg;
    if (olderWeighIns.length > 0 && currentWeight !== null) {
      const lastWeekWeight = olderWeighIns[0].weight_kg;
      deltaKg = currentWeight - lastWeekWeight;
      
      const fourWeekWeights = [...currentWeekWeighIns, ...olderWeighIns].slice(0, 8);
      if (fourWeekWeights.length >= 2) {
        const oldest = fourWeekWeights[fourWeekWeights.length - 1].weight_kg;
        const newest = fourWeekWeights[0].weight_kg;
        const diff = newest - oldest;
        if (diff > 0.5) trend4Week = 'gaining';
        else if (diff < -0.5) trend4Week = 'losing';
        else trend4Week = 'stable';
      }
    }
  } else {
    missingData.push('No weight entries this week');
  }

  const sessions = workoutSessions.data || [];
  const sessionsCompleted = sessions.filter(s => s.completed_at).length;
  
  const assignments = await supabaseAdmin
    .from('routine_assignments')
    .select('routine_version_id, routine_versions!routine_assignments_routine_version_id_fkey(routine_blueprints(sessions_per_week))')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .limit(1)
    .single();

  let sessionsAssigned = 0;
  if (assignments.data) {
    const routineVersions = assignments.data.routine_versions as any;
    if (routineVersions?.routine_blueprints?.sessions_per_week) {
      sessionsAssigned = routineVersions.routine_blueprints.sessions_per_week;
    }
  }

  const adherencePercent = sessionsAssigned > 0 
    ? Math.round((sessionsCompleted / sessionsAssigned) * 100) 
    : 0;

  if (sessions.length === 0) {
    missingData.push('No workout sessions logged');
  }

  const foods = foodLogs.data || [];
  const daysLogged = new Set(foods.map(f => f.logged_at.split('T')[0])).size;
  
  let avgCalories: number | null = null;
  let avgProtein: number | null = null;
  let nutritionAdherence: number | null = null;

  if (foods.length > 0) {
    const totalCalories = foods.reduce((sum, f) => sum + (f.calories || 0), 0);
    const totalProtein = foods.reduce((sum, f) => sum + (f.protein || 0), 0);
    avgCalories = Math.round(totalCalories / daysLogged);
    avgProtein = Math.round(totalProtein / daysLogged);
    
    const targetCalories = profile.data?.daily_calorie_goal;
    if (targetCalories) {
      nutritionAdherence = Math.round((avgCalories / targetCalories) * 100);
    }
  } else {
    missingData.push('No food entries logged');
  }

  const cardio = cardioActivities.data || [];
  const totalCardioMinutes = cardio.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);
  const cardioTypes = Array.from(new Set(cardio.map(c => c.activity_type)));

  if (cardio.length === 0) {
    missingData.push('No cardio activities logged');
  }

  const fastsData = fasts.data || [];
  const completedFasts = fastsData.filter(f => f.status === 'ended');
  const avgFastDuration = completedFasts.length > 0
    ? completedFasts.reduce((sum, f) => {
        if (!f.ended_at) return sum;
        const start = new Date(f.started_at);
        const end = new Date(f.ended_at);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0) / completedFasts.length
    : null;

  let reliability: 'high' | 'medium' | 'low' = 'high';
  if (missingData.length >= 3) reliability = 'low';
  else if (missingData.length >= 1) reliability = 'medium';

  return {
    weight: {
      current_kg: currentWeight,
      delta_kg: deltaKg,
      trend_4_week: trend4Week,
    },
    training: {
      sessions_completed: sessionsCompleted,
      sessions_assigned: sessionsAssigned,
      adherence_percent: adherencePercent,
      missed_days: [],
      notable_performances: [],
    },
    nutrition: {
      avg_calories: avgCalories,
      target_calories: profile.data?.daily_calorie_goal || null,
      avg_protein_g: avgProtein,
      target_protein_g: profile.data?.daily_protein_goal || null,
      days_logged: daysLogged,
      adherence_percent: nutritionAdherence,
    },
    cardio: {
      total_minutes: totalCardioMinutes,
      activities: cardioTypes,
    },
    fasting: {
      fasts_completed: completedFasts.length,
      avg_duration_hours: avgFastDuration ? Math.round(avgFastDuration * 10) / 10 : null,
      adherence_percent: null,
    },
    data_quality: {
      missing_data: missingData,
      reliability,
    },
  };
}

// ============ SCHEDULING HELPERS ============

export function calculateNextDueDate(anchorWeekday: number, cadence: CheckInCadence, afterDate?: Date): Date {
  const now = afterDate || new Date();
  const currentDay = now.getDay();
  
  let daysUntilAnchor = anchorWeekday - currentDay;
  if (daysUntilAnchor <= 0) {
    daysUntilAnchor += 7;
  }
  
  const nextDue = new Date(now);
  nextDue.setDate(nextDue.getDate() + daysUntilAnchor);
  nextDue.setHours(23, 59, 59, 999);

  if (cadence === 'biweekly') {
    nextDue.setDate(nextDue.getDate() + 7);
  }

  return nextDue;
}

export function getWeekStartForDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export async function scheduleNextSubmission(assignment: CheckInTemplateAssignment): Promise<CheckInSubmission> {
  const latestSubmission = await supabaseAdmin
    .from('check_in_submissions')
    .select('*')
    .eq('assignment_id', assignment.id)
    .order('week_start', { ascending: false })
    .limit(1)
    .single();

  let afterDate: Date | undefined;
  if (latestSubmission.data) {
    afterDate = new Date(latestSubmission.data.week_start);
    afterDate.setDate(afterDate.getDate() + 7);
  }

  const nextDueDate = calculateNextDueDate(assignment.anchor_weekday, assignment.cadence, afterDate);
  const weekStart = getWeekStartForDate(nextDueDate);

  return createSubmission({
    assignment_id: assignment.id,
    template_version_id: assignment.template_version_id,
    client_id: assignment.client_id,
    professional_id: assignment.professional_id,
    week_start: weekStart,
    due_at: nextDueDate.toISOString(),
  });
}

// ============ SUBMISSION FULL DETAILS (DRILL-DOWN) ============

export interface SubmissionRawDetails {
  weighIns: Array<{
    id: string;
    weight_kg: number;
    recorded_at: string;
  }>;
  foodLogs: Array<{
    id: string;
    food_name: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    logged_at: string;
    meal_type: string | null;
  }>;
  workoutSessions: Array<{
    id: string;
    routine_session_id: string | null;
    started_at: string;
    completed_at: string | null;
    notes: string | null;
    exercises: Array<{
      exercise_name: string;
      sets: Array<{
        reps: number | null;
        weight_kg: number | null;
        notes: string | null;
      }>;
    }>;
  }>;
  cardioActivities: Array<{
    id: string;
    activity_type: string;
    duration_minutes: number | null;
    distance_km: number | null;
    calories_burned: number | null;
    started_at: string;
    notes: string | null;
  }>;
  fasts: Array<{
    id: string;
    started_at: string;
    ended_at: string | null;
    target_hours: number | null;
    status: string;
  }>;
}

export async function getSubmissionFullDetails(
  submissionId: string, 
  professionalId: string
): Promise<SubmissionRawDetails | null> {
  const submission = await getProSubmission(submissionId, professionalId);
  if (!submission) {
    return null;
  }

  const weekStart = new Date(submission.week_start);
  const weekEnd = new Date(submission.week_start);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  const clientId = submission.client_id;

  const [weighIns, foodLogs, workoutSessions, cardioActivities, fasts] = await Promise.all([
    supabaseAdmin
      .from('weigh_ins')
      .select('id, weight_kg, recorded_at')
      .eq('user_id', clientId)
      .gte('recorded_at', weekStart.toISOString())
      .lt('recorded_at', weekEnd.toISOString())
      .order('recorded_at', { ascending: true }),

    supabaseAdmin
      .from('food_logs')
      .select('id, food_name, calories, protein, carbs, fat, logged_at, meal_type')
      .eq('user_id', clientId)
      .gte('logged_at', weekStart.toISOString())
      .lt('logged_at', weekEnd.toISOString())
      .order('logged_at', { ascending: true }),

    supabaseAdmin
      .from('workout_sessions')
      .select(`
        id, 
        routine_session_id, 
        started_at, 
        completed_at, 
        notes,
        workout_sets(
          id, 
          reps, 
          weight_kg, 
          notes,
          routine_session_exercises(
            exercises(name)
          )
        )
      `)
      .eq('user_id', clientId)
      .gte('started_at', weekStart.toISOString())
      .lt('started_at', weekEnd.toISOString())
      .order('started_at', { ascending: true }),

    supabaseAdmin
      .from('cardio_activities')
      .select('id, activity_type, duration_minutes, distance_km, calories_burned, started_at, notes')
      .eq('user_id', clientId)
      .gte('started_at', weekStart.toISOString())
      .lt('started_at', weekEnd.toISOString())
      .order('started_at', { ascending: true }),

    supabaseAdmin
      .from('fasts')
      .select('id, started_at, ended_at, target_hours, status')
      .eq('user_id', clientId)
      .gte('started_at', weekStart.toISOString())
      .lt('started_at', weekEnd.toISOString())
      .order('started_at', { ascending: true }),
  ]);

  const formattedWorkoutSessions = (workoutSessions.data || []).map(session => {
    const exerciseMap = new Map<string, Array<{ reps: number | null; weight_kg: number | null; notes: string | null }>>();
    
    for (const set of (session.workout_sets as any[] || [])) {
      const exerciseName = set.routine_session_exercises?.exercises?.name || 'Unknown Exercise';
      if (!exerciseMap.has(exerciseName)) {
        exerciseMap.set(exerciseName, []);
      }
      exerciseMap.get(exerciseName)!.push({
        reps: set.reps,
        weight_kg: set.weight_kg,
        notes: set.notes,
      });
    }

    return {
      id: session.id,
      routine_session_id: session.routine_session_id,
      started_at: session.started_at,
      completed_at: session.completed_at,
      notes: session.notes,
      exercises: Array.from(exerciseMap.entries()).map(([name, sets]) => ({
        exercise_name: name,
        sets,
      })),
    };
  });

  return {
    weighIns: weighIns.data || [],
    foodLogs: foodLogs.data || [],
    workoutSessions: formattedWorkoutSessions,
    cardioActivities: cardioActivities.data || [],
    fasts: fasts.data || [],
  };
}
