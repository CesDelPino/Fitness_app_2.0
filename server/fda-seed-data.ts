/**
 * Common FDA FoodData Central food IDs for pre-seeding
 * These are curated from the Foundation and SR Legacy databases
 * to provide instant access to frequently logged foods.
 * 
 * Source: USDA FoodData Central
 * Last Updated: December 2024
 */

export interface SeedFood {
  fdcId: number;
  name: string;
  category: string;
}

export const COMMON_FOODS: SeedFood[] = [
  // Fruits
  { fdcId: 1750340, name: 'Apples, fuji, with skin, raw', category: 'fruits' },
  { fdcId: 173944, name: 'Bananas, raw', category: 'fruits' },
  { fdcId: 169097, name: 'Oranges, raw, navels', category: 'fruits' },
  { fdcId: 167762, name: 'Strawberries, raw', category: 'fruits' },
  { fdcId: 2346411, name: 'Blueberries, raw', category: 'fruits' },
  { fdcId: 2346412, name: 'Grapes, red, seedless, raw', category: 'fruits' },
  { fdcId: 167765, name: 'Watermelon, raw', category: 'fruits' },
  { fdcId: 169910, name: 'Mangos, raw', category: 'fruits' },
  { fdcId: 171706, name: 'Avocados, raw, California', category: 'fruits' },
  { fdcId: 2346398, name: 'Pineapple, raw', category: 'fruits' },

  // Vegetables
  { fdcId: 747447, name: 'Broccoli, raw', category: 'vegetables' },
  { fdcId: 168462, name: 'Spinach, raw', category: 'vegetables' },
  { fdcId: 170393, name: 'Carrots, raw', category: 'vegetables' },
  { fdcId: 170457, name: 'Tomatoes, red, ripe, raw', category: 'vegetables' },
  { fdcId: 168409, name: 'Cucumber, with peel, raw', category: 'vegetables' },
  { fdcId: 170000, name: 'Onions, raw', category: 'vegetables' },
  { fdcId: 170108, name: 'Peppers, sweet, red, raw', category: 'vegetables' },
  { fdcId: 169248, name: 'Lettuce, iceberg, raw', category: 'vegetables' },
  { fdcId: 169986, name: 'Cauliflower, raw', category: 'vegetables' },
  { fdcId: 169291, name: 'Squash, summer, zucchini, raw', category: 'vegetables' },

  // Proteins - Meat
  { fdcId: 2646170, name: 'Chicken, breast, boneless, skinless, raw', category: 'proteins' },
  { fdcId: 172855, name: 'Chicken, thigh, meat only, raw', category: 'proteins' },
  { fdcId: 174036, name: 'Beef, ground, 80% lean meat / 20% fat, raw', category: 'proteins' },
  { fdcId: 174030, name: 'Beef, ground, 90% lean meat / 10% fat, raw', category: 'proteins' },
  { fdcId: 2727575, name: 'Pork, chop, center cut, raw', category: 'proteins' },
  { fdcId: 171098, name: 'Turkey, whole, breast, meat only, raw', category: 'proteins' },
  { fdcId: 2646172, name: 'Beef, ribeye, steak, boneless, choice, raw', category: 'proteins' },
  { fdcId: 168330, name: 'Pork, bacon, raw', category: 'proteins' },

  // Proteins - Seafood
  { fdcId: 175167, name: 'Fish, salmon, Atlantic, farmed, raw', category: 'seafood' },
  { fdcId: 173706, name: 'Fish, tuna, fresh, bluefin, raw', category: 'seafood' },
  { fdcId: 175179, name: 'Crustaceans, shrimp, raw', category: 'seafood' },
  { fdcId: 175176, name: 'Fish, tilapia, raw', category: 'seafood' },
  { fdcId: 171955, name: 'Fish, cod, Atlantic, raw', category: 'seafood' },

  // Dairy
  { fdcId: 746782, name: 'Milk, whole, 3.25% milkfat', category: 'dairy' },
  { fdcId: 746778, name: 'Milk, reduced fat, 2%', category: 'dairy' },
  { fdcId: 746780, name: 'Milk, nonfat, fluid', category: 'dairy' },
  { fdcId: 170903, name: 'Yogurt, Greek, plain, lowfat', category: 'dairy' },
  { fdcId: 328637, name: 'Cheese, cheddar', category: 'dairy' },
  { fdcId: 171242, name: 'Cheese, mozzarella, part skim', category: 'dairy' },
  { fdcId: 170846, name: 'Cheese, cottage, lowfat, 1%', category: 'dairy' },
  { fdcId: 789828, name: 'Butter, stick, unsalted', category: 'dairy' },

  // Eggs
  { fdcId: 171287, name: 'Egg, whole, raw, fresh', category: 'eggs' },
  { fdcId: 172183, name: 'Egg, white, raw, fresh', category: 'eggs' },
  { fdcId: 172184, name: 'Egg, yolk, raw, fresh', category: 'eggs' },

  // Grains
  { fdcId: 169756, name: 'Rice, white, long-grain, cooked', category: 'grains' },
  { fdcId: 169704, name: 'Rice, brown, long-grain, cooked', category: 'grains' },
  { fdcId: 167532, name: 'Bread, white wheat', category: 'grains' },
  { fdcId: 168013, name: 'Bread, whole-wheat', category: 'grains' },
  { fdcId: 169751, name: 'Pasta, cooked, enriched', category: 'grains' },
  { fdcId: 173904, name: 'Cereals, oats, instant, cooked', category: 'grains' },
  { fdcId: 168917, name: 'Quinoa, cooked', category: 'grains' },

  // Legumes & Nuts
  { fdcId: 173735, name: 'Beans, black, mature seeds, cooked', category: 'legumes' },
  { fdcId: 173756, name: 'Chickpeas, mature seeds, cooked', category: 'legumes' },
  { fdcId: 172420, name: 'Lentils, mature seeds, cooked', category: 'legumes' },
  { fdcId: 172470, name: 'Peanut butter, smooth style', category: 'nuts' },
  { fdcId: 2346393, name: 'Nuts, almonds, whole, raw', category: 'nuts' },
  { fdcId: 2346394, name: 'Nuts, walnuts, English, halves, raw', category: 'nuts' },

  // Oils & Fats
  { fdcId: 171413, name: 'Oil, olive, extra virgin', category: 'oils' },
  { fdcId: 171412, name: 'Oil, coconut', category: 'oils' },
  { fdcId: 171025, name: 'Oil, vegetable, canola', category: 'oils' },

  // Common Prepared Foods
  { fdcId: 170112, name: 'Potatoes, baked, flesh and skin', category: 'prepared' },
  { fdcId: 168483, name: 'Sweet potato, cooked, baked', category: 'prepared' },
];

export const SEED_CATEGORIES = [
  'fruits',
  'vegetables', 
  'proteins',
  'seafood',
  'dairy',
  'eggs',
  'grains',
  'legumes',
  'nuts',
  'oils',
  'prepared',
] as const;

export type SeedCategory = typeof SEED_CATEGORIES[number];

export function getFoodsByCategory(category: SeedCategory): SeedFood[] {
  return COMMON_FOODS.filter(f => f.category === category);
}

export function getAllFdcIds(): number[] {
  return COMMON_FOODS.map(f => f.fdcId);
}
