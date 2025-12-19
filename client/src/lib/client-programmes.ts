import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";

export type ClientTier = 'normal' | 'pro_connected';

export interface ClientTierInfo {
  tier: ClientTier;
  professional: {
    id: string;
    display_name: string;
    headline: string | null;
  } | null;
  entitlements: {
    can_use_ai_programmes: boolean;
    ai_programmes_per_month: number;
    can_receive_pro_assignments: boolean;
  };
}

export interface ProgrammeSummary {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  sessions_per_week: number | null;
  duration_weeks: number | null;
}

export interface AssignedByInfo {
  id: string;
  name: string;
  headline: string | null;
}

export interface PendingUpdateInfo {
  version_id: string;
  version_name: string;
  offered_at: string;
  notes: string | null;
}

export interface ClientAssignment {
  id: string;
  programme: ProgrammeSummary;
  assigned_by: AssignedByInfo | null;
  status: 'pending_acceptance' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected';
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  has_pending_update: boolean;
  pending_update: PendingUpdateInfo | null;
  assigned_at: string;
}

export interface ClientProgrammes {
  pending: ClientAssignment[];
  active: ClientAssignment[];
}

export interface SessionExercise {
  exercise_id: string | null;
  exercise_name: string;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  notes: string | null;
  order_in_day: number;
  load_directive: 'absolute' | 'assisted' | 'bodyweight' | 'open';
  target_weight_kg: number | null;
  entered_weight_value: number | null;
  entered_weight_unit: 'kg' | 'lbs' | null;
}

export interface ProgrammeSession {
  session_id: string;
  day_number: number;
  focus: string | null;
  exercises: SessionExercise[];
}

export interface AcceptedProgrammeResult {
  assignment: {
    id: string;
    status: string;
    routine_version_id: string;
    client_id: string;
  };
  sessions: ProgrammeSession[];
}

export function useClientTier() {
  return useQuery<ClientTierInfo>({
    queryKey: ['/api/client/tier'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/tier');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useClientProgrammes() {
  return useQuery<ClientProgrammes>({
    queryKey: ['/api/client/programmes'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/programmes');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
}

export function useAcceptProgramme() {
  return useMutation<AcceptedProgrammeResult, Error, { assignmentId: string }>({
    mutationFn: async ({ assignmentId }) => {
      const res = await apiRequest('POST', `/api/client/programmes/${assignmentId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/programmes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/tier'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/assignments'] });
    },
  });
}

export function useRejectProgramme() {
  return useMutation<any, Error, { assignmentId: string; reason?: string }>({
    mutationFn: async ({ assignmentId, reason }) => {
      const res = await apiRequest('POST', `/api/client/programmes/${assignmentId}/reject`, {
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/programmes'] });
    },
  });
}

export interface ClientProOverview {
  professional: {
    id: string;
    display_name: string;
    headline: string | null;
    specialties: string[];
    contact_email: string | null;
    profile_photo_path: string | null;
  } | null;
  relationshipSince: string | null;
  activeProgrammeCount: number;
}

export function useClientProOverview() {
  return useQuery<ClientProOverview>({
    queryKey: ['/api/client/my-pro'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/my-pro');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// Phase 5C: Accept a pending programme update
export function useAcceptProgrammeUpdate() {
  return useMutation<AcceptedProgrammeResult, Error, { assignmentId: string }>({
    mutationFn: async ({ assignmentId }) => {
      const res = await apiRequest('POST', `/api/client/programmes/${assignmentId}/accept-update`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/programmes'] });
    },
  });
}

// Phase 5C: Decline a pending programme update
export function useDeclineProgrammeUpdate() {
  return useMutation<any, Error, { assignmentId: string }>({
    mutationFn: async ({ assignmentId }) => {
      const res = await apiRequest('POST', `/api/client/programmes/${assignmentId}/decline-update`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/programmes'] });
    },
  });
}

// Assignment with full session details for workout display
export interface AssignmentWithSessions {
  assignment: {
    id: string;
    client_id: string;
    routine_version_id: string;
    assigned_by_pro_id: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    has_pending_update: boolean;
    created_at: string;
    updated_at: string;
  };
  programme: {
    id: string;
    name: string;
    description: string | null;
    goal: string | null;
    duration_weeks: number | null;
    sessions_per_week: number | null;
  };
  sessions: ProgrammeSession[];
}

// Get all active assignments with their sessions for the Train page
export function useClientAssignedRoutines() {
  return useQuery<AssignmentWithSessions[]>({
    queryKey: ['/api/client/assignments'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/assignments');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
