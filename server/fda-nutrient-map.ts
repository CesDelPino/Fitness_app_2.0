export const FDA_NUTRIENT_IDS = {
  ENERGY: 1008,
  PROTEIN: 1003,
  CARBOHYDRATE: 1005,
  TOTAL_FAT: 1004,
  FIBER: 1079,
  TOTAL_SUGARS: 2000,
  SATURATED_FAT: 1258,
  TRANS_FAT: 1257,
  CHOLESTEROL: 1253,
  CALCIUM: 1087,
  IRON: 1089,
  MAGNESIUM: 1090,
  PHOSPHORUS: 1091,
  POTASSIUM: 1092,
  SODIUM: 1093,
  ZINC: 1095,
  COPPER: 1098,
  MANGANESE: 1101,
  SELENIUM: 1103,
  VITAMIN_A: 1106,
  VITAMIN_C: 1162,
  VITAMIN_D: 1114,
  VITAMIN_E: 1109,
  VITAMIN_K: 1185,
  THIAMIN_B1: 1165,
  RIBOFLAVIN_B2: 1166,
  NIACIN_B3: 1167,
  PANTOTHENIC_ACID_B5: 1170,
  VITAMIN_B6: 1175,
  FOLATE_B9: 1177,
  VITAMIN_B12: 1178,
} as const;

export const CORE_MACRO_IDS = [
  FDA_NUTRIENT_IDS.ENERGY,
  FDA_NUTRIENT_IDS.PROTEIN,
  FDA_NUTRIENT_IDS.CARBOHYDRATE,
  FDA_NUTRIENT_IDS.TOTAL_FAT,
];

export const TRACKED_NUTRIENT_IDS = Object.values(FDA_NUTRIENT_IDS);

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

export function getNutrientDefinition(fdcNutrientId: number): NutrientDefinition | undefined {
  return NUTRIENT_DEFINITIONS.find(n => n.fdcNutrientId === fdcNutrientId);
}

export function isTrackedNutrient(fdcNutrientId: number): boolean {
  return (TRACKED_NUTRIENT_IDS as readonly number[]).includes(fdcNutrientId);
}

export function isCoreMacro(fdcNutrientId: number): boolean {
  return (CORE_MACRO_IDS as readonly number[]).includes(fdcNutrientId);
}

export function getNutrientsByGroup(group: 'macro' | 'mineral' | 'vitamin' | 'lipid'): NutrientDefinition[] {
  return NUTRIENT_DEFINITIONS.filter(n => n.nutrientGroup === group);
}
