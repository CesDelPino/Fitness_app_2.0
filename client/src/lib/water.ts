import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchJson } from "./queryClient";
import { format } from "date-fns";

export interface WaterIntakeResult {
  total_ml: number;
  target_ml: number;
}

export interface WaterLog {
  id: string;
  user_id: string;
  date: string;
  amount_ml: number;
  source: string;
  created_at: string;
}

export function useWaterIntake(date: Date) {
  const dateString = format(date, "yyyy-MM-dd");
  
  return useQuery<WaterIntakeResult>({
    queryKey: ["water", dateString],
    queryFn: () => fetchJson<WaterIntakeResult>(`/api/water/${dateString}`).then(data => data!),
  });
}

export function useAddWater() {
  return useMutation({
    mutationFn: async (data: { date: string; amount_ml: number; source?: string }) => {
      const response = await apiRequest("POST", "/api/water", data);
      return response.json() as Promise<WaterIntakeResult>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["water", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["water-logs", variables.date] });
    },
  });
}

export function useWaterLogs(date: Date) {
  const dateString = format(date, "yyyy-MM-dd");
  
  return useQuery<WaterLog[]>({
    queryKey: ["water-logs", dateString],
    queryFn: () => fetchJson<WaterLog[]>(`/api/water/${dateString}/logs`).then(data => data || []),
  });
}

export function useUpdateWaterTarget() {
  return useMutation({
    mutationFn: async (target_ml: number) => {
      const response = await apiRequest("PATCH", "/api/water/target", { target_ml });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all water and water-logs queries (prefix match)
      // This will invalidate ["water", "2024-12-04"], ["water-logs", "2024-12-04"], etc.
      queryClient.invalidateQueries({ queryKey: ["water"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["water-logs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
