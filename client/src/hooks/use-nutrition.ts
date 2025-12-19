import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (error) {
    console.error("Error getting auth headers:", error);
  }
  return {};
}

export interface FoodNutrient {
  fdcNutrientId: number;
  name: string;
  unit: string;
  amountPer100g: number | null;
  amountPerServing: number | null;
}

export interface FoodPortion {
  id?: number;
  amount: number | null;
  gramWeight: number | null;
  modifier: string;
  measureUnit?: string | { name: string; abbreviation: string };
  portionDescription?: string;
}

export interface FDAFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  gtinUpc?: string;
  ingredients?: string;
  nutrients: FoodNutrient[];
  portions?: FoodPortion[];
}

interface FDASearchResult {
  foods: FDAFood[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

interface MealCapture {
  id: string;
  user_id: string;
  capture_type: 'photo' | 'manual' | 'barcode' | 'text';
  raw_ai_response?: any;
  image_path?: string;
  created_at: string;
}

interface FoodLog {
  id: string;
  user_id: string;
  food_name: string;
  quantity_value: number;
  quantity_unit: string;
  calories: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  meal_type?: string | null;
  barcode?: string | null;
  logged_at: string;
  meal_capture_id?: string | null;
  food_item_id?: string | null;
  nutrient_snapshot?: any | null;
}

interface CreateFoodLogPayload {
  foodName: string;
  quantityValue: number;
  quantityUnit: string;
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  caloriesPerUnit?: number | null;
  proteinPerUnit?: number | null;
  carbsPerUnit?: number | null;
  fatPerUnit?: number | null;
  micronutrientsDump?: any | null;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  breaksFast?: boolean;
  barcode?: string | null;
  loggedAt?: string;
  mealCaptureId?: string | null;
  foodItemId?: string | null;
  nutrientSnapshot?: any | null;
}

interface UpdateFoodLogPayload {
  foodName?: string;
  quantityValue?: number;
  quantityUnit?: string;
  calories?: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export { useFeatureAccess, type FeatureCode, FEATURE_DESCRIPTIONS, PREMIUM_FEATURES } from "./useFeatureAccess";

export function useFDASearch(query: string) {
  return useQuery<FDASearchResult>({
    queryKey: ['/api/nutrition/search', { q: query }],
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`/api/nutrition/search?${params}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
  });
}

export function useFDABarcode(upc: string | null) {
  return useQuery<FDAFood>({
    queryKey: ['/api/nutrition/barcode', upc],
    enabled: !!upc && upc.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useFDAFood(fdcId: number | null) {
  return useQuery<FDAFood>({
    queryKey: ['/api/nutrition/foods', fdcId?.toString()],
    enabled: !!fdcId,
    staleTime: 30 * 60 * 1000,
  });
}

export function useFDABatchFoods(fdcIds: number[]) {
  return useQuery<{ foods: FDAFood[] }>({
    queryKey: ['/api/nutrition/foods/batch', fdcIds.join(',')],
    enabled: fdcIds.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/nutrition/foods/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ fdcIds }),
      });
      if (!res.ok) throw new Error('Failed to batch fetch foods');
      return res.json();
    },
  });
}

export interface AIFoodIdentification {
  foodName: string;
  searchTerms: string[];
  servingSizeEstimate: string;
  numberOfServings: number;
  confidence: 'high' | 'medium' | 'low';
}

export function useIdentifyFood() {
  return useMutation<AIFoodIdentification, Error, File>({
    mutationFn: async (imageFile: File) => {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.append('image', imageFile);

      const res = await fetch('/api/food/identify', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to identify food' }));
        throw new Error(err.message || err.error || 'Failed to identify food');
      }

      return res.json();
    },
  });
}

export function useFoodLogs(date?: string) {
  return useQuery<{ logs: FoodLog[] }>({
    queryKey: date ? ['/api/food-logs', { date }] : ['/api/food-logs'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const url = date ? `/api/food-logs?date=${date}` : '/api/food-logs';
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch food logs');
      return res.json();
    },
  });
}

export function useCreateMealCapture() {
  const queryClient = useQueryClient();
  
  return useMutation<MealCapture, Error, { captureType: MealCapture['capture_type']; rawAiResponse?: any; imagePath?: string }>({
    mutationFn: async (data) => {
      const res = await apiRequest('POST', '/api/meal-captures', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-captures'] });
    },
  });
}

export function useCreateFoodLog() {
  const queryClient = useQueryClient();
  
  return useMutation<FoodLog, Error, CreateFoodLogPayload>({
    mutationFn: async (data) => {
      const res = await apiRequest('POST', '/api/food-logs', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/food-logs'] });
    },
  });
}

export function useUpdateFoodLog() {
  const queryClient = useQueryClient();
  
  return useMutation<FoodLog, Error, { id: string } & UpdateFoodLogPayload>({
    mutationFn: async ({ id, ...data }) => {
      const res = await apiRequest('PATCH', `/api/food-logs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/food-logs'] });
    },
  });
}

export function useDeleteFoodLog() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiRequest('DELETE', `/api/food-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/food-logs'] });
    },
  });
}

export function convertFDAToFoodLog(
  fdaFood: FDAFood,
  options: {
    quantity: number;
    unit: string;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    mealCaptureId?: string;
    breaksFast?: boolean;
  }
): CreateFoodLogPayload {
  const nutrients = fdaFood.nutrients || [];
  
  const getNutrient = (nutrientId: number): number | null => {
    const nutrient = nutrients.find(n => n.fdcNutrientId === nutrientId);
    if (!nutrient) return null;
    return nutrient.amountPerServing ?? nutrient.amountPer100g ?? null;
  };

  const calories = getNutrient(1008) ?? 0;
  const protein = getNutrient(1003);
  const carbs = getNutrient(1005);
  const fat = getNutrient(1004);
  const fiber = getNutrient(1079);
  const sugar = getNutrient(2000);

  const servingSize = fdaFood.servingSize || 100;
  const multiplier = options.quantity / servingSize;

  return {
    foodName: fdaFood.description,
    quantityValue: options.quantity,
    quantityUnit: options.unit || fdaFood.servingSizeUnit || 'g',
    calories: Math.round(calories * multiplier),
    proteinG: protein !== null ? Math.round(protein * multiplier * 10) / 10 : null,
    carbsG: carbs !== null ? Math.round(carbs * multiplier * 10) / 10 : null,
    fatG: fat !== null ? Math.round(fat * multiplier * 10) / 10 : null,
    fiberG: fiber !== null ? Math.round(fiber * multiplier * 10) / 10 : null,
    sugarG: sugar !== null ? Math.round(sugar * multiplier * 10) / 10 : null,
    caloriesPerUnit: Math.round(calories / servingSize * 10) / 10,
    proteinPerUnit: protein !== null ? Math.round(protein / servingSize * 10) / 10 : null,
    carbsPerUnit: carbs !== null ? Math.round(carbs / servingSize * 10) / 10 : null,
    fatPerUnit: fat !== null ? Math.round(fat / servingSize * 10) / 10 : null,
    mealType: options.mealType,
    mealCaptureId: options.mealCaptureId,
    breaksFast: options.breaksFast,
    foodItemId: fdaFood.fdcId ? `fda_${fdaFood.fdcId}` : null,
    nutrientSnapshot: {
      fdcId: fdaFood.fdcId,
      dataType: fdaFood.dataType,
      nutrients: nutrients.map(n => ({
        id: n.fdcNutrientId,
        name: n.name,
        unit: n.unit,
        value: Math.round((n.amountPerServing ?? n.amountPer100g ?? 0) * multiplier * 100) / 100,
      })),
      fetchedAt: new Date().toISOString(),
    },
  };
}

export function extractMacrosFromSnapshot(snapshot: any): {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
} | null {
  if (!snapshot?.nutrients || !Array.isArray(snapshot.nutrients)) {
    return null;
  }

  const getNutrient = (id: number): number | null => {
    const n = snapshot.nutrients.find((n: any) => n.id === id);
    return n?.value ?? null;
  };

  return {
    calories: getNutrient(1008),
    protein: getNutrient(1003),
    carbs: getNutrient(1005),
    fat: getNutrient(1004),
    fiber: getNutrient(1079),
    sugar: getNutrient(2000),
  };
}
