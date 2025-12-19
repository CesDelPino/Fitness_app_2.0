import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { 
  StorefrontService, 
  StorefrontTestimonial, 
  StorefrontTransformation 
} from "@shared/supabase-types";

export interface StorefrontWithDetails {
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
  created_at: string;
  updated_at: string;
  business_name: string | null;
  intro_video_url: string | null;
  video_thumbnail_url: string | null;
  accent_color: string | null;
  social_links: Record<string, string> | null;
  waitlist_enabled: boolean;
  accepting_new_clients: boolean;
  booking_url: string | null;
  profession_types: string[];
  timezone: string | null;
  languages: string[];
  has_premium_slug: boolean;
  slug_purchased_at: string | null;
  storefront_variation: string;
  services: StorefrontService[];
  testimonials: StorefrontTestimonial[];
  transformations: StorefrontTransformation[];
  trainer_name: string | null;
  trainer_photo_path: string | null;
  trainer_preset_avatar_id: string | null;
}

export const STOREFRONT_QUERY_KEY = ['/api/pro/storefront'];

export const ACCENT_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899',
  '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#A855F7'
];

export const STOREFRONT_VARIATIONS = [
  { value: 'classic', label: 'Classic', description: 'Balanced, professional layout' },
  { value: 'bold', label: 'Bold', description: 'Full-width hero, visual impact' },
  { value: 'services-first', label: 'Services First', description: 'Emphasize your offerings' },
  { value: 'story-driven', label: 'Story Driven', description: 'Lead with testimonials & video' },
];

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

export function useStorefront() {
  return useQuery<StorefrontWithDetails>({
    queryKey: STOREFRONT_QUERY_KEY,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pro/storefront', {
        credentials: 'include',
        headers
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch storefront');
      }
      return response.json();
    },
  });
}

export function useStorefrontMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (updates: Partial<StorefrontWithDetails>) => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pro/storefront', {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error('This URL is already taken');
        }
        throw new Error(error.error || 'Failed to update storefront');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Changes saved" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useSlugAvailability() {
  return useMutation({
    mutationFn: async (slug: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/slug-availability?slug=${encodeURIComponent(slug)}`, {
        credentials: 'include',
        headers
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check slug');
      }
      return response.json() as Promise<{ available: boolean; slug: string }>;
    },
  });
}

export function useSystemFeature(featureCode: string) {
  return useQuery<{ feature: string; isActive: boolean }>({
    queryKey: ['/api/features/system', featureCode],
    queryFn: async () => {
      const response = await fetch(`/api/features/system/${featureCode}`);
      if (!response.ok) {
        // Default to feature being active on error to avoid blocking users
        return { feature: featureCode, isActive: true };
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useServiceMutations() {
  const { toast } = useToast();

  const createService = useMutation({
    mutationFn: async (data: Partial<StorefrontService>) => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pro/storefront/services', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Service added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add service", variant: "destructive" });
    },
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...data }: Partial<StorefrontService> & { id: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/services/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Service updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update service", variant: "destructive" });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/services/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to delete service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Service deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" });
    },
  });

  return { createService, updateService, deleteService };
}

export function useTestimonialMutations() {
  const { toast } = useToast();

  const createTestimonial = useMutation({
    mutationFn: async (data: Partial<StorefrontTestimonial>) => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pro/storefront/testimonials', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create testimonial');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Testimonial added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add testimonial", variant: "destructive" });
    },
  });

  const updateTestimonial = useMutation({
    mutationFn: async ({ id, ...data }: Partial<StorefrontTestimonial> & { id: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/testimonials/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update testimonial');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Testimonial updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update testimonial", variant: "destructive" });
    },
  });

  const deleteTestimonial = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/testimonials/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to delete testimonial');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Testimonial deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete testimonial", variant: "destructive" });
    },
  });

  return { createTestimonial, updateTestimonial, deleteTestimonial };
}

export function useTransformationMutations() {
  const { toast } = useToast();

  const createTransformation = useMutation({
    mutationFn: async (data: Partial<StorefrontTransformation>) => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pro/storefront/transformations', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create transformation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Transformation added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add transformation", variant: "destructive" });
    },
  });

  const updateTransformation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<StorefrontTransformation> & { id: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/transformations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update transformation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Transformation updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update transformation", variant: "destructive" });
    },
  });

  const deleteTransformation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/pro/storefront/transformations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to delete transformation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOREFRONT_QUERY_KEY });
      toast({ title: "Transformation deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete transformation", variant: "destructive" });
    },
  });

  return { createTransformation, updateTransformation, deleteTransformation };
}
