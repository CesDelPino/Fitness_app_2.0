import { supabaseAdmin } from './supabase-admin';
import type { NormalizedFood, NormalizedNutrient, CachedFoodItem, FDADataType } from './fda-types';
import { mapFDADataTypeToDb } from './fda-types';
import { isTrackedNutrient } from './fda-nutrient-map';

const CACHE_FRESHNESS_DAYS = 90;

export interface CacheResult {
  found: boolean;
  food: CachedFoodItem | null;
  isStale: boolean;
}

export async function getNutrientDefinitionIds(): Promise<Map<number, string>> {
  const { data, error } = await supabaseAdmin
    .from('nutrient_definitions')
    .select('id, fdc_nutrient_id');
  
  if (error) {
    console.error('[fda-cache] Error fetching nutrient definitions:', error);
    return new Map();
  }
  
  const map = new Map<number, string>();
  for (const row of data || []) {
    map.set(row.fdc_nutrient_id, row.id);
  }
  return map;
}

export async function getCachedFoodByFdcId(fdcId: number): Promise<CacheResult> {
  const { data: foodItem, error } = await supabaseAdmin
    .from('food_items')
    .select(`
      id,
      fdc_id,
      description,
      brand_name,
      data_type,
      gtin_upc,
      serving_size_description,
      serving_size_grams,
      household_serving_text,
      fdc_published_date,
      fetch_timestamp,
      confidence_score,
      times_used
    `)
    .eq('fdc_id', fdcId)
    .single();
  
  if (error || !foodItem) {
    return { found: false, food: null, isStale: false };
  }
  
  const isStale = isCacheStale(foodItem.fetch_timestamp);
  
  const { data: nutrients, error: nutrientError } = await supabaseAdmin
    .from('food_item_nutrients')
    .select(`
      id,
      nutrient_id,
      amount_per_100g,
      amount_per_serving,
      nutrient_definitions (
        fdc_nutrient_id,
        name,
        unit
      )
    `)
    .eq('food_item_id', foodItem.id);
  
  if (nutrientError) {
    console.error('[fda-cache] Error fetching nutrients:', nutrientError);
  }
  
  const cachedFood: CachedFoodItem = {
    id: foodItem.id,
    fdcId: foodItem.fdc_id,
    description: foodItem.description,
    brandName: foodItem.brand_name,
    dataType: foodItem.data_type,
    source: 'fda',
    gtinUpc: foodItem.gtin_upc,
    servingSizeDescription: foodItem.serving_size_description,
    servingSizeGrams: foodItem.serving_size_grams,
    householdServingText: foodItem.household_serving_text,
    fdcPublishedDate: foodItem.fdc_published_date,
    fetchTimestamp: new Date(foodItem.fetch_timestamp),
    confidenceScore: foodItem.confidence_score,
    timesUsed: foodItem.times_used,
    nutrients: (nutrients || []).map((n: any) => ({
      nutrientId: n.nutrient_id,
      fdcNutrientId: n.nutrient_definitions?.fdc_nutrient_id,
      name: n.nutrient_definitions?.name || 'Unknown',
      unit: n.nutrient_definitions?.unit || '',
      amountPer100g: n.amount_per_100g,
      amountPerServing: n.amount_per_serving,
    })),
  };
  
  return { found: true, food: cachedFood, isStale };
}

