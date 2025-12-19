import { supabaseAdmin } from './supabase-admin';
import type { 
  TrainerStorefront,
  InsertTrainerStorefront,
  UpdateTrainerStorefront,
  StorefrontService,
  InsertStorefrontService,
  UpdateStorefrontService,
  StorefrontTestimonial,
  InsertStorefrontTestimonial,
  UpdateStorefrontTestimonial,
  StorefrontTransformation,
  InsertStorefrontTransformation,
  UpdateStorefrontTransformation,
  StorefrontVariation
} from '@shared/supabase-types';

/**
 * Helper to get the profile photo path, with fallback to preset avatar URL.
 * If profile_photo_path is set, use it. Otherwise, look up the preset avatar's signed URL.
 */
async function resolveProfilePhotoPath(
  profilePhotoPath: string | null | undefined,
  presetAvatarId: string | null | undefined
): Promise<string | null> {
  if (profilePhotoPath) {
    return profilePhotoPath;
  }
  
  if (!presetAvatarId) {
    return null;
  }
  
  const { data: presetAvatar } = await supabaseAdmin
    .from('preset_avatars')
    .select('image_path')
    .eq('id', presetAvatarId)
    .maybeSingle();
    
  if (presetAvatar?.image_path) {
    const { data: signedData } = await supabaseAdmin.storage
      .from('preset-avatars')
      .createSignedUrl(presetAvatar.image_path, 3600);
    return signedData?.signedUrl || null;
  }
  
  return null;
}

/**
 * Batch resolve profile photo paths for multiple items.
 * Returns a Map from preset_avatar_id to signed URL.
 */
async function resolveProfilePhotoPathsBatch(
  presetAvatarIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(presetAvatarIds.filter(Boolean) as string[]));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data: presetAvatars } = await supabaseAdmin
    .from('preset_avatars')
    .select('id, image_path')
    .in('id', uniqueIds);

  if (!presetAvatars?.length) {
    return new Map();
  }

  const result = new Map<string, string>();
  for (const avatar of presetAvatars) {
    if (avatar.image_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('preset-avatars')
        .createSignedUrl(avatar.image_path, 3600);
      if (signedData?.signedUrl) {
        result.set(avatar.id, signedData.signedUrl);
      }
    }
  }
  return result;
}

const ACCENT_COLOR_SAFELIST = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899',
  '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#A855F7'
];

export interface StorefrontWithDetails extends TrainerStorefront {
  services: StorefrontService[];
  testimonials: StorefrontTestimonial[];
  transformations: StorefrontTransformation[];
  trainer_name: string | null;
  trainer_photo_path: string | null;
  trainer_preset_avatar_id: string | null;
}

export function validateAccentColor(color: string | null): boolean {
  if (!color) return true;
  return ACCENT_COLOR_SAFELIST.includes(color);
}

