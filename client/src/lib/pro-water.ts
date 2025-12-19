import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./queryClient";
import { format } from "date-fns";

export interface WaterIntakeResult {
  total_ml: number;
  target_ml: number;
}

export interface WaterHistoryDay {
  date: string;
  total_ml: number;
  target_ml: number;
}

export function useProClientWater(clientId: string | undefined, date?: Date) {
  const dateString = date ? format(date, "yyyy-MM-dd") : undefined;
  const queryParam = dateString ? `?date=${dateString}` : "";
  
  return useQuery<WaterIntakeResult>({
    queryKey: ["pro-client-water", clientId, dateString || "today"],
    queryFn: () => fetchJson<WaterIntakeResult>(`/api/pro/clients/${clientId}/water${queryParam}`).then(data => data!),
    enabled: !!clientId,
  });
}

export function useProClientWaterHistory(clientId: string | undefined, days: number = 7) {
  return useQuery<WaterHistoryDay[]>({
    queryKey: ["pro-client-water-history", clientId, days],
    queryFn: () => fetchJson<WaterHistoryDay[]>(`/api/pro/clients/${clientId}/water/history?days=${days}`).then(data => data || []),
    enabled: !!clientId,
  });
}
