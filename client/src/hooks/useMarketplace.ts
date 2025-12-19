import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { 
  StorefrontService, 
  StorefrontTestimonial, 
  StorefrontTransformation 
} from "@shared/supabase-types";

export interface MarketplaceStorefront {
  id: string;
  trainer_id: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  cover_image_url: string | null;
  specialties: string[];
  credentials: string[];
  experience_years: number | null;
  is_published: boolean;
  published_at: string | null;
  business_name: string | null;
  accent_color: string | null;
  waitlist_enabled: boolean;
  accepting_new_clients: boolean;
  profession_types: string[];
  timezone: string | null;
  languages: string[];
  services: StorefrontService[];
  testimonials: StorefrontTestimonial[];
  transformations: StorefrontTransformation[];
  trainer_name: string | null;
  trainer_photo_path: string | null;
}

export interface MarketplaceResult {
  storefronts: MarketplaceStorefront[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketplaceFilters {
  language?: string;
  professionType?: string;
  acceptingClients?: boolean;
  page?: number;
  limit?: number;
}

export const MARKETPLACE_DISCOVER_KEY = '/api/marketplace/discover';
export const MARKETPLACE_MINE_KEY = '/api/marketplace/mine';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

export function useDiscoverTrainers(filters: MarketplaceFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.language) queryParams.set('language', filters.language);
  if (filters.professionType) queryParams.set('professionType', filters.professionType);
  if (filters.acceptingClients !== undefined) {
    queryParams.set('acceptingClients', String(filters.acceptingClients));
  }
  if (filters.page) queryParams.set('page', String(filters.page));
  if (filters.limit) queryParams.set('limit', String(filters.limit));

  const queryString = queryParams.toString();
  const url = queryString ? `${MARKETPLACE_DISCOVER_KEY}?${queryString}` : MARKETPLACE_DISCOVER_KEY;

  return useQuery<MarketplaceResult>({
    queryKey: [MARKETPLACE_DISCOVER_KEY, filters],
    queryFn: async () => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch trainers');
      }
      return response.json();
    },
    staleTime: 60000,
  });
}

export function useMyTrainers(enabled: boolean = true) {
  return useQuery<MarketplaceStorefront[]>({
    queryKey: [MARKETPLACE_MINE_KEY],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(MARKETPLACE_MINE_KEY, {
        credentials: 'include',
        headers
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error('Failed to fetch connected trainers');
      }
      return response.json();
    },
    enabled,
    staleTime: 60000,
    retry: false,
  });
}

export const PROFESSION_TYPES = [
  { value: 'trainer', label: 'Personal Trainer' },
  { value: 'nutritionist', label: 'Nutritionist' },
  { value: 'yoga', label: 'Yoga Instructor' },
  { value: 'wellness', label: 'Wellness Coach' },
  { value: 'physio', label: 'Physiotherapist' },
];

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
];

// ============================================================================
// PROFESSIONAL DETAIL (In-App View)
// ============================================================================

export const MARKETPLACE_PRO_KEY = '/api/marketplace/pro';

export interface ProfessionalProductPricing {
  id: string;
  amountCents: number;
  currency: string;
  billingInterval: string | null;
  intervalCount: number | null;
  isPrimary: boolean;
}

export interface ProfessionalProduct {
  id: string;
  name: string;
  description: string | null;
  productType: string;
  mediaUrls: string[] | null;
  featuresIncluded: string[] | null;
  pricing: ProfessionalProductPricing[];
}

export interface ProfessionalDetail {
  proId: string;
  displayName: string | null;
  photoPath: string | null;
  headline: string | null;
  bio: string | null;
  professionTypes: string[];
  specialties: string[];
  credentials: string[];
  experienceYears: number | null;
  timezone: string | null;
  languages: string[];
  accentColor: string | null;
  bookingUrl: string | null;
  socialLinks: Record<string, string> | null;
  isPublished: boolean;
  isConnected: boolean;
  businessName: string | null;
  acceptingNewClients: boolean;
  activeClientsCount: number;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  products: ProfessionalProduct[];
  testimonials: StorefrontTestimonial[];
  transformations: StorefrontTransformation[];
}

export function useProfessionalDetail(proId: string | undefined) {
  return useQuery<ProfessionalDetail>({
    queryKey: [MARKETPLACE_PRO_KEY, proId],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${MARKETPLACE_PRO_KEY}/${proId}`, {
        credentials: 'include',
        headers
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Professional not found');
        }
        throw new Error('Failed to fetch professional details');
      }
      return response.json();
    },
    enabled: !!proId,
    staleTime: 60000,
  });
}

export function getProfessionLabel(value: string): string {
  const profession = PROFESSION_TYPES.find(p => p.value === value);
  return profession?.label || value;
}
