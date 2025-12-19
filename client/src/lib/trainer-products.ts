import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";
import type { TrainerProduct, ProductPricing } from "@shared/schema";

export interface ProductWithPricing extends TrainerProduct {
  pricing: ProductPricing[];
}

export function useTrainerProducts(includeArchived: boolean = false) {
  return useQuery<ProductWithPricing[]>({
    queryKey: ['/api/trainer/products', { includeArchived }],
    queryFn: async () => {
      const url = `/api/trainer/products${includeArchived ? '?includeArchived=true' : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });
}

export function useTrainerSales() {
  return useQuery({
    queryKey: ['/api/trainer/sales'],
    queryFn: async () => {
      const response = await fetch('/api/trainer/sales', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch sales');
      return response.json();
    },
  });
}

export function useCreateProduct() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      productType: 'one_time' | 'subscription' | 'package' | 'free';
      amountCents: number;
      currency?: string;
      billingInterval?: 'day' | 'week' | 'month' | 'year' | null;
      intervalCount?: number | null;
      featuresIncluded?: string[];
    }) => {
      return apiRequest('POST', '/api/trainer/products', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/products'] });
    },
  });
}

export function useUpdateProduct() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TrainerProduct>) => {
      return apiRequest('PATCH', `/api/trainer/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/products'] });
    },
  });
}

export function useSubmitProduct() {
  return useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest('POST', `/api/trainer/products/${productId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/products'] });
    },
  });
}

export function useArchiveProduct() {
  return useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest('POST', `/api/trainer/products/${productId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/products'] });
    },
  });
}

export function useAddPricing() {
  return useMutation({
    mutationFn: async ({ productId, ...data }: {
      productId: string;
      amountCents: number;
      currency?: string;
      billingInterval?: 'day' | 'week' | 'month' | 'year' | null;
      intervalCount?: number | null;
      isPrimary?: boolean;
    }) => {
      return apiRequest('POST', `/api/trainer/products/${productId}/pricing`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/products'] });
    },
  });
}

export const productStatusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const productStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export const productTypeLabels: Record<string, string> = {
  one_time: 'One-Time Purchase',
  subscription: 'Subscription',
  package: 'Package',
  free: 'Free',
};

export function formatPrice(amountCents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function formatBillingInterval(interval: string | null, count: number | null): string {
  if (!interval) return 'One-time';
  const countStr = count && count > 1 ? `${count} ` : '';
  const pluralize = count && count > 1;
  switch (interval) {
    case 'day': return `Every ${countStr}day${pluralize ? 's' : ''}`;
    case 'week': return `Every ${countStr}week${pluralize ? 's' : ''}`;
    case 'month': return `Every ${countStr}month${pluralize ? 's' : ''}`;
    case 'year': return `Every ${countStr}year${pluralize ? 's' : ''}`;
    default: return interval;
  }
}
