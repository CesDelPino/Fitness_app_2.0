import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";

export type CheckInCadence = 'weekly' | 'biweekly';
export type TemplateVersionStatus = 'draft' | 'active' | 'archived';
export type SubmissionStatus = 'scheduled' | 'in_progress' | 'submitted' | 'missed';
export type QuestionFieldType = 'short_text' | 'long_text' | 'single_select' | 'multi_select' | 'scale_1_5' | 'boolean';

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
  questions_count?: number;
}

export interface CheckInTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  status: TemplateVersionStatus;
  created_at: string;
  published_at: string | null;
}

export interface CheckInQuestion {
  id: string;
  template_version_id: string;
  question_text: string;
  field_type: QuestionFieldType;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface CheckInAssignment {
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
  template?: CheckInTemplate;
  client?: {
    id: string;
    email: string;
    display_name: string | null;
  };
}

export interface CheckInSubmission {
  id: string;
  assignment_id: string;
  template_version_id: string;
  client_id: string;
  professional_id: string;
  week_start: string;
  due_at: string;
  status: SubmissionStatus;
  started_at: string | null;
  submitted_at: string | null;
  client_notes: string | null;
  metrics_snapshot: WeeklyMetrics | null;
  created_at: string;
  client?: {
    id: string;
    email: string;
    display_name: string | null;
  };
}

export interface CheckInAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  answer_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisFlag {
  severity: 'high' | 'medium' | 'low';
  category: 'weight' | 'adherence' | 'nutrition' | 'recovery' | 'motivation' | 'other';
  issue: string;
  data_points: string[];
}

export interface CheckInAnalysis {
  id: string;
  submission_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  risk_score: number | null;
  summary: string | null;
  flags: AnalysisFlag[] | null;
  wins: string[] | null;
  suggested_response: string | null;
  coaching_notes: string | null;
  ai_model: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WeeklyMetrics {
  weight: {
    current_kg: number | null;
    delta_kg: number | null;
    trend_4_week: 'gaining' | 'losing' | 'stable' | null;
  };
  training: {
    sessions_completed: number;
    sessions_assigned: number;
    adherence_percent: number;
    missed_days: number[];
    notable_performances: any[];
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
  };
  reliability: 'high' | 'medium' | 'low';
  missing_data: string[];
}

export interface TemplateWithDetails {
  template: CheckInTemplate;
  versions: CheckInTemplateVersion[];
  active_version: CheckInTemplateVersion | null;
  questions: CheckInQuestion[];
}

export function useProCheckInTemplates() {
  return useQuery<CheckInTemplate[]>({
    queryKey: ['/api/pro/check-ins/templates'],
  });
}

export function useProCheckInTemplate(templateId: string | undefined) {
  return useQuery<TemplateWithDetails>({
    queryKey: ['/api/pro/check-ins/templates', templateId],
    enabled: !!templateId,
  });
}

export function useCreateCheckInTemplate() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      cadence?: CheckInCadence;
    }) => {
      const res = await apiRequest('POST', '/api/pro/check-ins/templates', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates'] });
    },
  });
}

export function useUpdateCheckInTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, ...data }: {
      templateId: string;
      name?: string;
      description?: string;
      cadence?: CheckInCadence;
      is_archived?: boolean;
    }) => {
      const res = await apiRequest('PATCH', `/api/pro/check-ins/templates/${templateId}`, data);
      return res.json();
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates', templateId] });
    },
  });
}

export function useDeleteCheckInTemplate() {
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest('DELETE', `/api/pro/check-ins/templates/${templateId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates'] });
    },
  });
}

export function useSetCheckInQuestions() {
  return useMutation({
    mutationFn: async ({ templateId, questions }: {
      templateId: string;
      questions: {
        question_text: string;
        field_type: QuestionFieldType;
        options?: string[];
        is_required?: boolean;
        display_order: number;
      }[];
    }) => {
      const res = await apiRequest('PUT', `/api/pro/check-ins/templates/${templateId}/questions`, questions);
      return res.json();
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates', templateId] });
    },
  });
}

export function usePublishCheckInTemplate() {
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest('POST', `/api/pro/check-ins/templates/${templateId}/publish`);
      return res.json();
    },
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates', templateId] });
    },
  });
}

export function useProCheckInAssignments() {
  return useQuery<CheckInAssignment[]>({
    queryKey: ['/api/pro/check-ins/assignments'],
  });
}

export function useCreateCheckInAssignment() {
  return useMutation({
    mutationFn: async (data: {
      template_id: string;
      client_id: string;
      anchor_weekday: number;
      start_date: string;
      cadence?: CheckInCadence;
    }) => {
      const res = await apiRequest('POST', '/api/pro/check-ins/assignments', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/templates'] });
    },
  });
}

export function useDeactivateCheckInAssignment() {
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest('DELETE', `/api/pro/check-ins/assignments/${assignmentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/assignments'] });
    },
  });
}

export function useProCheckInSubmissions(options?: {
  clientId?: string;
  status?: SubmissionStatus;
  limit?: number;
}) {
  return useQuery<CheckInSubmission[]>({
    queryKey: ['/api/pro/check-ins/submissions', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.clientId) params.set('client_id', options.clientId);
      if (options?.status) params.set('status', options.status);
      if (options?.limit) params.set('limit', options.limit.toString());
      
      const url = `/api/pro/check-ins/submissions${params.toString() ? `?${params}` : ''}`;
      const res = await apiRequest('GET', url);
      return res.json();
    },
  });
}

export interface SubmissionWithDetails {
  submission: CheckInSubmission;
  questions: CheckInQuestion[];
  answers: CheckInAnswer[];
  analysis: CheckInAnalysis | null;
}

export function useProCheckInSubmission(submissionId: string | undefined) {
  return useQuery<SubmissionWithDetails>({
    queryKey: ['/api/pro/check-ins/submissions', submissionId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/check-ins/submissions/${submissionId}`);
      return res.json();
    },
    enabled: !!submissionId,
  });
}

export function useAnalyzeCheckIn() {
  return useMutation<CheckInAnalysis, Error, string>({
    mutationFn: async (submissionId: string) => {
      const res = await apiRequest('POST', `/api/pro/check-ins/submissions/${submissionId}/analyze`);
      return res.json();
    },
    onSuccess: (_, submissionId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/check-ins/submissions', submissionId] });
    },
  });
}

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

export function useSubmissionDetails(submissionId: string | undefined, enabled: boolean = false) {
  return useQuery<SubmissionRawDetails>({
    queryKey: ['/api/pro/check-ins/submissions', submissionId, 'details'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/check-ins/submissions/${submissionId}/details`);
      return res.json();
    },
    enabled: !!submissionId && enabled,
  });
}
