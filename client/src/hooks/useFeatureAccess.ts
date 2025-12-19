import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/queryClient";

export type FeatureCode = 
  | 'basic_macros'
  | 'text_food_search'
  | 'barcode_scan'
  | 'ai_photo_recognition'
  | 'fiber_sugar_display'
  | 'micronutrients'
  | 'micronutrient_targets'
  | 'detailed_fats';

interface FeatureAccessResponse {
  features: FeatureCode[];
  planCode: string;
  isPremium: boolean;
}

export function useFeatureAccess() {
  const { data, isLoading, error } = useQuery<FeatureAccessResponse>({
    queryKey: ["/api/features/my-access"],
    queryFn: () => fetchJson<FeatureAccessResponse>("/api/features/my-access") as Promise<FeatureAccessResponse>,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const features = data?.features || [];
  const planCode = data?.planCode || 'free';
  const isPremium = data?.isPremium || false;

  const canUseFeature = (code: FeatureCode): boolean => {
    return features.includes(code);
  };

  const requiresUpgrade = (code: FeatureCode): boolean => {
    return !canUseFeature(code);
  };

  return {
    features,
    planCode,
    isPremium,
    isLoading,
    error,
    canUseFeature,
    requiresUpgrade,
  };
}

export const FEATURE_DESCRIPTIONS: Record<FeatureCode, { name: string; description: string }> = {
  basic_macros: {
    name: 'Basic Macros',
    description: 'View calories, protein, carbs, and fat',
  },
  text_food_search: {
    name: 'Food Search',
    description: 'Search for foods by name',
  },
  barcode_scan: {
    name: 'Barcode Scanning',
    description: 'Scan food barcodes to log',
  },
  ai_photo_recognition: {
    name: 'AI Photo Analysis',
    description: 'Use your camera to identify foods automatically',
  },
  fiber_sugar_display: {
    name: 'Fiber & Sugar',
    description: 'See fiber and sugar values in food logs',
  },
  micronutrients: {
    name: 'Micronutrients',
    description: 'View vitamins and minerals in your food',
  },
  micronutrient_targets: {
    name: 'Nutrient Targets',
    description: 'Set daily goals for vitamins and minerals',
  },
  detailed_fats: {
    name: 'Detailed Fats',
    description: 'See saturated fat, trans fat, and cholesterol breakdown',
  },
};

export const PREMIUM_FEATURES: FeatureCode[] = [
  'ai_photo_recognition',
  'fiber_sugar_display',
  'micronutrients',
  'micronutrient_targets',
  'detailed_fats',
];

export type QuotaFeatureCode = 'ai_photo_recognition' | 'ai_workout_builder';

export interface QuotaStatus {
  featureCode: string;
  usageCount: number;
  monthlyLimit: number;
  remaining: number;
  usagePercent: number;
  resetDate: string;
}

interface QuotaStatusResponse {
  quotas: QuotaStatus[];
}

export function useQuotaStatus(featureCode?: QuotaFeatureCode) {
  const queryKey = featureCode 
    ? ["/api/quota/status", featureCode] 
    : ["/api/quota/status"];
    
  const { data, isLoading, error, refetch } = useQuery<QuotaStatusResponse>({
    queryKey,
    queryFn: async () => {
      const url = featureCode 
        ? `/api/quota/status?feature=${featureCode}`
        : `/api/quota/status`;
      return fetchJson<QuotaStatusResponse>(url) as Promise<QuotaStatusResponse>;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const quotas = data?.quotas || [];
  const hasError = !!error;

  const getQuota = (code: QuotaFeatureCode): QuotaStatus | undefined => {
    if (hasError || !quotas.length) return undefined;
    return quotas.find(q => q.featureCode === code);
  };

  const isAtLimit = (code: QuotaFeatureCode): boolean => {
    const quota = getQuota(code);
    if (!quota) return false;
    return quota.remaining <= 0;
  };

  const isNearLimit = (code: QuotaFeatureCode, threshold = 80): boolean => {
    const quota = getQuota(code);
    if (!quota) return false;
    return quota.usagePercent >= threshold;
  };

  const getUsageDisplay = (code: QuotaFeatureCode): string => {
    const quota = getQuota(code);
    if (!quota) return '';
    return `${quota.usageCount} of ${quota.monthlyLimit} used`;
  };

  const hasQuotaData = quotas.length > 0 && !hasError;

  return {
    quotas,
    isLoading,
    error,
    hasError,
    hasQuotaData,
    refetch,
    getQuota,
    isAtLimit,
    isNearLimit,
    getUsageDisplay,
  };
}

export const QUOTA_FEATURE_DESCRIPTIONS: Record<QuotaFeatureCode, { name: string; description: string; limit: number }> = {
  ai_photo_recognition: {
    name: 'AI Photo Analysis',
    description: 'Scan food photos for nutritional information',
    limit: 50,
  },
  ai_workout_builder: {
    name: 'AI Workout Builder',
    description: 'Generate workout routines with AI',
    limit: 5,
  },
};
