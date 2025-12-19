import { 
  NUTRIENT_DEFINITIONS, 
  type NutrientDefinition,
  type NutrientValue,
  type NutrientSnapshot,
  CORE_MACRO_IDS,
} from "@shared/fda-nutrients";

export type { NutrientValue, NutrientSnapshot };

export { CORE_MACRO_IDS };

export const NUTRIENT_IDS = {
  CALORIES: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
  FIBER: 1079,
  SUGAR: 2000,
  SATURATED_FAT: 1258,
  TRANS_FAT: 1257,
  CHOLESTEROL: 1253,
} as const;

export const FIBER_SUGAR_IDS: number[] = [NUTRIENT_IDS.FIBER, NUTRIENT_IDS.SUGAR];
export const DETAILED_FAT_IDS: number[] = [NUTRIENT_IDS.SATURATED_FAT, NUTRIENT_IDS.TRANS_FAT, NUTRIENT_IDS.CHOLESTEROL];

export interface GroupedNutrients {
  macro: NutrientValue[];
  lipid: NutrientValue[];
  mineral: NutrientValue[];
  vitamin: NutrientValue[];
}

export interface SectionedNutrients {
  coreMacros: NutrientValue[];
  fiberSugar: NutrientValue[];
  vitamins: NutrientValue[];
  minerals: NutrientValue[];
  detailedFats: NutrientValue[];
}

