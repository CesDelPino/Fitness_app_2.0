import type {
  FDASearchOptions,
  FDASearchResponse,
  FDAFoodDetails,
  FDASearchResultFood,
  NormalizedFood,
  NormalizedNutrient,
  FDADataType,
} from './fda-types';
import { isTrackedNutrient, getNutrientDefinition } from './fda-nutrient-map';
import { NUTRIENT_DEFINITIONS } from '../shared/fda-nutrients';
import {
  getCachedFoodByFdcId,
  getCachedFoodByBarcode,
  cacheFood,
  searchCachedFoods,
  batchCheckCachedFdcIds,
} from './fda-cache';

const FDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const FDA_API_KEY = process.env.FDA_API_KEY;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface FDASearchResult {
  foods: NormalizedFood[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
  fromCache: boolean;
}

class FDAService {
  private static instance: FDAService;

  private constructor() {}

  static getInstance(): FDAService {
    if (!FDAService.instance) {
      FDAService.instance = new FDAService();
    }
    return FDAService.instance;
  }

  async searchFoods(query: string, options?: Partial<FDASearchOptions>): Promise<FDASearchResult> {
    if (!FDA_API_KEY) {
      console.error('[fda-service] FDA_API_KEY not configured');
      throw new Error('FDA API key not configured');
    }

    const cachedResults = await searchCachedFoods(query, 10);
    if (cachedResults.length >= 5) {
      return {
        foods: cachedResults.map(f => this.cachedToNormalized(f)),
        totalHits: cachedResults.length,
        currentPage: 1,
        totalPages: 1,
        fromCache: true,
      };
    }

    const dataTypePriority: FDADataType[] = options?.dataType || ['Foundation', 'SR Legacy', 'Branded'];
    let allFoods: NormalizedFood[] = [];
    let totalHits = 0;

    for (const dataType of dataTypePriority) {
      if (allFoods.length >= 20) break;

      try {
        const response = await this.fetchWithRetry<FDASearchResponse>(
          `${FDA_API_BASE}/foods/search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': FDA_API_KEY,
            },
            body: JSON.stringify({
              query,
              dataType: [dataType],
              pageSize: options?.pageSize || 25,
              pageNumber: options?.pageNumber || 1,
              sortBy: options?.sortBy || 'dataType.keyword',
              sortOrder: options?.sortOrder || 'asc',
            }),
          }
        );

        if (response.foods && response.foods.length > 0) {
          const normalized = response.foods.map(f => this.normalizeSearchResult(f));
          allFoods.push(...normalized);
          totalHits += response.totalHits;

          for (const food of normalized.slice(0, 5)) {
            await cacheFood(food).catch(err => {
              console.warn('[fda-service] Failed to cache food:', err);
            });
          }
        }
      } catch (error) {
        console.error(`[fda-service] Error searching ${dataType}:`, error);
      }
    }

    const uniqueFoods = this.deduplicateFoods(allFoods);

    return {
      foods: uniqueFoods.slice(0, 25),
      totalHits,
      currentPage: options?.pageNumber || 1,
      totalPages: Math.ceil(totalHits / (options?.pageSize || 25)),
      fromCache: false,
    };
  }

  async getFoodDetails(fdcId: number, options?: { includePortions?: boolean }): Promise<NormalizedFood | null> {
    const needsFreshData = options?.includePortions ?? true;
    
    const cached = await getCachedFoodByFdcId(fdcId);
    if (!needsFreshData && cached.found && !cached.isStale && cached.food) {
      return this.cachedToNormalized(cached.food);
    }

    if (!FDA_API_KEY) {
      console.error('[fda-service] FDA_API_KEY not configured');
      if (cached.found && cached.food) {
        return this.cachedToNormalized(cached.food);
      }
      return null;
    }

    try {
      const response = await this.fetchWithRetry<FDAFoodDetails>(
        `${FDA_API_BASE}/food/${fdcId}?api_key=${FDA_API_KEY}`,
        { method: 'GET' }
      );

      const normalized = this.normalizeFoodDetails(response);
      await cacheFood(normalized).catch(err => {
        console.warn('[fda-service] Failed to cache food details:', err);
      });

      return normalized;
    } catch (error) {
      console.error('[fda-service] Error fetching food details:', error);
      if (cached.found && cached.food) {
        return this.cachedToNormalized(cached.food);
      }
      return null;
    }
  }

  async searchByBarcode(upc: string): Promise<NormalizedFood | null> {
    const normalizedUpc = upc.replace(/[^0-9]/g, '');

    const cached = await getCachedFoodByBarcode(normalizedUpc);
    if (cached.found && !cached.isStale && cached.food) {
      return this.cachedToNormalized(cached.food);
    }

    // Try FDA first
    if (FDA_API_KEY) {
      try {
        const response = await this.fetchWithRetry<FDASearchResponse>(
          `${FDA_API_BASE}/foods/search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': FDA_API_KEY,
            },
            body: JSON.stringify({
              query: normalizedUpc,
              dataType: ['Branded'],
              pageSize: 5,
              pageNumber: 1,
            }),
          }
        );

        if (response.foods && response.foods.length > 0) {
          const exactMatch = response.foods.find(f => f.gtinUpc === normalizedUpc);
          const bestMatch = exactMatch || response.foods[0];

          const normalized = this.normalizeSearchResult(bestMatch);
          await cacheFood(normalized).catch(err => {
            console.warn('[fda-service] Failed to cache barcode result:', err);
          });

          return normalized;
        }
        console.log(`[fda-service] No FDA results for barcode ${normalizedUpc}, trying OpenFoodFacts`);
      } catch (error) {
        console.warn('[fda-service] FDA barcode search failed, trying OpenFoodFacts:', error);
      }
    }

    // Fallback to OpenFoodFacts
    try {
      const offResult = await this.searchOpenFoodFacts(normalizedUpc);
      if (offResult) {
        await cacheFood(offResult).catch(err => {
          console.warn('[fda-service] Failed to cache OpenFoodFacts result:', err);
        });
        return offResult;
      }
    } catch (error) {
      console.warn('[fda-service] OpenFoodFacts search failed:', error);
    }

    // Return stale cache if available
    if (cached.found && cached.food) {
      return this.cachedToNormalized(cached.food);
    }

    return null;
  }

  private async searchOpenFoodFacts(barcode: string): Promise<NormalizedFood | null> {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
        { 
          method: 'GET',
          headers: { 'User-Agent': 'LOBA-Tracker/1.0' }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 1 || !data.product) {
        return null;
      }

      const product = data.product;
      const nutriments = product.nutriments || {};

      // Map OpenFoodFacts field names to FDC nutrient IDs with unit conversion multipliers
      // OpenFoodFacts units vs our NUTRIENT_DEFINITIONS units:
      // - Macros (g): protein, carbs, fat, fiber, sugar - no conversion needed
      // - Lipids (g): saturated fat, trans fat - no conversion needed
      // - Cholesterol: OFF provides mg, we need mg - no conversion
      // - Minerals: OFF provides GRAMS, we need mg - multiply by 1000
      // - Vitamins A/D/K/B12/folate: OFF provides µg, we need µg - no conversion
      // - Vitamins C/E/B1/B2/B3/B5/B6: OFF provides mg, we need mg - no conversion
      // - Selenium: OFF provides µg, we need µg - no conversion
      const offToFdcMap: Record<number, { field: string; multiplier: number }> = {
        1008: { field: 'energy-kcal_100g', multiplier: 1 },
        1003: { field: 'proteins_100g', multiplier: 1 },
        1005: { field: 'carbohydrates_100g', multiplier: 1 },
        1004: { field: 'fat_100g', multiplier: 1 },
        1079: { field: 'fiber_100g', multiplier: 1 },
        2000: { field: 'sugars_100g', multiplier: 1 },
        1258: { field: 'saturated-fat_100g', multiplier: 1 },
        1257: { field: 'trans-fat_100g', multiplier: 1 },
        1253: { field: 'cholesterol_100g', multiplier: 1 },
        1087: { field: 'calcium_100g', multiplier: 1000 },
        1089: { field: 'iron_100g', multiplier: 1000 },
        1090: { field: 'magnesium_100g', multiplier: 1000 },
        1091: { field: 'phosphorus_100g', multiplier: 1000 },
        1092: { field: 'potassium_100g', multiplier: 1000 },
        1093: { field: 'sodium_100g', multiplier: 1000 },
        1095: { field: 'zinc_100g', multiplier: 1000 },
        1098: { field: 'copper_100g', multiplier: 1000 },
        1101: { field: 'manganese_100g', multiplier: 1000 },
        1103: { field: 'selenium_100g', multiplier: 1 },
        1106: { field: 'vitamin-a_100g', multiplier: 1 },
        1162: { field: 'vitamin-c_100g', multiplier: 1 },
        1114: { field: 'vitamin-d_100g', multiplier: 1 },
        1109: { field: 'vitamin-e_100g', multiplier: 1 },
        1185: { field: 'vitamin-k_100g', multiplier: 1 },
        1165: { field: 'vitamin-b1_100g', multiplier: 1 },
        1166: { field: 'vitamin-b2_100g', multiplier: 1 },
        1167: { field: 'vitamin-pp_100g', multiplier: 1 },
        1170: { field: 'pantothenic-acid_100g', multiplier: 1 },
        1175: { field: 'vitamin-b6_100g', multiplier: 1 },
        1177: { field: 'folates_100g', multiplier: 1 },
        1178: { field: 'vitamin-b12_100g', multiplier: 1 },
      };

      // Helper to safely parse numeric values from OFF
      const parseOffValue = (val: unknown): number | null => {
        if (val === undefined || val === null) return null;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        return isNaN(num) ? null : num;
      };

      // First check sodium to determine if we need salt fallback
      const directSodium = parseOffValue(nutriments['sodium_100g']);
      let sodiumFromSalt: number | null = null;
      if (directSodium === null) {
        // OFF reports salt in grams per 100g, we need sodium in mg
        // Salt (NaCl) is ~40% sodium, so: sodium_mg = salt_g * 1000 / 2.5 = salt_g * 400
        const saltValueGrams = parseOffValue(nutriments['salt_100g']);
        if (saltValueGrams !== null) {
          sodiumFromSalt = saltValueGrams * 400;
        }
      }

      // Generate all 31 nutrients using canonical NUTRIENT_DEFINITIONS ordering
      // Use null for any nutrients not provided by OpenFoodFacts
      const nutrients: NormalizedNutrient[] = NUTRIENT_DEFINITIONS.map((def) => {
        const mapping = offToFdcMap[def.fdcNutrientId];
        let amountPer100g: number | null = null;

        if (mapping) {
          const rawValue = parseOffValue(nutriments[mapping.field]);
          if (rawValue !== null) {
            amountPer100g = rawValue * mapping.multiplier;
          }
        }

        // Handle sodium from salt fallback (only if direct sodium wasn't available)
        if (def.fdcNutrientId === 1093 && amountPer100g === null && sodiumFromSalt !== null) {
          amountPer100g = sodiumFromSalt;
        }

        return {
          fdcNutrientId: def.fdcNutrientId,
          name: def.name,
          unit: def.unit,
          amountPer100g,
          amountPerServing: null,
        };
      });

      const servingSize = product.serving_size 
        ? parseFloat(product.serving_size.replace(/[^\d.]/g, '')) || undefined
        : undefined;

      return {
        fdcId: 0,
        description: product.product_name || product.product_name_en || 'Unknown Product',
        dataType: 'OpenFoodFacts',
        source: 'fda' as const,
        brandName: product.brands || null,
        gtinUpc: barcode,
        servingSizeDescription: servingSize ? `${servingSize}g` : null,
        servingSizeGrams: servingSize || null,
        householdServingText: product.serving_size || null,
        fdcPublishedDate: null,
        nutrients,
        portions: servingSize ? [{
          id: 1,
          amount: 1,
          gramWeight: servingSize,
          modifier: 'serving',
          portionDescription: product.serving_size || 'serving',
          measureUnit: undefined,
        }] : undefined,
      };
    } catch (error) {
      console.error('[fda-service] OpenFoodFacts API error:', error);
      return null;
    }
  }

  async batchGetFoods(fdcIds: number[]): Promise<NormalizedFood[]> {
    if (fdcIds.length === 0) return [];

    const results: NormalizedFood[] = [];
    const idsToFetch: number[] = [];

    for (const fdcId of fdcIds) {
      const cached = await getCachedFoodByFdcId(fdcId);
      if (cached.found && !cached.isStale && cached.food) {
        results.push(this.cachedToNormalized(cached.food));
      } else {
        idsToFetch.push(fdcId);
      }
    }

    if (idsToFetch.length === 0) {
      return results;
    }

    if (!FDA_API_KEY) {
      console.error('[fda-service] FDA_API_KEY not configured');
      return results;
    }

    try {
      const foods = await this.fetchWithRetry<FDAFoodDetails[]>(
        `${FDA_API_BASE}/foods?api_key=${FDA_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fdcIds: idsToFetch }),
        }
      );

      if (Array.isArray(foods)) {
        for (const food of foods) {
          const normalized = this.normalizeFoodDetails(food);
          results.push(normalized);
          await cacheFood(normalized).catch(err => {
            console.warn('[fda-service] Failed to cache batch food:', err);
          });
        }
      }
    } catch (error) {
      console.error('[fda-service] Error batch fetching foods:', error);
    }

    return results;
  }

  private async fetchWithRetry<T>(url: string, options: RequestInit, retryCount = 0): Promise<T> {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
          console.log(`[fda-service] Rate limited, retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.fetchWithRetry<T>(url, options, retryCount + 1);
        }
        throw new Error('FDA API rate limit exceeded after retries');
      }

      if (response.status >= 500) {
        if (retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
          console.log(`[fda-service] Server error ${response.status}, retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.fetchWithRetry<T>(url, options, retryCount + 1);
        }
        throw new Error(`FDA API server error: ${response.status}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FDA API error ${response.status}: ${errorText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.log(`[fda-service] Network error, retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry<T>(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private normalizeSearchResult(food: FDASearchResultFood): NormalizedFood {
    const nutrients: NormalizedNutrient[] = [];

    for (const n of food.foodNutrients || []) {
      if (!isTrackedNutrient(n.nutrientId)) continue;

      const def = getNutrientDefinition(n.nutrientId);
      if (!def) continue;

      nutrients.push({
        fdcNutrientId: n.nutrientId,
        name: def.name,
        unit: def.unit,
        amountPer100g: n.value ?? null,
        amountPerServing: food.servingSize
          ? (n.value ?? 0) * (food.servingSize / 100)
          : null,
      });
    }

    return {
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName || food.brandOwner || null,
      dataType: food.dataType,
      source: 'fda',
      gtinUpc: food.gtinUpc || null,
      servingSizeDescription: food.servingSizeUnit
        ? `${food.servingSize || 100}${food.servingSizeUnit}`
        : null,
      servingSizeGrams: food.servingSize || null,
      householdServingText: food.householdServingFullText || null,
      fdcPublishedDate: food.publishedDate || null,
      nutrients,
    };
  }

  private normalizeFoodDetails(food: FDAFoodDetails): NormalizedFood {
    const nutrients: NormalizedNutrient[] = [];

    for (const n of food.foodNutrients || []) {
      const nutrientId = n.nutrient?.id;
      if (!nutrientId || !isTrackedNutrient(nutrientId)) continue;

      const def = getNutrientDefinition(nutrientId);
      if (!def) continue;

      nutrients.push({
        fdcNutrientId: nutrientId,
        name: def.name,
        unit: def.unit,
        amountPer100g: n.amount ?? null,
        amountPerServing: food.servingSize
          ? (n.amount ?? 0) * (food.servingSize / 100)
          : null,
      });
    }

    const portions = (food.foodPortions || []).map(p => {
      const label = p.portionDescription 
        || p.modifier 
        || p.measureUnit?.name 
        || 'serving';
      return {
        id: p.id,
        amount: p.amount || 1,
        gramWeight: p.gramWeight,
        modifier: label,
        measureUnit: p.measureUnit?.name || undefined,
        portionDescription: p.portionDescription || undefined,
      };
    });

    return {
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName || food.brandOwner || null,
      dataType: food.dataType,
      source: 'fda',
      gtinUpc: food.gtinUpc || null,
      servingSizeDescription: food.servingSizeUnit
        ? `${food.servingSize || 100}${food.servingSizeUnit}`
        : null,
      servingSizeGrams: food.servingSize || null,
      householdServingText: food.householdServingFullText || null,
      fdcPublishedDate: food.publicationDate || null,
      nutrients,
      portions: portions.length > 0 ? portions : undefined,
    };
  }

  private cachedToNormalized(cached: any): NormalizedFood {
    return {
      fdcId: cached.fdcId,
      description: cached.description,
      brandName: cached.brandName,
      dataType: cached.dataType,
      source: 'fda',
      gtinUpc: cached.gtinUpc,
      servingSizeDescription: cached.servingSizeDescription,
      servingSizeGrams: cached.servingSizeGrams,
      householdServingText: cached.householdServingText,
      fdcPublishedDate: cached.fdcPublishedDate,
      nutrients: (cached.nutrients || []).map((n: any) => ({
        fdcNutrientId: n.fdcNutrientId,
        name: n.name,
        unit: n.unit,
        amountPer100g: n.amountPer100g,
        amountPerServing: n.amountPerServing,
      })),
    };
  }

  private deduplicateFoods(foods: NormalizedFood[]): NormalizedFood[] {
    const seen = new Set<number>();
    return foods.filter(food => {
      if (seen.has(food.fdcId)) return false;
      seen.add(food.fdcId);
      return true;
    });
  }
}

export const fdaService = FDAService.getInstance();
