export type FDADataType = 'Foundation' | 'SR Legacy' | 'Branded' | 'Survey (FNDDS)' | 'Experimental';

export type DbDataSourceType = 'fda_foundation' | 'fda_sr_legacy' | 'fda_branded' | 'openfoodfacts' | 'user_manual';

export function mapFDADataTypeToDb(fdaDataType: FDADataType): DbDataSourceType {
  switch (fdaDataType) {
    case 'Foundation':
      return 'fda_foundation';
    case 'SR Legacy':
      return 'fda_sr_legacy';
    case 'Branded':
      return 'fda_branded';
    case 'Survey (FNDDS)':
      return 'fda_sr_legacy';
    case 'Experimental':
      return 'fda_foundation';
    default:
      return 'fda_sr_legacy';
  }
}

export interface FDANutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
  derivationCode?: string;
  derivationDescription?: string;
}

export interface FDAFoodNutrient {
  nutrient: {
    id: number;
    number: string;
    name: string;
    rank: number;
    unitName: string;
  };
  amount?: number;
  foodNutrientDerivation?: {
    code: string;
    description: string;
  };
}

export interface FDAServingSize {
  servingSizeUnit: string;
  servingSize: number;
  servingSizeText?: string;
  householdServingFullText?: string;
}

export interface FDASearchResultFood {
  fdcId: number;
  description: string;
  dataType: FDADataType;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  ingredients?: string;
  publishedDate?: string;
  foodNutrients: FDANutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

export interface FDASearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: FDASearchResultFood[];
}

export interface FDAFoodDetails {
  fdcId: number;
  description: string;
  dataType: FDADataType;
  publicationDate?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: FDAFoodNutrient[];
  foodPortions?: Array<{
    id: number;
    amount: number;
    gramWeight: number;
    measureUnit?: {
      name: string;
      abbreviation: string;
    };
    portionDescription?: string;
    modifier?: string;
  }>;
}

export interface FDABatchResponse {
  foods: FDAFoodDetails[];
}

export interface FDASearchOptions {
  query: string;
  dataType?: FDADataType[];
  pageSize?: number;
  pageNumber?: number;
  sortBy?: 'dataType.keyword' | 'lowercaseDescription.keyword' | 'fdcId' | 'publishedDate';
  sortOrder?: 'asc' | 'desc';
  brandOwner?: string;
}

export interface FoodPortion {
  id?: number;
  amount: number;
  gramWeight: number;
  modifier: string;
  measureUnit?: string;
  portionDescription?: string;
}

export interface NormalizedFood {
  fdcId: number;
  description: string;
  brandName: string | null;
  dataType: string;
  source: 'fda';
  gtinUpc: string | null;
  servingSizeDescription: string | null;
  servingSizeGrams: number | null;
  householdServingText: string | null;
  fdcPublishedDate: string | null;
  nutrients: NormalizedNutrient[];
  portions?: FoodPortion[];
}

export interface NormalizedNutrient {
  fdcNutrientId: number;
  name: string;
  unit: string;
  amountPer100g: number | null;
  amountPerServing: number | null;
}

export interface CachedFoodPortion {
  id: string;
  sourcePortionId: string | null;
  description: string;
  amount: number | null;
  gramWeight: number | null;
  unit: string | null;
  sequence: number | null;
  modifier: string | null;
  isDefault: boolean;
}

export interface CachedFoodItem {
  id: string;
  fdcId: number | null;
  description: string;
  brandName: string | null;
  dataType: string;
  source: string;
  gtinUpc: string | null;
  servingSizeDescription: string | null;
  servingSizeGrams: number | null;
  householdServingText: string | null;
  fdcPublishedDate: string | null;
  fetchTimestamp: Date;
  confidenceScore: number | null;
  timesUsed: number;
  nutrients: Array<{
    nutrientId: string;
    fdcNutrientId: number;
    name: string;
    unit: string;
    amountPer100g: number | null;
    amountPerServing: number | null;
  }>;
  portions?: CachedFoodPortion[];
}