export interface ExtractedMacros {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export function formatNutrientValue(
  value: number | null | undefined,
  unit: string,
  options?: {
    precision?: number;
    showUnit?: boolean;
    nullDisplay?: string;
  }
): string {
  const { precision = 1, showUnit = true, nullDisplay = "—" } = options || {};

  if (value === null || value === undefined) {
    return nullDisplay;
  }

  let formatted: string;
  if (unit === "kcal" || Math.abs(value) >= 100) {
    formatted = Math.round(value).toString();
  } else if (Math.abs(value) >= 10) {
    formatted = value.toFixed(precision);
  } else if (Math.abs(value) >= 1) {
    formatted = value.toFixed(precision);
  } else if (value === 0) {
    formatted = "0";
  } else {
    formatted = value.toFixed(Math.min(2, precision + 1));
  }

  if (showUnit && unit) {
    return `${formatted}${unit}`;
  }
  return formatted;
}

export function groupNutrients(
  nutrients: Array<{ id: number; name: string; unit: string; value: number | null }>
): GroupedNutrients {
  const grouped: GroupedNutrients = {
    macro: [],
    lipid: [],
    mineral: [],
    vitamin: [],
  };

  const sortedDefinitions = [...NUTRIENT_DEFINITIONS].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  for (const def of sortedDefinitions) {
    const nutrient = nutrients.find((n) => n.id === def.fdcNutrientId);
    const nutrientValue: NutrientValue = {
      id: def.fdcNutrientId,
      name: nutrient?.name ?? def.name,
      unit: nutrient?.unit ?? def.unit,
      value: nutrient?.value ?? null,
    };

    grouped[def.nutrientGroup].push(nutrientValue);
  }

  return grouped;
}

export function extractMacrosFromSnapshot(
  nutrients: Array<{ id: number; value: number | null }> | undefined | null
): ExtractedMacros {
  if (!nutrients || nutrients.length === 0) {
    return { calories: null, protein: null, carbs: null, fat: null };
  }

  const findValue = (nutrientId: number): number | null => {
    const nutrient = nutrients.find((n) => n.id === nutrientId);
    if (!nutrient || nutrient.value === null || nutrient.value === undefined) {
      return null;
    }
    return nutrient.value;
  };

  return {
    calories: findValue(1008),
    protein: findValue(1003),
    carbs: findValue(1005),
    fat: findValue(1004),
  };
}

export function getGroupDisplayName(group: keyof GroupedNutrients): string {
  const names: Record<keyof GroupedNutrients, string> = {
    macro: "Macronutrients",
    lipid: "Fats & Cholesterol",
    mineral: "Minerals",
    vitamin: "Vitamins",
  };
  return names[group];
}

export function getNutrientById(
  nutrients: Array<{ id: number; value: number | null }>,
  nutrientId: number
): number | null {
  const nutrient = nutrients.find((n) => n.id === nutrientId);
  return nutrient?.value ?? null;
}

export function hasAnyMicronutrientData(
  nutrients: Array<{ id: number; value: number | null }>
): boolean {
  const coreMacroIds = [1008, 1003, 1005, 1004];
  return nutrients.some(
    (n) => !coreMacroIds.includes(n.id) && n.value !== null && n.value !== undefined
  );
}

export function countNutrientsWithData(
  nutrients: Array<{ id: number; value: number | null }>
): { total: number; withData: number } {
  const total = NUTRIENT_DEFINITIONS.length;
  const withData = nutrients.filter(
    (n) => n.value !== null && n.value !== undefined
  ).length;
  return { total, withData };
}

export function getNutrientDefinitionById(
  nutrientId: number
): NutrientDefinition | undefined {
  return NUTRIENT_DEFINITIONS.find((n) => n.fdcNutrientId === nutrientId);
}

export interface PortionInferenceInput {
  nutrientSnapshot?: {
    nutrients?: Array<{ id: number; value: number | null }>;
    portionGrams?: number;
    scaledAt?: string;
  } | null;
  servingSizeGrams?: number | null;
  quantityValue?: number | null;
  nutrientsPer100g?: {
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  } | null;
  storedCalories?: number | null;
}

export interface PortionInferenceResult {
  inferredGrams: number | null;
  source: 'portionGrams' | 'servingSizeGrams' | 'macroRatio' | 'default100g' | 'none';
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export function inferPortionGrams(input: PortionInferenceInput): PortionInferenceResult {
  const { nutrientSnapshot, servingSizeGrams, quantityValue, nutrientsPer100g, storedCalories } = input;
  
  const wasScaled = !!nutrientSnapshot?.scaledAt;
  
  if (nutrientSnapshot?.portionGrams && nutrientSnapshot.portionGrams > 0) {
    return {
      inferredGrams: nutrientSnapshot.portionGrams,
      source: 'portionGrams',
      confidence: 'high',
    };
  }
  
  if (!wasScaled) {
    return {
      inferredGrams: 100,
      source: 'default100g',
      confidence: 'high',
    };
  }
  
  if (servingSizeGrams && servingSizeGrams > 0) {
    const qty = quantityValue && quantityValue > 0 ? quantityValue : 1;
    return {
      inferredGrams: servingSizeGrams * qty,
      source: 'servingSizeGrams',
      confidence: 'medium',
    };
  }
  
  if (nutrientsPer100g && storedCalories && storedCalories > 0) {
    const caloriesPer100g = nutrientsPer100g.calories;
    if (caloriesPer100g && caloriesPer100g > 0) {
      const inferredGrams = (storedCalories / caloriesPer100g) * 100;
      if (inferredGrams > 0 && inferredGrams < 10000) {
        return {
          inferredGrams,
          source: 'macroRatio',
          confidence: 'medium',
        };
      }
    }
  }
  
  return {
    inferredGrams: null,
    source: 'none',
    confidence: 'none',
  };
}

export function groupNutrientsBySection(
  snapshot: NutrientSnapshot | null | undefined
): SectionedNutrients {
  const result: SectionedNutrients = {
    coreMacros: [],
    fiberSugar: [],
    vitamins: [],
    minerals: [],
    detailedFats: [],
  };

  if (!snapshot?.nutrients || !Array.isArray(snapshot.nutrients)) {
    return result;
  }

  const sortedDefinitions = [...NUTRIENT_DEFINITIONS].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  for (const def of sortedDefinitions) {
    const nutrient = snapshot.nutrients.find((n) => n.id === def.fdcNutrientId);
    const nutrientValue: NutrientValue = {
      id: def.fdcNutrientId,
      name: nutrient?.name ?? def.name,
      unit: nutrient?.unit ?? def.unit,
      value: nutrient?.value ?? null,
    };

    if (CORE_MACRO_IDS.includes(def.fdcNutrientId)) {
      result.coreMacros.push(nutrientValue);
    } else if (FIBER_SUGAR_IDS.includes(def.fdcNutrientId)) {
      result.fiberSugar.push(nutrientValue);
    } else if (DETAILED_FAT_IDS.includes(def.fdcNutrientId)) {
      result.detailedFats.push(nutrientValue);
    } else if (def.nutrientGroup === 'vitamin') {
      result.vitamins.push(nutrientValue);
    } else if (def.nutrientGroup === 'mineral') {
      result.minerals.push(nutrientValue);
    }
  }

  return result;
}

export function getSectionDisplayName(section: keyof SectionedNutrients): string {
  const names: Record<keyof SectionedNutrients, string> = {
    coreMacros: 'Macros',
    fiberSugar: 'Fiber & Sugar',
    vitamins: 'Vitamins',
    minerals: 'Minerals',
    detailedFats: 'Fats & Cholesterol',
  };
  return names[section];
}

export function hasNutrientsWithValues(nutrients: NutrientValue[]): boolean {
  return nutrients.some((n) => n.value !== null && n.value !== undefined);
}
