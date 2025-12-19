import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { NutritionTarget } from "@shared/supabase-types";

export interface NutritionTargetWithPro extends NutritionTarget {
  professional_name?: string | null;
}

export interface NutritionTargetsResponse {
  current: NutritionTargetWithPro | null;
  pending: NutritionTargetWithPro | null;
}

export function useNutritionTargets() {
  return useQuery<NutritionTargetsResponse>({
    queryKey: ["/api/nutrition-targets"],
  });
}

export function useAcceptNutritionTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetId: string) => {
      const res = await apiRequest("POST", "/api/nutrition-targets/accept", {
        target_id: targetId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition-targets"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function useDeclineNutritionTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetId: string) => {
      const res = await apiRequest("POST", "/api/nutrition-targets/decline", {
        target_id: targetId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition-targets"] });
    },
  });
}

export function useUpdateNutritionTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { protein_g: number; carbs_g: number; fat_g: number }) => {
      const res = await apiRequest("PATCH", "/api/nutrition-targets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition-targets"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function calculateCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}
