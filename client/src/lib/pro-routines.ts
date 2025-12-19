import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";

export interface RoutineBlueprint {
  id: string;
  name: string;
  description: string | null;
  owner_type: 'platform' | 'professional' | 'client_proxy';
  owner_id: string | null;
  created_for_client_id: string | null;
  creation_method: 'manual' | 'template' | 'ai_assisted';
  source_blueprint_id: string | null;
  goal_type_id: string | null;
  equipment_profile: string[] | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  ai_prompt: string | null;
  ai_response: any | null;
  is_template: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutineVersion {
  id: string;
  blueprint_id: string;
  version_number: number;
  status: 'draft' | 'pending_review' | 'active' | 'archived';
  notes: string | null;
  created_at: string;
  published_at: string | null;
}

export type LoadDirective = 'absolute' | 'assisted' | 'bodyweight' | 'open';
export type WeightUnit = 'kg' | 'lbs';

export interface RoutineVersionExercise {
  id: string;
  routine_version_id: string;
  exercise_id: string | null;
  custom_exercise_name: string | null;
  day_number: number;
  order_in_day: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  notes: string | null;
  superset_group: string | null;
  target_weight_kg: number | null;
  entered_weight_value: number | null;
  entered_weight_unit: WeightUnit | null;
  load_directive: LoadDirective;
  special_instructions: string | null;
  created_at: string;
  exercise?: {
    id: string;
    name: string;
    category: string;
    muscle_groups: string[];
  };
}

export interface ProClient {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  relationship_since: string;
  role_type: string;
  profile_completed?: boolean;
}

export interface RoutineAssignment {
  id: string;
  routine_version_id: string;
  client_id: string;
  assigned_by_pro_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  routine_version?: RoutineVersion & {
    blueprint?: RoutineBlueprint;
  };
}

export interface RoutineWithDetails {
  routine: RoutineBlueprint;
  versions: RoutineVersion[];
  activeVersion: RoutineVersion | null;
  exercises: RoutineVersionExercise[];
}

export function useProRoutines(options?: { 
  includeTemplates?: boolean; 
  includeArchived?: boolean;
}) {
  return useQuery<RoutineBlueprint[]>({
    queryKey: [
      '/api/pro/routines',
      { includeTemplates: options?.includeTemplates, includeArchived: options?.includeArchived }
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.includeTemplates === false) {
        params.set('includeTemplates', 'false');
      }
      if (options?.includeArchived) {
        params.set('includeArchived', 'true');
      }
      const url = `/api/pro/routines${params.toString() ? `?${params}` : ''}`;
      const res = await apiRequest('GET', url);
      return res.json();
    },
  });
}

export function useProRoutine(routineId: string | undefined) {
  return useQuery<RoutineWithDetails>({
    queryKey: ['/api/pro/routines', routineId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/routines/${routineId}`);
      return res.json();
    },
    enabled: !!routineId,
  });
}

export function useProClients() {
  return useQuery<ProClient[]>({
    queryKey: ['/api/pro/clients'],
  });
}

export function useProAssignments(filters?: { clientId?: string; status?: string }) {
  return useQuery<RoutineAssignment[]>({
    queryKey: ['/api/pro/assignments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.clientId) params.set('client_id', filters.clientId);
      if (filters?.status) params.set('status', filters.status);
      const url = `/api/pro/assignments${params.toString() ? `?${params}` : ''}`;
      const res = await apiRequest('GET', url);
      return res.json();
    },
  });
}

export function useClientAssignments(clientId: string | undefined) {
  return useQuery<RoutineAssignment[]>({
    queryKey: ['/api/pro/clients', clientId, 'assignments'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/clients/${clientId}/assignments`);
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateProRoutine() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      goal_type_id?: string;
      equipment_profile?: string[];
      duration_weeks?: number;
      sessions_per_week?: number;
      creation_method?: 'manual' | 'template' | 'ai_assisted';
    }) => {
      const res = await apiRequest('POST', '/api/pro/routines', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines'] });
    },
  });
}

