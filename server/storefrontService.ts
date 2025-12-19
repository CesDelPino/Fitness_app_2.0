/**
 * Storefront Service
 * Handles CRUD operations for trainer storefronts
 */

import { supabaseAdmin } from "./supabase-admin";
import type { 
  TrainerStorefront, 
  InsertTrainerStorefront, 
  UpdateTrainerStorefront,
  StorefrontWithProducts,
  TrainerProduct,
  ProductPricing
} from "@shared/schema";

function mapStorefrontFromDb(row: any): TrainerStorefront {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    slug: row.slug,
    headline: row.headline,
    bio: row.bio,
    coverImageUrl: row.cover_image_url,
    specialties: row.specialties || [],
    credentials: row.credentials || [],
    experienceYears: row.experience_years,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStorefrontWithProductsFromDb(row: any): StorefrontWithProducts {
  return {
    ...mapStorefrontFromDb(row),
    trainerName: row.trainer_name,
    trainerPhotoPath: row.trainer_photo_path,
    trainerPresetAvatarId: row.trainer_preset_avatar_id,
    trainerRole: row.trainer_role,
    approvedProductsCount: parseInt(row.approved_products_count) || 0,
  };
}

export async function getStorefrontByTrainerId(trainerId: string): Promise<TrainerStorefront | null> {
  const { data, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('*')
    .eq('trainer_id', trainerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching storefront:', error);
    throw error;
  }

  return data ? mapStorefrontFromDb(data) : null;
}

export async function getStorefrontBySlug(slug: string): Promise<StorefrontWithProducts | null> {
  const { data, error } = await supabaseAdmin
    .from('storefront_with_products')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching storefront by slug:', error);
    throw error;
  }

  return data ? mapStorefrontWithProductsFromDb(data) : null;
}

export async function getPublishedStorefronts(): Promise<StorefrontWithProducts[]> {
  const { data, error } = await supabaseAdmin
    .from('storefront_with_products')
    .select('*')
    .eq('is_published', true)
    .order('approved_products_count', { ascending: false });

  if (error) {
    console.error('Error fetching published storefronts:', error);
    throw error;
  }

  return (data || []).map(mapStorefrontWithProductsFromDb);
}

export async function createStorefront(
  trainerId: string, 
  displayName: string
): Promise<TrainerStorefront> {
  // Generate slug from display name
  const { data: slugData, error: slugError } = await supabaseAdmin
    .rpc('generate_storefront_slug', { display_name: displayName });

  if (slugError) {
    console.error('Error generating slug:', slugError);
    throw slugError;
  }

  const slug = slugData as string;

  const { data, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .insert({
      trainer_id: trainerId,
      slug,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating storefront:', error);
    throw error;
  }

  return mapStorefrontFromDb(data);
}

export async function updateStorefront(
  trainerId: string, 
  updates: UpdateTrainerStorefront
): Promise<TrainerStorefront> {
  const updateData: any = {};
  
  if (updates.slug !== undefined) updateData.slug = updates.slug;
  if (updates.headline !== undefined) updateData.headline = updates.headline;
  if (updates.bio !== undefined) updateData.bio = updates.bio;
  if (updates.coverImageUrl !== undefined) updateData.cover_image_url = updates.coverImageUrl;
  if (updates.specialties !== undefined) updateData.specialties = updates.specialties;
  if (updates.credentials !== undefined) updateData.credentials = updates.credentials;
  if (updates.experienceYears !== undefined) updateData.experience_years = updates.experienceYears;
  if (updates.isPublished !== undefined) {
    updateData.is_published = updates.isPublished;
    if (updates.isPublished) {
      updateData.published_at = new Date().toISOString();
    }
  }
  if (updates.locationCity !== undefined) updateData.location_city = updates.locationCity;
  if (updates.locationState !== undefined) updateData.location_state = updates.locationState;
  if (updates.locationCountry !== undefined) updateData.location_country = updates.locationCountry;

  const { data, error } = await supabaseAdmin
    .from('trainer_storefronts')
    .update(updateData)
    .eq('trainer_id', trainerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating storefront:', error);
    throw error;
  }

  return mapStorefrontFromDb(data);
}

export async function checkSlugAvailability(slug: string, excludeTrainerId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from('trainer_storefronts')
    .select('id')
    .eq('slug', slug);

  if (excludeTrainerId) {
    query = query.neq('trainer_id', excludeTrainerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking slug availability:', error);
    throw error;
  }

  return !data || data.length === 0;
}

export async function getStorefrontProducts(
  trainerId: string
): Promise<{ product: TrainerProduct; pricing: ProductPricing[] }[]> {
  // Get approved products with active pricing
  const { data: products, error: productsError } = await supabaseAdmin
    .from('trainer_products')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (productsError) {
    console.error('Error fetching storefront products:', productsError);
    throw productsError;
  }

  if (!products || products.length === 0) {
    return [];
  }

  // Get active pricing for all products
  const productIds = products.map((p: any) => p.id);
  const { data: pricing, error: pricingError } = await supabaseAdmin
    .from('product_pricing')
    .select('*')
    .in('product_id', productIds)
    .eq('is_active', true);

  if (pricingError) {
    console.error('Error fetching product pricing:', pricingError);
    throw pricingError;
  }

  // Map and combine
  return products
    .filter((product: any) => {
      const productPricing = (pricing || []).filter((p: any) => p.product_id === product.id);
      return productPricing.length > 0; // Only include products with active pricing
    })
    .map((product: any) => ({
      product: {
        id: product.id,
        trainerId: product.trainer_id,
        stripeProductId: product.stripe_product_id,
        name: product.name,
        description: product.description,
        productType: product.product_type,
        status: product.status,
        rejectionReason: product.rejection_reason,
        mediaUrls: product.media_urls || [],
        featuresIncluded: product.features_included || [],
        publishAt: product.publish_at,
        submittedAt: product.submitted_at,
        approvedAt: product.approved_at,
        approvedBy: product.approved_by,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
      pricing: (pricing || [])
        .filter((p: any) => p.product_id === product.id)
        .map((p: any) => ({
          id: p.id,
          productId: p.product_id,
          stripePriceId: p.stripe_price_id,
          amountCents: p.amount_cents,
          currency: p.currency,
          billingInterval: p.billing_interval,
          intervalCount: p.interval_count,
          isPrimary: p.is_primary,
          isActive: p.is_active,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
    }));
}

export async function ensureStorefrontExists(trainerId: string, displayName: string): Promise<TrainerStorefront> {
  const existing = await getStorefrontByTrainerId(trainerId);
  if (existing) {
    return existing;
  }
  return createStorefront(trainerId, displayName);
}
