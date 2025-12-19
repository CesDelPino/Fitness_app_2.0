import { supabaseAdmin } from './supabase-admin';
import type { 
  FoodSource, 
  FoodVerificationStatus 
} from '@shared/supabase-types';

export interface Food {
  id: string;
  canonical_name: string;
  brand: string | null;
  source: FoodSource;
  verification_status: FoodVerificationStatus;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  sugar_per_100g: number | null;
  default_serving_size: string | null;
  default_serving_grams: number | null;
  calories_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface FoodBarcode {
  id: string;
  food_id: string;
  barcode: string;
  created_at: string;
}

export interface FoodAlias {
  id: string;
  food_id: string;
  alias_text: string;
  normalized_text: string;
  created_at: string;
}

export interface CardioActivity {
  id: string;
  name: string;
  base_met: number;
  category: string;
  created_at: string;
}

export interface UserCustomActivity {
  id: string;
  user_id: string;
  activity_name: string;
  estimated_met: number;
  created_at: string;
}

export interface InsertFood {
  canonical_name: string;
  brand?: string | null;
  source: FoodSource;
  verification_status?: FoodVerificationStatus;
  calories_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  default_serving_size?: string | null;
  default_serving_grams?: number | null;
  calories_per_serving?: number | null;
  protein_per_serving?: number | null;
  carbs_per_serving?: number | null;
  fat_per_serving?: number | null;
}

// Helper to fetch barcodes and aliases for a list of food IDs
async function fetchBarcodesAndAliases(foodIds: string[]): Promise<{
  barcodesByFoodId: Map<string, string[]>;
  aliasesByFoodId: Map<string, string[]>;
}> {
  if (foodIds.length === 0) {
    return { barcodesByFoodId: new Map(), aliasesByFoodId: new Map() };
  }

  // Batch fetch barcodes and aliases to avoid N+1 queries
  const [barcodesResult, aliasesResult] = await Promise.all([
    supabaseAdmin
      .from('food_barcodes')
      .select('food_id, barcode')
      .in('food_id', foodIds),
    supabaseAdmin
      .from('food_aliases')
      .select('food_id, alias_text')
      .in('food_id', foodIds),
  ]);

  const barcodesByFoodId = new Map<string, string[]>();
  const aliasesByFoodId = new Map<string, string[]>();

  if (barcodesResult.data) {
    for (const b of barcodesResult.data) {
      if (!barcodesByFoodId.has(b.food_id)) {
        barcodesByFoodId.set(b.food_id, []);
      }
      barcodesByFoodId.get(b.food_id)!.push(b.barcode);
    }
  }

  if (aliasesResult.data) {
    for (const a of aliasesResult.data) {
      if (!aliasesByFoodId.has(a.food_id)) {
        aliasesByFoodId.set(a.food_id, []);
      }
      aliasesByFoodId.get(a.food_id)!.push(a.alias_text);
    }
  }

  return { barcodesByFoodId, aliasesByFoodId };
}

export async function searchFoods(query: string, limit: number = 20): Promise<(Food & { barcodes?: string[]; aliases?: string[] })[]> {
  const { data: foods, error } = await supabaseAdmin
    .from('foods')
    .select('*')
    .or(`canonical_name.ilike.%${query}%,brand.ilike.%${query}%`)
    .order('times_used', { ascending: false })
    .order('canonical_name', { ascending: true })
    .limit(limit);

  if (error || !foods) {
    console.error('Search foods error:', error);
    return [];
  }

  const foodIds = foods.map(f => f.id);
  const { barcodesByFoodId, aliasesByFoodId } = await fetchBarcodesAndAliases(foodIds);

  return foods.map(food => ({
    ...food,
    barcodes: barcodesByFoodId.get(food.id) || [],
    aliases: aliasesByFoodId.get(food.id) || [],
  }));
}

export async function getFoodByBarcode(barcode: string): Promise<(Food & { barcodes?: string[]; aliases?: string[] }) | null> {
  const { data: barcodeEntry, error: barcodeError } = await supabaseAdmin
    .from('food_barcodes')
    .select('food_id')
    .eq('barcode', barcode)
    .single();

  if (barcodeError || !barcodeEntry) {
    return null;
  }

  const { data: food, error: foodError } = await supabaseAdmin
    .from('foods')
    .select('*')
    .eq('id', barcodeEntry.food_id)
    .single();

  if (foodError || !food) {
    return null;
  }

  // Use batch helper for single food
  const { barcodesByFoodId, aliasesByFoodId } = await fetchBarcodesAndAliases([food.id]);

  return {
    ...food,
    barcodes: barcodesByFoodId.get(food.id) || [],
    aliases: aliasesByFoodId.get(food.id) || [],
  };
}

export async function getFoodById(id: string): Promise<Food | null> {
  const { data: food, error } = await supabaseAdmin
    .from('foods')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !food) {
    return null;
  }