export function useCloneProRoutine() {
  return useMutation({
    mutationFn: async ({ routineId, overrides }: {
      routineId: string;
      overrides?: { name?: string; description?: string };
    }) => {
      const res = await apiRequest('POST', `/api/pro/routines/${routineId}/clone`, overrides || {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines'] });
    },
  });
}

export interface AiGenerateResponse {
  blueprint: RoutineBlueprint;
  version: RoutineVersion;
  exercises: RoutineVersionExercise[];
  ai_response: {
    name: string;
    description: string;
    sessions_per_week: number;
    duration_weeks: number;
    days: Array<{
      day_number: number;
      focus: string;
      exercises: Array<{
        exercise_name: string;
        sets: number;
        reps_min: number;
        reps_max: number;
        rest_seconds: number;
        notes: string;
      }>;
    }>;
  };
  warnings: string[];
}

export function useAiGenerateProRoutine() {
  return useMutation<AiGenerateResponse, Error, {
    prompt_text: string;
    equipment_selected: string[];
    goal_type_id?: string | null;
    sessions_per_week?: number;
    duration_weeks?: number;
  }>({
    mutationFn: async (data) => {
      const res = await apiRequest('POST', '/api/pro/routines/ai-generate', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines'] });
    },
  });
}

export function useUpdateProRoutine() {
  return useMutation({
    mutationFn: async ({ routineId, updates }: {
      routineId: string;
      updates: Partial<{
        name: string;
        description: string;
        goal_type_id: string;
        equipment_profile: string[];
        duration_weeks: number;
        sessions_per_week: number;
        is_archived: boolean;
      }>;
    }) => {
      const res = await apiRequest('PUT', `/api/pro/routines/${routineId}`, updates);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines', variables.routineId] });
    },
  });
}

export function useArchiveProRoutine() {
  return useMutation({
    mutationFn: async (routineId: string) => {
      const res = await apiRequest('DELETE', `/api/pro/routines/${routineId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines'] });
    },
  });
}

export function useAssignRoutine() {
  return useMutation({
    mutationFn: async (variables: {
      routineId: string;
      client_id: string;
      start_date?: string;
      end_date?: string;
      notes?: string;
    }) => {
      const { routineId, ...body } = variables;
      const res = await apiRequest('POST', `/api/pro/routines/${routineId}/assign`, body);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', variables.client_id, 'assignments'] });
    },
  });
}

export function useUpdateProAssignment() {
  return useMutation({
    mutationFn: async (variables: {
      assignmentId: string;
      clientId?: string;
      updates: Partial<{
        status: 'active' | 'paused' | 'completed' | 'cancelled';
        start_date: string | null;
        end_date: string | null;
        notes: string | null;
      }>;
    }) => {
      const res = await apiRequest('PUT', `/api/pro/assignments/${variables.assignmentId}`, variables.updates);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/clients'] });
      if (variables.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', variables.clientId, 'assignments'] });
      }
    },
  });
}

export function useCancelProAssignment() {
  return useMutation({
    mutationFn: async (variables: { assignmentId: string; clientId?: string }) => {
      const res = await apiRequest('DELETE', `/api/pro/assignments/${variables.assignmentId}`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/clients'] });
      if (variables.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', variables.clientId, 'assignments'] });
      }
    },
  });
}

// Phase 5C: Push programme update to client
export function usePushProgrammeUpdate() {
  return useMutation({
    mutationFn: async (variables: { 
      assignmentId: string; 
      versionId: string; 
      notes?: string;
      clientId?: string;
    }) => {
      const res = await apiRequest('POST', `/api/pro/assignments/${variables.assignmentId}/push-update`, {
        version_id: variables.versionId,
        notes: variables.notes,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/assignments'] });
      if (variables.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', variables.clientId, 'assignments'] });
      }
    },
  });
}

export interface AddExerciseData {
  exercise_id?: string | null;
  custom_exercise_name?: string | null;
  day_number: number;
  order_in_day: number;
  sets?: number;
  reps_min?: number | null;
  reps_max?: number | null;
  rest_seconds?: number | null;
  notes?: string | null;
  superset_group?: string | null;
  target_weight_kg?: number | null;
  entered_weight_value?: number | null;
  entered_weight_unit?: WeightUnit | null;
  load_directive?: LoadDirective;
  special_instructions?: string | null;
}

export interface UpdateExerciseData {
  exercise_id?: string | null;
  custom_exercise_name?: string | null;
  day_number?: number;
  order_in_day?: number;
  sets?: number;
  reps_min?: number | null;
  reps_max?: number | null;
  rest_seconds?: number | null;
  notes?: string | null;
  superset_group?: string | null;
  target_weight_kg?: number | null;
  entered_weight_value?: number | null;
  entered_weight_unit?: WeightUnit | null;
  load_directive?: LoadDirective;
  special_instructions?: string | null;
}

export function useAddProExercise() {
  return useMutation({
    mutationFn: async ({ routineId, exercise }: { routineId: string; exercise: AddExerciseData }) => {
      const res = await apiRequest('POST', `/api/pro/routines/${routineId}/exercises`, exercise);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines', variables.routineId] });
    },
  });
}

export function useUpdateProExercise() {
  return useMutation({
    mutationFn: async ({ routineId, exerciseId, updates }: { 
      routineId: string; 
      exerciseId: string; 
      updates: UpdateExerciseData;
    }) => {
      const res = await apiRequest('PUT', `/api/pro/routines/${routineId}/exercises/${exerciseId}`, updates);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines', variables.routineId] });
    },
  });
}

export function useDeleteProExercise() {
  return useMutation({
    mutationFn: async ({ routineId, exerciseId }: { routineId: string; exerciseId: string }) => {
      const res = await apiRequest('DELETE', `/api/pro/routines/${routineId}/exercises/${exerciseId}`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines', variables.routineId] });
    },
  });
}

export function useReorderProExercises() {
  return useMutation({
    mutationFn: async ({ routineId, exercises }: { 
      routineId: string; 
      exercises: { id: string; day_number: number; order_in_day: number }[];
    }) => {
      const res = await apiRequest('PUT', `/api/pro/routines/${routineId}/exercises/reorder`, exercises);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines', variables.routineId] });
    },
  });
}

export interface GoalType {
  id: string;
  name: string;
  description: string | null;
  default_rep_range: string | null;
  default_rest_seconds: number | null;
}

export interface ReviewQueueItem extends RoutineBlueprint {
  latest_version?: RoutineVersion & { exercises?: RoutineVersionExercise[] };
  goal?: GoalType;
}

export function useProReviewQueue() {
  return useQuery<ReviewQueueItem[]>({
    queryKey: ['/api/pro/routines/review-queue'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pro/routines/review-queue');
      return res.json();
    },
  });
}

export function useApproveProRoutine() {
  return useMutation({
    mutationFn: async ({ routineId, notes }: { routineId: string; notes?: string }) => {
      const res = await apiRequest('POST', `/api/pro/routines/${routineId}/approve`, { notes });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines/review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/routines', variables.routineId] });
    },
  });
}

export type AssignmentEventType = 'created' | 'status_changed' | 'dates_updated' | 'notes_updated' | 'reassigned';

export interface AssignmentEvent {
  id: string;
  assignment_id: string;
  event_type: AssignmentEventType;
  performed_by: string | null;
  old_status: string | null;
  new_status: string | null;
  old_start_date: string | null;
  new_start_date: string | null;
  old_end_date: string | null;
  new_end_date: string | null;
  old_notes: string | null;
  new_notes: string | null;
  event_notes: string | null;
  created_at: string;
}

export interface AssignmentEventWithDetails extends AssignmentEvent {
  assignment?: RoutineAssignment;
}

export function useAssignmentHistory(assignmentId: string | undefined) {
  return useQuery<AssignmentEvent[]>({
    queryKey: ['/api/pro/assignments', assignmentId, 'history'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/assignments/${assignmentId}/history`);
      return res.json();
    },
    enabled: !!assignmentId,
  });
}

export function useClientHistory(clientId: string | undefined, limit?: number) {
  return useQuery<AssignmentEventWithDetails[]>({
    queryKey: ['/api/pro/clients', clientId, 'history', { limit }],
    queryFn: async () => {
      const params = limit ? `?limit=${limit}` : '';
      const res = await apiRequest('GET', `/api/pro/clients/${clientId}/history${params}`);
      return res.json();
    },
    enabled: !!clientId,
  });
}

// Phase 5C-4: Expired update notifications for professionals
export interface ExpiredUpdateNotification {
  assignment_id: string;
  client_id: string;
  client_name: string | null;
  programme_name: string | null;
  expired_at: string;
}

export function useProExpiredUpdates() {
  return useQuery<ExpiredUpdateNotification[]>({
    queryKey: ['/api/pro/expired-updates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pro/expired-updates');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