export async function getCachedFoodByBarcode(upc: string): Promise<CacheResult> {
  const { data: foodItem, error } = await supabaseAdmin
    .from('food_items')
    .select(`
      id,
      fdc_id,
      description,
      brand_name,
      data_type,
      gtin_upc,
      serving_size_description,
      serving_size_grams,
      household_serving_text,
      fdc_published_date,
      fetch_timestamp,
      confidence_score,
      times_used
    `)
    .eq('gtin_upc', upc)
    .single();
  
  if (error || !foodItem) {
    return { found: false, food: null, isStale: false };
  }
  
  const isStale = isCacheStale(foodItem.fetch_timestamp);
  
  const { data: nutrients, error: nutrientError } = await supabaseAdmin
    .from('food_item_nutrients')
    .select(`
      id,
      nutrient_id,
      amount_per_100g,
      amount_per_serving,
      nutrient_definitions (
        fdc_nutrient_id,
        name,
        unit
      )
    `)
    .eq('food_item_id', foodItem.id);
  
  if (nutrientError) {
    console.error('[fda-cache] Error fetching nutrients:', nutrientError);
  }
  
  const cachedFood: CachedFoodItem = {
    id: foodItem.id,
    fdcId: foodItem.fdc_id,
    description: foodItem.description,
    brandName: foodItem.brand_name,
    dataType: foodItem.data_type,
    source: 'fda',
    gtinUpc: foodItem.gtin_upc,
    servingSizeDescription: foodItem.serving_size_description,
    servingSizeGrams: foodItem.serving_size_grams,
    householdServingText: foodItem.household_serving_text,
    fdcPublishedDate: foodItem.fdc_published_date,
    fetchTimestamp: new Date(foodItem.fetch_timestamp),
    confidenceScore: foodItem.confidence_score,
    timesUsed: foodItem.times_used,
    nutrients: (nutrients || []).map((n: any) => ({
      nutrientId: n.nutrient_id,
      fdcNutrientId: n.nutrient_definitions?.fdc_nutrient_id,
      name: n.nutrient_definitions?.name || 'Unknown',
      unit: n.nutrient_definitions?.unit || '',
      amountPer100g: n.amount_per_100g,
      amountPerServing: n.amount_per_serving,
    })),
  };
  
  return { found: true, food: cachedFood, isStale };
}

export async function cacheFood(food: NormalizedFood): Promise<string | null> {
  const nutrientIdMap = await getNutrientDefinitionIds();
  
  const { data: existingFood } = await supabaseAdmin
    .from('food_items')
    .select('id')
    .eq('fdc_id', food.fdcId)
    .single();
  
  let foodItemId: string;
  
  if (existingFood) {
    const { error: updateError } = await supabaseAdmin
      .from('food_items')
      .update({
        description: food.description,
        brand_name: food.brandName,
        data_type: mapFDADataTypeToDb(food.dataType as FDADataType),
        gtin_upc: food.gtinUpc,
        serving_size_description: food.servingSizeDescription,
        serving_size_grams: food.servingSizeGrams,
        household_serving_text: food.householdServingText,
        fdc_published_date: food.fdcPublishedDate,
        fetch_timestamp: new Date().toISOString(),
      })
      .eq('id', existingFood.id);
    
    if (updateError) {
      console.error('[fda-cache] Error updating food item:', updateError);
      return null;
    }
    
    foodItemId = existingFood.id;
    
    await supabaseAdmin
      .from('food_item_nutrients')
      .delete()
      .eq('food_item_id', foodItemId);
  } else {
    const { data: newFood, error: insertError } = await supabaseAdmin
      .from('food_items')
      .insert({
        fdc_id: food.fdcId,
        description: food.description,
        brand_name: food.brandName,
        data_type: mapFDADataTypeToDb(food.dataType as FDADataType),
        gtin_upc: food.gtinUpc,
        serving_size_description: food.servingSizeDescription,
        serving_size_grams: food.servingSizeGrams,
        household_serving_text: food.householdServingText,
        fdc_published_date: food.fdcPublishedDate,
        fetch_timestamp: new Date().toISOString(),
        confidence_score: 1.0,
        times_used: 0,
      })
      .select('id')
      .single();
    
    if (insertError || !newFood) {
      console.error('[fda-cache] Error inserting food item:', insertError);
      return null;
    }
    
    foodItemId = newFood.id;
  }
  
  const nutrientRows = food.nutrients
    .filter(n => isTrackedNutrient(n.fdcNutrientId) && nutrientIdMap.has(n.fdcNutrientId))
    .map(n => ({
      food_item_id: foodItemId,
      nutrient_id: nutrientIdMap.get(n.fdcNutrientId)!,
      amount_per_100g: n.amountPer100g,
      amount_per_serving: n.amountPerServing,
    }));
  
  if (nutrientRows.length > 0) {
    const { error: nutrientInsertError } = await supabaseAdmin
      .from('food_item_nutrients')
      .insert(nutrientRows);
    
    if (nutrientInsertError) {
      console.error('[fda-cache] Error inserting nutrients:', nutrientInsertError);
    }
  }
  
  // Cache portions if available
  if (food.portions && food.portions.length > 0) {
    // Delete existing portions for this food
    await supabaseAdmin
      .from('food_item_portions')
      .delete()
      .eq('food_item_id', foodItemId);
    
    // Find default portion (first one with gramWeight, or just first one)
    const defaultIndex = food.portions.findIndex(p => p.gramWeight != null) >= 0
      ? food.portions.findIndex(p => p.gramWeight != null)
      : 0;
    
    const portionRows = food.portions.map((portion, index) => ({
      food_item_id: foodItemId,
      source_portion_id: portion.id?.toString() || null,
      description: portion.portionDescription || portion.modifier || 'serving',
      amount: portion.amount || null,
      gram_weight: portion.gramWeight || null,
      unit: portion.measureUnit || null,
      sequence: index,
      modifier: portion.modifier || null,
      is_default: index === defaultIndex,
      data_source: mapFDADataTypeToDb(food.dataType as FDADataType),
    }));
    
    if (portionRows.length > 0) {
      const { error: portionInsertError } = await supabaseAdmin
        .from('food_item_portions')
        .insert(portionRows);
      
      if (portionInsertError) {
        console.error('[fda-cache] Error inserting portions:', portionInsertError);
      }
    }
  }
  
  return foodItemId;
}