  return food;
}

export async function createFood(data: InsertFood): Promise<Food | null> {
  const now = new Date().toISOString();
  const { data: food, error } = await supabaseAdmin
    .from('foods')
    .insert({
      ...data,
      verification_status: data.verification_status || 'pending',
      times_used: 0,
      created_at: now,
      updated_at: now, // Ensure updated_at is set on insert for proper API response
    })
    .select()
    .single();

  if (error) {
    console.error('Create food error:', error);
    return null;
  }

  return food;
}

export async function addFoodBarcode(foodId: string, barcode: string): Promise<FoodBarcode | null> {
  const { data, error } = await supabaseAdmin
    .from('food_barcodes')
    .insert({ food_id: foodId, barcode })
    .select()
    .single();

  if (error) {
    console.error('Add food barcode error:', error);
    return null;
  }

  return data;
}

export async function addFoodAlias(foodId: string, aliasText: string): Promise<FoodAlias | null> {
  const normalizedText = aliasText.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('food_aliases')
    .insert({ food_id: foodId, alias_text: aliasText, normalized_text: normalizedText })
    .select()
    .single();

  if (error) {
    console.error('Add food alias error:', error);
    return null;
  }

  return data;
}

export async function incrementFoodUsage(foodId: string): Promise<void> {
  const { data: food } = await supabaseAdmin
    .from('foods')
    .select('times_used')
    .eq('id', foodId)
    .single();

  if (food) {
    await supabaseAdmin
      .from('foods')
      .update({ 
        times_used: (food.times_used || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', foodId);
  }
}

export async function getRecentFoods(limit: number = 10): Promise<(Food & { barcodes?: string[]; aliases?: string[] })[]> {
  const { data: foods, error } = await supabaseAdmin
    .from('foods')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !foods) {
    console.error('Get recent foods error:', error);
    return [];
  }

  // Use batch helper to avoid N+1 queries
  const foodIds = foods.map(f => f.id);
  const { barcodesByFoodId, aliasesByFoodId } = await fetchBarcodesAndAliases(foodIds);

  return foods.map(food => ({
    ...food,
    barcodes: barcodesByFoodId.get(food.id) || [],
    aliases: aliasesByFoodId.get(food.id) || [],
  }));
}

export async function getPopularFoods(limit: number = 20): Promise<(Food & { barcodes?: string[]; aliases?: string[] })[]> {
  const { data: foods, error } = await supabaseAdmin
    .from('foods')
    .select('*')
    .order('times_used', { ascending: false })
    .order('canonical_name', { ascending: true })
    .limit(limit);

  if (error || !foods) {
    console.error('Get popular foods error:', error);
    return [];
  }

  // Use batch helper to avoid N+1 queries
  const foodIds = foods.map(f => f.id);
  const { barcodesByFoodId, aliasesByFoodId } = await fetchBarcodesAndAliases(foodIds);

  return foods.map(food => ({
    ...food,
    barcodes: barcodesByFoodId.get(food.id) || [],
    aliases: aliasesByFoodId.get(food.id) || [],
  }));
}

export async function getCardioActivityByName(name: string): Promise<CardioActivity | null> {
  const { data, error } = await supabaseAdmin
    .from('cardio_activities')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function getUserCustomActivity(userId: string, activityName: string): Promise<UserCustomActivity | null> {
  const { data, error } = await supabaseAdmin
    .from('user_custom_activities')
    .select('*')
    .eq('user_id', userId)
    .ilike('activity_name', activityName)
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function createUserCustomActivity(data: {
  userId: string;
  activityName: string;
  estimatedMET: number;
}): Promise<UserCustomActivity | null> {
  const { data: activity, error } = await supabaseAdmin
    .from('user_custom_activities')
    .insert({
      user_id: data.userId,
      activity_name: data.activityName,
      estimated_met: data.estimatedMET,
    })
    .select()
    .single();

  if (error) {
    console.error('Create user custom activity error:', error);
    return null;
  }

  return activity;
}