export async function getStorefrontByTrainerId(trainerId: string): Promise<StorefrontWithDetails | null> {
  const { data: storefront, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('*')
    .eq('trainer_id', trainerId)
    .single();

  if (error || !storefront) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('display_name, profile_photo_path, preset_avatar_id')
    .eq('id', trainerId)
    .single();

  const [servicesResult, testimonialsResult, transformationsResult] = await Promise.all([
    supabaseAdmin
      .from('storefront_services')
      .select('*')
      .eq('storefront_id', storefront.id)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_testimonials')
      .select('*')
      .eq('storefront_id', storefront.id)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_transformations')
      .select('*')
      .eq('storefront_id', storefront.id)
      .order('sort_order', { ascending: true }),
  ]);

  const resolvedPhotoPath = await resolveProfilePhotoPath(
    profile?.profile_photo_path,
    profile?.preset_avatar_id
  );

  return {
    ...storefront,
    services: servicesResult.data || [],
    testimonials: testimonialsResult.data || [],
    transformations: transformationsResult.data || [],
    trainer_name: profile?.display_name || null,
    trainer_photo_path: resolvedPhotoPath,
    trainer_preset_avatar_id: profile?.preset_avatar_id || null,
  };
}

export async function getStorefrontBySlug(slug: string, requesterId?: string): Promise<StorefrontWithDetails | null> {
  const { data: storefront, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !storefront) {
    return null;
  }

  if (!storefront.is_published && storefront.trainer_id !== requesterId) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('display_name, profile_photo_path, preset_avatar_id')
    .eq('id', storefront.trainer_id)
    .single();

  const [servicesResult, testimonialsResult, transformationsResult] = await Promise.all([
    supabaseAdmin
      .from('storefront_services')
      .select('*')
      .eq('storefront_id', storefront.id)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_testimonials')
      .select('*')
      .eq('storefront_id', storefront.id)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_transformations')
      .select('*')
      .eq('storefront_id', storefront.id)
      .order('sort_order', { ascending: true }),
  ]);

  const resolvedPhotoPath = await resolveProfilePhotoPath(
    profile?.profile_photo_path,
    profile?.preset_avatar_id
  );

  return {
    ...storefront,
    services: servicesResult.data || [],
    testimonials: testimonialsResult.data || [],
    transformations: transformationsResult.data || [],
    trainer_name: profile?.display_name || null,
    trainer_photo_path: resolvedPhotoPath,
    trainer_preset_avatar_id: profile?.preset_avatar_id || null,
  };
}

export async function createStorefront(trainerId: string, slug: string): Promise<TrainerStorefront | null> {
  const { data, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .insert({
      trainer_id: trainerId,
      slug,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating storefront:', error);
    return null;
  }

  return data;
}

export async function updateStorefront(
  trainerId: string, 
  updates: Partial<UpdateTrainerStorefront>
): Promise<TrainerStorefront | null> {
  if (updates.accent_color && !validateAccentColor(updates.accent_color)) {
    throw new Error('Invalid accent color');
  }

  const { data, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .update(updates)
    .eq('trainer_id', trainerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating storefront:', error);
    return null;
  }

  return data;
}

export async function checkSlugAvailability(slug: string, excludeTrainerId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('slug', slug);

  if (excludeTrainerId) {
    query = query.neq('trainer_id', excludeTrainerId);
  }

  const { data } = await query;
  return !data || data.length === 0;
}

export async function addService(
  storefrontId: string,
  service: Omit<InsertStorefrontService, 'storefront_id'>
): Promise<StorefrontService | null> {
  const { data, error } = await supabaseAdmin
    .from('storefront_services')
    .insert({
      ...service,
      storefront_id: storefrontId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding service:', error);
    return null;
  }

  return data;
}

export async function updateService(
  serviceId: string,
  trainerId: string,
  updates: Partial<UpdateStorefrontService>
): Promise<StorefrontService | null> {
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('trainer_id', trainerId)
    .single();

  if (!storefront) return null;

  const { data, error } = await supabaseAdmin
    .from('storefront_services')
    .update(updates)
    .eq('id', serviceId)
    .eq('storefront_id', storefront.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating service:', error);
    return null;
  }

  return data;
}

export async function deleteService(serviceId: string, trainerId: string): Promise<boolean> {
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('trainer_id', trainerId)
    .single();

  if (!storefront) return false;

  const { error } = await supabaseAdmin
    .from('storefront_services')
    .delete()
    .eq('id', serviceId)
    .eq('storefront_id', storefront.id);

  return !error;
}

export async function addTestimonial(
  storefrontId: string,
  testimonial: Omit<InsertStorefrontTestimonial, 'storefront_id'>
): Promise<StorefrontTestimonial | null> {
  const { data, error } = await supabaseAdmin
    .from('storefront_testimonials')
    .insert({
      ...testimonial,
      storefront_id: storefrontId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding testimonial:', error);
    return null;
  }

  return data;
}

export async function updateTestimonial(
  testimonialId: string,
  trainerId: string,
  updates: Partial<UpdateStorefrontTestimonial>
): Promise<StorefrontTestimonial | null> {
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('trainer_id', trainerId)
    .single();

  if (!storefront) return null;

  const { data, error } = await supabaseAdmin
    .from('storefront_testimonials')
    .update(updates)
    .eq('id', testimonialId)
    .eq('storefront_id', storefront.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating testimonial:', error);
    return null;
  }

  return data;
}

export async function deleteTestimonial(testimonialId: string, trainerId: string): Promise<boolean> {
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('trainer_id', trainerId)
    .single();

  if (!storefront) return false;

  const { error } = await supabaseAdmin
    .from('storefront_testimonials')
    .delete()
    .eq('id', testimonialId)
    .eq('storefront_id', storefront.id);

  return !error;
}

export async function addTransformation(
  storefrontId: string,
  transformation: Omit<InsertStorefrontTransformation, 'storefront_id'>
): Promise<StorefrontTransformation | null> {
  const { data, error } = await supabaseAdmin
    .from('storefront_transformations')
    .insert({
      ...transformation,
      storefront_id: storefrontId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding transformation:', error);
    return null;
  }

  return data;
}

export async function updateTransformation(
  transformationId: string,
  trainerId: string,
  updates: Partial<UpdateStorefrontTransformation>
): Promise<StorefrontTransformation | null> {
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('trainer_id', trainerId)
    .single();

  if (!storefront) return null;

  const { data, error } = await supabaseAdmin
    .from('storefront_transformations')
    .update(updates)
    .eq('id', transformationId)
    .eq('storefront_id', storefront.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating transformation:', error);
    return null;
  }

  return data;
}

export async function deleteTransformation(transformationId: string, trainerId: string): Promise<boolean> {
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('trainer_id', trainerId)
    .single();

  if (!storefront) return false;

  const { error } = await supabaseAdmin
    .from('storefront_transformations')
    .delete()
    .eq('id', transformationId)
    .eq('storefront_id', storefront.id);

  return !error;
}

export interface MarketplaceFilters {
  language?: string;
  professionType?: string;
  acceptingClients?: boolean;
  page?: number;
  limit?: number;
}

export interface MarketplaceResult {
  storefronts: StorefrontWithDetails[];
  total: number;
  page: number;
  limit: number;
}

export async function getMarketplaceStorefronts(filters: MarketplaceFilters): Promise<MarketplaceResult> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 50);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('trainer_storefronts')
    .select('*, profiles!inner(display_name, profile_photo_path, preset_avatar_id)', { count: 'exact' })
    .eq('is_published', true);

  if (filters.language) {
    query = query.contains('languages', [filters.language]);
  }

  if (filters.professionType) {
    query = query.contains('profession_types', [filters.professionType]);
  }

  if (filters.acceptingClients !== undefined) {
    query = query.eq('accepting_new_clients', filters.acceptingClients);
  }

  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .order('published_at', { ascending: false });

  if (error || !data) {
    return { storefronts: [], total: 0, page, limit };
  }

  const storefrontIds = data.map(s => s.id);

  const [servicesResult, testimonialsResult, transformationsResult] = await Promise.all([
    supabaseAdmin
      .from('storefront_services')
      .select('*')
      .in('storefront_id', storefrontIds)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_testimonials')
      .select('*')
      .in('storefront_id', storefrontIds)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_transformations')
      .select('*')
      .in('storefront_id', storefrontIds)
      .order('sort_order', { ascending: true }),
  ]);

  const servicesByStorefront = new Map<string, StorefrontService[]>();
  const testimonialsByStorefront = new Map<string, StorefrontTestimonial[]>();
  const transformationsByStorefront = new Map<string, StorefrontTransformation[]>();

  for (const s of servicesResult.data || []) {
    const list = servicesByStorefront.get(s.storefront_id) || [];
    list.push(s);
    servicesByStorefront.set(s.storefront_id, list);
  }

  for (const t of testimonialsResult.data || []) {
    const list = testimonialsByStorefront.get(t.storefront_id) || [];
    list.push(t);
    testimonialsByStorefront.set(t.storefront_id, list);
  }

  for (const tf of transformationsResult.data || []) {
    const list = transformationsByStorefront.get(tf.storefront_id) || [];
    list.push(tf);
    transformationsByStorefront.set(tf.storefront_id, list);
  }

  const presetAvatarIds = data
    .filter((s: any) => !s.profiles?.profile_photo_path && s.profiles?.preset_avatar_id)
    .map((s: any) => s.profiles.preset_avatar_id);
  const resolvedAvatars = await resolveProfilePhotoPathsBatch(presetAvatarIds);

  const storefronts: StorefrontWithDetails[] = data.map((s: any) => {
    const photoPath = s.profiles?.profile_photo_path || 
      (s.profiles?.preset_avatar_id ? resolvedAvatars.get(s.profiles.preset_avatar_id) : null) || 
      null;
    return {
      ...s,
      services: servicesByStorefront.get(s.id) || [],
      testimonials: testimonialsByStorefront.get(s.id) || [],
      transformations: transformationsByStorefront.get(s.id) || [],
      trainer_name: s.profiles?.display_name || null,
      trainer_photo_path: photoPath,
      trainer_preset_avatar_id: s.profiles?.preset_avatar_id || null,
    };
  });

  return {
    storefronts,
    total: count || 0,
    page,
    limit,
  };
}

export async function getClientConnectedTrainers(clientId: string): Promise<StorefrontWithDetails[]> {
  const { data: relationships } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('professional_id')
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (!relationships || relationships.length === 0) {
    return [];
  }

  // Note: professional_client_relationships.professional_id stores profiles.id (user_id)
  // which matches trainer_storefronts.trainer_id
  const professionalUserIds = relationships.map(r => r.professional_id);

  const { data: storefronts } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('*, profiles!inner(display_name, profile_photo_path, preset_avatar_id)')
    .in('trainer_id', professionalUserIds);

  if (!storefronts || storefronts.length === 0) {
    return [];
  }

  const storefrontIds = storefronts.map(s => s.id);

  const [servicesResult, testimonialsResult, transformationsResult] = await Promise.all([
    supabaseAdmin
      .from('storefront_services')
      .select('*')
      .in('storefront_id', storefrontIds)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_testimonials')
      .select('*')
      .in('storefront_id', storefrontIds)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('storefront_transformations')
      .select('*')
      .in('storefront_id', storefrontIds)
      .order('sort_order', { ascending: true }),
  ]);

  const servicesByStorefront = new Map<string, StorefrontService[]>();
  const testimonialsByStorefront = new Map<string, StorefrontTestimonial[]>();
  const transformationsByStorefront = new Map<string, StorefrontTransformation[]>();

  for (const s of servicesResult.data || []) {
    const list = servicesByStorefront.get(s.storefront_id) || [];
    list.push(s);
    servicesByStorefront.set(s.storefront_id, list);
  }

  for (const t of testimonialsResult.data || []) {
    const list = testimonialsByStorefront.get(t.storefront_id) || [];
    list.push(t);
    testimonialsByStorefront.set(t.storefront_id, list);
  }

  for (const tf of transformationsResult.data || []) {
    const list = transformationsByStorefront.get(tf.storefront_id) || [];
    list.push(tf);
    transformationsByStorefront.set(tf.storefront_id, list);
  }

  const presetAvatarIds = storefronts
    .filter((s: any) => !s.profiles?.profile_photo_path && s.profiles?.preset_avatar_id)
    .map((s: any) => s.profiles.preset_avatar_id);
  const resolvedAvatars = await resolveProfilePhotoPathsBatch(presetAvatarIds);

  return storefronts.map((s: any) => {
    const photoPath = s.profiles?.profile_photo_path || 
      (s.profiles?.preset_avatar_id ? resolvedAvatars.get(s.profiles.preset_avatar_id) : null) || 
      null;
    return {
      ...s,
      services: servicesByStorefront.get(s.id) || [],
      testimonials: testimonialsByStorefront.get(s.id) || [],
      transformations: transformationsByStorefront.get(s.id) || [],
      trainer_name: s.profiles?.display_name || null,
      trainer_photo_path: photoPath,
      trainer_preset_avatar_id: s.profiles?.preset_avatar_id || null,
    };
  });
}

export { ACCENT_COLOR_SAFELIST };

// ============================================================================
// PROFESSIONAL DETAIL (In-App View with Products)
// ============================================================================

export interface ProfessionalDetailProduct {
  id: string;
  name: string;
  description: string | null;
  productType: string;
  mediaUrls: string[] | null;
  featuresIncluded: string[] | null;
  pricing: {
    id: string;
    amountCents: number;
    currency: string;
    billingInterval: string | null;
    intervalCount: number | null;
    isPrimary: boolean;
  }[];
}

export interface ProfessionalDetail {
  proId: string;
  displayName: string | null;
  photoPath: string | null;
  presetAvatarId: string | null;
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
  products: ProfessionalDetailProduct[];
  testimonials: StorefrontTestimonial[];
  transformations: StorefrontTransformation[];
}

export async function getProfessionalDetail(
  proId: string, 
  requesterId: string
): Promise<ProfessionalDetail | null> {
  // Get storefront data
  const { data: storefront, error: sfError } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('*')
    .eq('trainer_id', proId)
    .single();

  if (sfError && sfError.code !== 'PGRST116') {
    console.error('Error fetching storefront:', sfError);
    return null;
  }

  // Get profile data
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('display_name, profile_photo_path, preset_avatar_id')
    .eq('id', proId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Check connection status between requester and professional
  // Note: professional_client_relationships.professional_id has mixed usage:
  // - Some records store profiles.id (user_id)
  // - Some records store professional_profiles.id
  // We check both for backwards compatibility
  const { data: proProfile } = await supabaseAdmin
    .from('professional_profiles')
    .select('id')
    .eq('user_id', proId)
    .single();

  // Build candidate IDs to check (user_id and optionally professional_profiles.id)
  const candidateIds = [proId];
  if (proProfile?.id) {
    candidateIds.push(proProfile.id);
  }

  let isConnected = false;
  const { data: relationship } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .in('professional_id', candidateIds)
    .eq('client_id', requesterId)
    .eq('status', 'active')
    .limit(1)
    .single();
  
  isConnected = !!relationship;

  // Get active client count for this professional
  const { count: activeClientsCount } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id', { count: 'exact', head: true })
    .in('professional_id', candidateIds)
    .eq('status', 'active');

  // Access control: unpublished storefronts only visible to connected clients
  const isPublished = storefront?.is_published ?? false;
  if (!isPublished && !isConnected) {
    return null;
  }

  // Get products with pricing (only approved, active products)
  const { data: products } = await supabaseAdmin
    .from('trainer_products')
    .select('id, name, description, product_type, media_urls, features_included')
    .eq('trainer_id', proId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const productIds = (products || []).map(p => p.id);
  
  let pricingByProduct: Record<string, ProfessionalDetailProduct['pricing']> = {};
  if (productIds.length > 0) {
    const { data: allPricing } = await supabaseAdmin
      .from('product_pricing')
      .select('id, product_id, amount_cents, currency, billing_interval, interval_count, is_primary')
      .in('product_id', productIds)
      .eq('is_active', true);

    for (const p of allPricing || []) {
      if (!pricingByProduct[p.product_id]) {
        pricingByProduct[p.product_id] = [];
      }
      pricingByProduct[p.product_id].push({
        id: p.id,
        amountCents: p.amount_cents,
        currency: p.currency,
        billingInterval: p.billing_interval,
        intervalCount: p.interval_count,
        isPrimary: p.is_primary,
      });
    }
  }

  // Get testimonials and transformations
  let testimonials: StorefrontTestimonial[] = [];
  let transformations: StorefrontTransformation[] = [];
  
  if (storefront) {
    const [testimonialsResult, transformationsResult] = await Promise.all([
      supabaseAdmin
        .from('storefront_testimonials')
        .select('*')
        .eq('storefront_id', storefront.id)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('storefront_transformations')
        .select('*')
        .eq('storefront_id', storefront.id)
        .order('sort_order', { ascending: true }),
    ]);
    testimonials = testimonialsResult.data || [];
    transformations = transformationsResult.data || [];
  }

  const resolvedPhotoPath = await resolveProfilePhotoPath(
    profile.profile_photo_path,
    profile.preset_avatar_id
  );

  return {
    proId,
    displayName: profile.display_name,
    photoPath: resolvedPhotoPath,
    presetAvatarId: profile.preset_avatar_id,
    headline: storefront?.headline || null,
    bio: storefront?.bio || null,
    professionTypes: storefront?.profession_types || [],
    specialties: storefront?.specialties || [],
    credentials: storefront?.credentials || [],
    experienceYears: storefront?.experience_years || null,
    timezone: storefront?.timezone || null,
    languages: storefront?.languages || [],
    accentColor: storefront?.accent_color || null,
    bookingUrl: storefront?.booking_url || null,
    socialLinks: storefront?.social_links || null,
    isPublished,
    isConnected,
    businessName: storefront?.business_name || null,
    acceptingNewClients: storefront?.accepting_new_clients ?? false,
    activeClientsCount: activeClientsCount || 0,
    locationCity: (storefront as any)?.location_city || null,
    locationState: (storefront as any)?.location_state || null,
    locationCountry: (storefront as any)?.location_country || null,
    products: (products || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      productType: p.product_type,
      mediaUrls: p.media_urls,
      featuresIncluded: p.features_included,
      pricing: pricingByProduct[p.id] || [],
    })),
    testimonials,
    transformations,
  };
}