export async function incrementTimesUsed(foodItemId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .rpc('increment_food_times_used', { food_item_id: foodItemId });
  
  if (error) {
    const { error: updateError } = await supabaseAdmin
      .from('food_items')
      .update({ times_used: supabaseAdmin.rpc('increment', { value: 1 }) as any })
      .eq('id', foodItemId);
    
    if (updateError) {
      console.error('[fda-cache] Error incrementing times_used:', updateError);
    }
  }
}

function isCacheStale(fetchTimestamp: string | null): boolean {
  if (!fetchTimestamp) return true;
  
  const fetchDate = new Date(fetchTimestamp);
  const now = new Date();
  const daysDiff = (now.getTime() - fetchDate.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysDiff > CACHE_FRESHNESS_DAYS;
}

/**
 * Batch check which fdcIds already exist in cache and their freshness status.
 * Returns a Map of fdcId -> { exists: boolean, isStale: boolean }
 */
export async function batchCheckCachedFdcIds(fdcIds: number[]): Promise<Map<number, { exists: boolean; isStale: boolean }>> {
  const result = new Map<number, { exists: boolean; isStale: boolean }>();
  
  if (fdcIds.length === 0) {
    return result;
  }
  
  const { data, error } = await supabaseAdmin
    .from('food_items')
    .select('fdc_id, fetch_timestamp')
    .in('fdc_id', fdcIds);
  
  if (error) {
    console.error('[fda-cache] Error batch checking fdcIds:', error);
    // Return empty map (will allow caching)
    return result;
  }
  
  // Initialize all as not existing
  for (const fdcId of fdcIds) {
    result.set(fdcId, { exists: false, isStale: false });
  }
  
  // Mark existing ones
  for (const row of data || []) {
    result.set(row.fdc_id, { 
      exists: true, 
      isStale: isCacheStale(row.fetch_timestamp) 
    });
  }
  
  return result;
}

export async function getFoodsWithoutPortions(limit: number = 100): Promise<{ id: string; fdcId: number }[]> {
  // Find food_items that don't have any portions cached
  const { data, error } = await supabaseAdmin
    .from('food_items')
    .select(`
      id,
      fdc_id,
      food_item_portions(id)
    `)
    .not('fdc_id', 'is', null)
    .order('times_used', { ascending: false })
    .limit(limit);
  
  if (error || !data) {
    console.error('[fda-cache] Error finding foods without portions:', error);
    return [];
  }
  
  // Filter to only foods with no portions
  return data
    .filter((f: any) => !f.food_item_portions || f.food_item_portions.length === 0)
    .map((f: any) => ({ id: f.id, fdcId: f.fdc_id }));
}

export async function cachePortionsForFood(foodItemId: string, portions: Array<{
  id?: number;
  amount: number;
  gramWeight: number;
  modifier: string;
  measureUnit?: string;
  portionDescription?: string;
}>, dataType: string = 'fda_foundation'): Promise<boolean> {
  if (!portions || portions.length === 0) {
    return false;
  }

  // Delete existing portions
  await supabaseAdmin
    .from('food_item_portions')
    .delete()
    .eq('food_item_id', foodItemId);

  // Find default (first with gramWeight, or first overall)
  const defaultIndex = portions.findIndex(p => p.gramWeight != null && p.gramWeight > 0) >= 0
    ? portions.findIndex(p => p.gramWeight != null && p.gramWeight > 0)
    : 0;

  const portionRows = portions.map((portion, index) => ({
    food_item_id: foodItemId,
    source_portion_id: portion.id?.toString() || null,
    description: portion.portionDescription || portion.modifier || 'serving',
    amount: portion.amount || null,
    gram_weight: portion.gramWeight || null,
    unit: portion.measureUnit || null,
    sequence: index,
    modifier: portion.modifier || null,
    is_default: index === defaultIndex,
    data_source: dataType,
  }));

  const { error } = await supabaseAdmin
    .from('food_item_portions')
    .insert(portionRows);

  if (error) {
    console.error('[fda-cache] Error caching portions:', error);
    return false;
  }

  return true;
}

export async function searchCachedFoods(query: string, limit: number = 20): Promise<CachedFoodItem[]> {
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 0);
  
  let queryBuilder = supabaseAdmin
    .from('food_items')
    .select(`
      id,
      fdc_id,
      description,
      brand_name,
      data_type,
      gtin_upc,
      serving_size_description,
      serving_size_grams,
      household_serving_text,
      fdc_published_date,
      fetch_timestamp,
      confidence_score,
      times_used
    `)
    .ilike('description', `%${query}%`)
    .order('times_used', { ascending: false })
    .limit(limit);
  
  const { data: foodItems, error } = await queryBuilder;
  
  if (error || !foodItems) {
    console.error('[fda-cache] Error searching cached foods:', error);
    return [];
  }
  
  const foodIds = foodItems.map(f => f.id);
  
  if (foodIds.length === 0) {
    return [];
  }
  
  // Fetch nutrients and portions in parallel
  const [nutrientsResult, portionsResult] = await Promise.all([
    supabaseAdmin
      .from('food_item_nutrients')
      .select(`
        food_item_id,
        nutrient_id,
        amount_per_100g,
        amount_per_serving,
        nutrient_definitions (
          fdc_nutrient_id,
          name,
          unit
        )
      `)
      .in('food_item_id', foodIds),
    supabaseAdmin
      .from('food_item_portions')
      .select(`
        id,
        food_item_id,
        source_portion_id,
        description,
        amount,
        gram_weight,
        unit,
        sequence,
        modifier,
        is_default
      `)
      .in('food_item_id', foodIds)
      .order('sequence', { ascending: true })
  ]);
  
  const nutrientsByFoodId = new Map<string, any[]>();
  for (const n of nutrientsResult.data || []) {
    const existing = nutrientsByFoodId.get(n.food_item_id) || [];
    existing.push(n);
    nutrientsByFoodId.set(n.food_item_id, existing);
  }
  
  const portionsByFoodId = new Map<string, any[]>();
  for (const p of portionsResult.data || []) {
    const existing = portionsByFoodId.get(p.food_item_id) || [];
    existing.push(p);
    portionsByFoodId.set(p.food_item_id, existing);
  }
  
  return foodItems.map(foodItem => ({
    id: foodItem.id,
    fdcId: foodItem.fdc_id,
    description: foodItem.description,
    brandName: foodItem.brand_name,
    dataType: foodItem.data_type,
    source: 'fda',
    gtinUpc: foodItem.gtin_upc,
    servingSizeDescription: foodItem.serving_size_description,
    servingSizeGrams: foodItem.serving_size_grams,
    householdServingText: foodItem.household_serving_text,
    fdcPublishedDate: foodItem.fdc_published_date,
    fetchTimestamp: new Date(foodItem.fetch_timestamp),
    confidenceScore: foodItem.confidence_score,
    timesUsed: foodItem.times_used,
    nutrients: (nutrientsByFoodId.get(foodItem.id) || []).map((n: any) => ({
      nutrientId: n.nutrient_id,
      fdcNutrientId: n.nutrient_definitions?.fdc_nutrient_id,
      name: n.nutrient_definitions?.name || 'Unknown',
      unit: n.nutrient_definitions?.unit || '',
      amountPer100g: n.amount_per_100g,
      amountPerServing: n.amount_per_serving,
    })),
    portions: (portionsByFoodId.get(foodItem.id) || []).map((p: any) => ({
      id: p.id,
      sourcePortionId: p.source_portion_id,
      description: p.description,
      amount: p.amount,
      gramWeight: p.gram_weight,
      unit: p.unit,
      sequence: p.sequence,
      modifier: p.modifier,
      isDefault: p.is_default,
    })),
  }));
}
