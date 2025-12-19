import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";
import type { 
  CheckInQuestion, 
  CheckInAnswer, 
  CheckInSubmission, 
  WeeklyMetrics 
} from "./pro-checkins";

export interface UpcomingCheckIn {
  submission: CheckInSubmission;
  questions: CheckInQuestion[];
  answers: CheckInAnswer[];
  metrics: WeeklyMetrics;
}

export interface UpcomingCheckInResponse {
  upcoming: UpcomingCheckIn | null;
}

export function useClientUpcomingCheckIn() {
  return useQuery<UpcomingCheckInResponse>({
    queryKey: ['/api/client/check-ins/upcoming'],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartCheckIn() {
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const res = await apiRequest('POST', `/api/client/check-ins/${submissionId}/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/check-ins/upcoming'] });
    },
  });
}

export function useSaveCheckInDraft() {
  return useMutation({
    mutationFn: async ({ submissionId, answers }: {
      submissionId: string;
      answers: { question_id: string; answer_value: string | null }[];
    }) => {
      const res = await apiRequest('POST', `/api/client/check-ins/${submissionId}/save-draft`, answers);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/check-ins/upcoming'] });
    },
  });
}

export function useSubmitCheckIn() {
  return useMutation({
    mutationFn: async ({ submissionId, answers }: {
      submissionId: string;
      answers?: { question_id: string; answer_value: string | null }[];
    }) => {
      const res = await apiRequest('POST', `/api/client/check-ins/${submissionId}/submit`, 
        answers ? { answers } : {}
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/check-ins/upcoming'] });
    },
  });
}

export function useClientCheckInMetrics() {
  return useQuery<WeeklyMetrics>({
    queryKey: ['/api/client/check-ins/metrics'],
  });
}

export function useRefreshCheckInMetrics() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/client/check-ins/metrics/refresh');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/check-ins/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/check-ins/upcoming'] });
    },
  });
}
