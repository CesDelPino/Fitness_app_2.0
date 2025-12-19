export interface NutrientDefinition {
  fdcNutrientId: number;
  name: string;
  unit: string;
  nutrientGroup: 'macro' | 'mineral' | 'vitamin' | 'lipid';
  displayOrder: number;
  isCoreMacro: boolean;
}

export const NUTRIENT_DEFINITIONS: NutrientDefinition[] = [
  { fdcNutrientId: 1008, name: 'Energy', unit: 'kcal', nutrientGroup: 'macro', displayOrder: 1, isCoreMacro: true },
  { fdcNutrientId: 1003, name: 'Protein', unit: 'g', nutrientGroup: 'macro', displayOrder: 2, isCoreMacro: true },
  { fdcNutrientId: 1005, name: 'Carbohydrate', unit: 'g', nutrientGroup: 'macro', displayOrder: 3, isCoreMacro: true },
  { fdcNutrientId: 1004, name: 'Total Fat', unit: 'g', nutrientGroup: 'macro', displayOrder: 4, isCoreMacro: true },
  { fdcNutrientId: 1079, name: 'Fiber', unit: 'g', nutrientGroup: 'macro', displayOrder: 5, isCoreMacro: false },
  { fdcNutrientId: 2000, name: 'Total Sugars', unit: 'g', nutrientGroup: 'macro', displayOrder: 6, isCoreMacro: false },
  { fdcNutrientId: 1258, name: 'Saturated Fat', unit: 'g', nutrientGroup: 'lipid', displayOrder: 10, isCoreMacro: false },
  { fdcNutrientId: 1257, name: 'Trans Fat', unit: 'g', nutrientGroup: 'lipid', displayOrder: 11, isCoreMacro: false },
  { fdcNutrientId: 1253, name: 'Cholesterol', unit: 'mg', nutrientGroup: 'lipid', displayOrder: 12, isCoreMacro: false },
  { fdcNutrientId: 1087, name: 'Calcium', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 20, isCoreMacro: false },
  { fdcNutrientId: 1089, name: 'Iron', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 21, isCoreMacro: false },
  { fdcNutrientId: 1090, name: 'Magnesium', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 22, isCoreMacro: false },
  { fdcNutrientId: 1091, name: 'Phosphorus', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 23, isCoreMacro: false },
  { fdcNutrientId: 1092, name: 'Potassium', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 24, isCoreMacro: false },
  { fdcNutrientId: 1093, name: 'Sodium', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 25, isCoreMacro: false },
  { fdcNutrientId: 1095, name: 'Zinc', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 26, isCoreMacro: false },
  { fdcNutrientId: 1098, name: 'Copper', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 27, isCoreMacro: false },
  { fdcNutrientId: 1101, name: 'Manganese', unit: 'mg', nutrientGroup: 'mineral', displayOrder: 28, isCoreMacro: false },
  { fdcNutrientId: 1103, name: 'Selenium', unit: 'µg', nutrientGroup: 'mineral', displayOrder: 29, isCoreMacro: false },
  { fdcNutrientId: 1106, name: 'Vitamin A', unit: 'µg', nutrientGroup: 'vitamin', displayOrder: 30, isCoreMacro: false },
  { fdcNutrientId: 1162, name: 'Vitamin C', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 31, isCoreMacro: false },
  { fdcNutrientId: 1114, name: 'Vitamin D', unit: 'µg', nutrientGroup: 'vitamin', displayOrder: 32, isCoreMacro: false },
  { fdcNutrientId: 1109, name: 'Vitamin E', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 33, isCoreMacro: false },
  { fdcNutrientId: 1185, name: 'Vitamin K', unit: 'µg', nutrientGroup: 'vitamin', displayOrder: 34, isCoreMacro: false },
  { fdcNutrientId: 1165, name: 'Thiamin (B1)', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 35, isCoreMacro: false },
  { fdcNutrientId: 1166, name: 'Riboflavin (B2)', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 36, isCoreMacro: false },
  { fdcNutrientId: 1167, name: 'Niacin (B3)', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 37, isCoreMacro: false },
  { fdcNutrientId: 1170, name: 'Pantothenic Acid (B5)', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 38, isCoreMacro: false },
  { fdcNutrientId: 1175, name: 'Vitamin B6', unit: 'mg', nutrientGroup: 'vitamin', displayOrder: 39, isCoreMacro: false },
  { fdcNutrientId: 1177, name: 'Folate (B9)', unit: 'µg', nutrientGroup: 'vitamin', displayOrder: 40, isCoreMacro: false },
  { fdcNutrientId: 1178, name: 'Vitamin B12', unit: 'µg', nutrientGroup: 'vitamin', displayOrder: 41, isCoreMacro: false },
];

export const TRACKED_NUTRIENT_IDS = NUTRIENT_DEFINITIONS.map(n => n.fdcNutrientId);

export const CORE_MACRO_IDS = NUTRIENT_DEFINITIONS
  .filter(n => n.isCoreMacro)
  .map(n => n.fdcNutrientId);

export function getNutrientDefinition(fdcNutrientId: number): NutrientDefinition | undefined {
  return NUTRIENT_DEFINITIONS.find(n => n.fdcNutrientId === fdcNutrientId);
}

export function isTrackedNutrient(fdcNutrientId: number): boolean {
  return TRACKED_NUTRIENT_IDS.includes(fdcNutrientId);
}

export function isCoreMacro(fdcNutrientId: number): boolean {
  return CORE_MACRO_IDS.includes(fdcNutrientId);
}

export interface NutrientValue {
  id: number;
  name: string;
  unit: string;
  value: number | null;
}

export interface NutrientSnapshot {
  nutrients: NutrientValue[];
  fetchedAt: string;
  portionGrams?: number;
  portionLabel?: string;
  scaledAt?: string;
  fdcId?: number;
  source?: 'fda' | 'ai' | 'manual' | 'openfoodfacts';
}

export function createEmptyNutrientSnapshot(): NutrientSnapshot {
  return {
    nutrients: NUTRIENT_DEFINITIONS.map(def => ({
      id: def.fdcNutrientId,
      name: def.name,
      unit: def.unit,
      value: null,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

export function extractMacrosFromSnapshot(snapshot: NutrientSnapshot | null | undefined): {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
} {
  if (!snapshot?.nutrients || !Array.isArray(snapshot.nutrients)) {
    return { calories: null, protein: null, carbs: null, fat: null, fiber: null, sugar: null };
  }
  
  const findNutrient = (id: number) => {
    const found = snapshot.nutrients.find(n => n.id === id);
    return found?.value ?? null;
  };
  
  return {
    calories: findNutrient(1008),
    protein: findNutrient(1003),
    carbs: findNutrient(1005),
    fat: findNutrient(1004),
    fiber: findNutrient(1079),
    sugar: findNutrient(2000),
  };
}
