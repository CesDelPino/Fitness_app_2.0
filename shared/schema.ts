/**
 * Shared Schema Types
 * 
 * Pure Zod schemas for TypeScript type generation and validation.
 * Actual database tables are defined in Supabase migrations.
 * 
 * Migrated from Drizzle ORM to pure Zod (December 2025)
 */

import { z } from "zod";

export const insertFoodLogSchema = z.object({
  userId: z.string(),
  foodName: z.string(),
  quantityValue: z.number(),
  quantityUnit: z.string(),
  calories: z.number().int(),
  proteinG: z.number().nullable().optional(),
  carbsG: z.number().nullable().optional(),
  fatG: z.number().nullable().optional(),
  fiberG: z.number().nullable().optional(),
  sugarG: z.number().nullable().optional(),
  caloriesPerUnit: z.number().nullable().optional(),
  proteinPerUnit: z.number().nullable().optional(),
  carbsPerUnit: z.number().nullable().optional(),
  fatPerUnit: z.number().nullable().optional(),
  micronutrientsDump: z.any().nullable().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  breaksFast: z.boolean().optional(),
  barcode: z.string().nullable().optional(),
  loggedAt: z.string().datetime().optional(),
  mealCaptureId: z.string().nullable().optional(),
  foodItemId: z.string().nullable().optional(),
  nutrientSnapshot: z.any().nullable().optional(),
});

export const foodLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  timestamp: z.string().or(z.date()),
  foodName: z.string(),
  quantityValue: z.number(),
  quantityUnit: z.string(),
  calories: z.number().int(),
  proteinG: z.number().nullable(),
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
  fiberG: z.number().nullable(),
  sugarG: z.number().nullable(),
  caloriesPerUnit: z.number().nullable(),
  proteinPerUnit: z.number().nullable(),
  carbsPerUnit: z.number().nullable(),
  fatPerUnit: z.number().nullable(),
  micronutrientsDump: z.any().nullable(),
  mealType: z.string().nullable(),
  breaksFast: z.boolean().nullable(),
  barcode: z.string().nullable(),
  mealCaptureId: z.string().nullable(),
  foodItemId: z.string().nullable(),
  nutrientSnapshot: z.any().nullable(),
});

export const insertWeighInSchema = z.object({
  userId: z.string(),
  date: z.string(),
  weightKg: z.number(),
  notes: z.string().nullable().optional(),
  waistCm: z.number().nullable().optional(),
  hipsCm: z.number().nullable().optional(),
  bustChestCm: z.number().nullable().optional(),
  thighCm: z.number().nullable().optional(),
  armCm: z.number().nullable().optional(),
  calfCm: z.number().nullable().optional(),
  neckCm: z.number().nullable().optional(),
});

export const weighInSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string(),
  weightKg: z.number(),
  notes: z.string().nullable(),
  waistCm: z.number().nullable(),
  hipsCm: z.number().nullable(),
  bustChestCm: z.number().nullable(),
  thighCm: z.number().nullable(),
  armCm: z.number().nullable(),
  calfCm: z.number().nullable(),
  neckCm: z.number().nullable(),
  createdAt: z.string().or(z.date()),
});

export const insertFastSchema = z.object({
  userId: z.string(),
  startTime: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return new Date();
    return typeof val === "string" ? new Date(val) : val;
  }),
  endTime: z.union([z.string(), z.date()]).transform((val) => {
    return typeof val === "string" ? new Date(val) : val;
  }),
  actualEndTime: z.union([z.string(), z.date()]).nullable().optional(),
  status: z.enum(["active", "ended"]).default("active"),
  breakingFoodLogId: z.string().nullable().optional(),
  plannedDurationMinutes: z.number().int().nullable().optional(),
  fastMode: z.enum(["duration", "target_time"]).optional(),
});

export const fastSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  actualEndTime: z.string().or(z.date()).nullable(),
  status: z.enum(["active", "ended"]),
  breakingFoodLogId: z.string().nullable(),
  plannedDurationMinutes: z.number().int().nullable(),
  fastMode: z.enum(["duration", "target_time"]).nullable(),
});

export const insertDailySummarySchema = z.object({
  userId: z.string(),
  date: z.string(),
  finalized: z.boolean().default(true),
  totalCalories: z.number().int(),
  totalProteinG: z.number(),
  totalCarbsG: z.number(),
  totalFatG: z.number(),
});

export const dailySummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string(),
  finalized: z.boolean(),
  finalizedAt: z.string().or(z.date()),
  totalCalories: z.number().int(),
  totalProteinG: z.number(),
  totalCarbsG: z.number(),
  totalFatG: z.number(),
});

export const insertWorkoutRoutineSchema = z.object({
  userId: z.string(),
  name: z.string(),
  type: z.enum(["strength_traditional", "strength_circuit", "cardio", "other"]),
  archived: z.boolean().default(false).optional(),
});

export const workoutRoutineSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  type: z.string(),
  createdAt: z.string().or(z.date()),
  lastUsedAt: z.string().or(z.date()).nullable(),
  archived: z.boolean(),
});

export const insertRoutineExerciseSchema = z.object({
  routineId: z.string(),
  exerciseName: z.string(),
  orderIndex: z.number().int(),
  targetSets: z.number().int().nullable().optional(),
  targetReps: z.number().int().nullable().optional(),
});

export const routineExerciseSchema = z.object({
  id: z.string(),
  routineId: z.string(),
  exerciseName: z.string(),
  orderIndex: z.number().int(),
  targetSets: z.number().int().nullable(),
  targetReps: z.number().int().nullable(),
});

export const insertWorkoutSessionSchema = z.object({
  userId: z.string(),
  date: z.string(),
  routineId: z.string().nullable().optional(),
  routineName: z.string().nullable().optional(),
  workoutType: z.enum(["strength_traditional", "strength_circuit", "cardio", "other"]),
  durationMinutes: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  activityName: z.string().nullable().optional(),
  intensity: z.number().int().nullable().optional(),
  caloriesBurned: z.number().int().nullable().optional(),
});

export const workoutSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string(),
  routineId: z.string().nullable(),
  routineName: z.string().nullable(),
  workoutType: z.string(),
  durationMinutes: z.number().int().nullable(),
  notes: z.string().nullable(),
  activityName: z.string().nullable(),
  intensity: z.number().int().nullable(),
  caloriesBurned: z.number().int().nullable(),
  createdAt: z.string().or(z.date()),
});

export const insertWorkoutSetSchema = z.object({
  sessionId: z.string(),
  exerciseName: z.string(),
  exerciseId: z.string().nullable().optional(),
  setNumber: z.number().int(),
  reps: z.number().int(),
  weight: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const workoutSetSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  exerciseName: z.string(),
  exerciseId: z.string().nullable(),
  setNumber: z.number().int(),
  reps: z.number().int(),
  weight: z.number().nullable(),
  notes: z.string().nullable(),
});

export const insertCardioActivitySchema = z.object({
  name: z.string(),
  baseMET: z.number(),
  category: z.string(),
});

export const cardioActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  baseMET: z.number(),
  category: z.string(),
});

export const insertUserCustomActivitySchema = z.object({
  userId: z.string(),
  activityName: z.string(),
  estimatedMET: z.number(),
});

export const userCustomActivitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  activityName: z.string(),
  estimatedMET: z.number(),
  createdAt: z.string().or(z.date()),
});

export const insertFoodSchema = z.object({
  canonicalName: z.string(),
  brand: z.string().nullable().optional(),
  source: z.enum(["barcode", "ai_text", "ai_image", "manual", "imported"]),
  verificationStatus: z.enum(["verified", "user_contributed", "pending"]).default("pending"),
  caloriesPer100g: z.number().nullable().optional(),
  proteinPer100g: z.number().nullable().optional(),
  carbsPer100g: z.number().nullable().optional(),
  fatPer100g: z.number().nullable().optional(),
  fiberPer100g: z.number().nullable().optional(),
  sugarPer100g: z.number().nullable().optional(),
  defaultServingSize: z.string().nullable().optional(),
  defaultServingGrams: z.number().nullable().optional(),
  caloriesPerServing: z.number().nullable().optional(),
  proteinPerServing: z.number().nullable().optional(),
  carbsPerServing: z.number().nullable().optional(),
  fatPerServing: z.number().nullable().optional(),
});

export const foodSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  brand: z.string().nullable(),
  source: z.enum(["barcode", "ai_text", "ai_image", "manual", "imported"]),
  verificationStatus: z.enum(["verified", "user_contributed", "pending"]),
  caloriesPer100g: z.number().nullable(),
  proteinPer100g: z.number().nullable(),
  carbsPer100g: z.number().nullable(),
  fatPer100g: z.number().nullable(),
  fiberPer100g: z.number().nullable(),
  sugarPer100g: z.number().nullable(),
  defaultServingSize: z.string().nullable(),
  defaultServingGrams: z.number().nullable(),
  caloriesPerServing: z.number().nullable(),
  proteinPerServing: z.number().nullable(),
  carbsPerServing: z.number().nullable(),
  fatPerServing: z.number().nullable(),
  timesUsed: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertFoodBarcodeSchema = z.object({
  foodId: z.string(),
  barcode: z.string(),
});

export const foodBarcodeSchema = z.object({
  id: z.string(),
  foodId: z.string(),
  barcode: z.string(),
  createdAt: z.string().or(z.date()),
});

export const insertFoodAliasSchema = z.object({
  foodId: z.string(),
  aliasText: z.string(),
  normalizedText: z.string(),
});

export const foodAliasSchema = z.object({
  id: z.string(),
  foodId: z.string(),
  aliasText: z.string(),
  normalizedText: z.string(),
  createdAt: z.string().or(z.date()),
});

// ============================================
// FDA NUTRITION SYSTEM - Phase 1 Types
// ============================================

export const nutrientGroupEnum = z.enum(['macro', 'mineral', 'vitamin', 'lipid', 'other']);
export const dataSourceEnum = z.enum(['fda_foundation', 'fda_sr_legacy', 'fda_branded', 'openfoodfacts', 'user_manual']);
export const captureTypeEnum = z.enum(['photo', 'manual', 'barcode', 'text']);

export const nutrientDefinitionSchema = z.object({
  id: z.string(),
  fdcNutrientId: z.number().int(),
  name: z.string(),
  unit: z.string(),
  nutrientGroup: nutrientGroupEnum,
  displayOrder: z.number().int(),
  isCoreMacro: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const insertNutrientDefinitionSchema = z.object({
  fdcNutrientId: z.number().int(),
  name: z.string(),
  unit: z.string(),
  nutrientGroup: nutrientGroupEnum.default('other'),
  displayOrder: z.number().int().default(999),
  isCoreMacro: z.boolean().default(false),
});

export const foodItemSchema = z.object({
  id: z.string(),
  fdcId: z.number().int().nullable(),
  description: z.string(),
  brandName: z.string().nullable(),
  dataType: dataSourceEnum,
  gtinUpc: z.string().nullable(),
  servingSizeDescription: z.string().nullable(),
  servingSizeGrams: z.number().nullable(),
  householdServingText: z.string().nullable(),
  fdcPublishedDate: z.string().nullable(),
  fetchTimestamp: z.string().or(z.date()).nullable(),
  confidenceScore: z.number().nullable(),
  timesUsed: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertFoodItemSchema = z.object({
  fdcId: z.number().int().nullable().optional(),
  description: z.string(),
  brandName: z.string().nullable().optional(),
  dataType: dataSourceEnum,
  gtinUpc: z.string().nullable().optional(),
  servingSizeDescription: z.string().nullable().optional(),
  servingSizeGrams: z.number().nullable().optional(),
  householdServingText: z.string().nullable().optional(),
  fdcPublishedDate: z.string().nullable().optional(),
  fetchTimestamp: z.string().nullable().optional(),
  confidenceScore: z.number().nullable().optional(),
});

export const foodItemNutrientSchema = z.object({
  id: z.string(),
  foodItemId: z.string(),
  nutrientId: z.string(),
  amountPer100g: z.number().nullable(),
  amountPerServing: z.number().nullable(),
  createdAt: z.string().or(z.date()),
});

export const insertFoodItemNutrientSchema = z.object({
  foodItemId: z.string(),
  nutrientId: z.string(),
  amountPer100g: z.number().nullable().optional(),
  amountPerServing: z.number().nullable().optional(),
});

export const foodItemPortionSchema = z.object({
  id: z.string(),
  foodItemId: z.string(),
  sourcePortionId: z.string().nullable(),
  description: z.string(),
  amount: z.number().nullable(),
  gramWeight: z.number().nullable(),
  unit: z.string().nullable(),
  sequence: z.number().int().nullable(),
  modifier: z.string().nullable(),
  isDefault: z.boolean(),
  dataSource: dataSourceEnum,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertFoodItemPortionSchema = z.object({
  foodItemId: z.string(),
  sourcePortionId: z.string().nullable().optional(),
  description: z.string(),
  amount: z.number().nullable().optional(),
  gramWeight: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  sequence: z.number().int().nullable().optional(),
  modifier: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
  dataSource: dataSourceEnum.default('fda_foundation'),
});

export const mealCaptureSchema = z.object({
  id: z.string(),
  userId: z.string(),
  captureType: captureTypeEnum,
  rawAiResponse: z.any().nullable(),
  imagePath: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});

export const insertMealCaptureSchema = z.object({
  userId: z.string(),
  captureType: captureTypeEnum,
  rawAiResponse: z.any().nullable().optional(),
  imagePath: z.string().nullable().optional(),
});

export const featureSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const insertFeatureSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const subscriptionPlanSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  priceMonthly: z.number().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const insertSubscriptionPlanSchema = z.object({
  code: z.string(),
  name: z.string(),
  priceMonthly: z.number().nullable().optional(),
  isDefault: z.boolean().default(false),
});

export const planFeatureSchema = z.object({
  id: z.string(),
  planId: z.string(),
  featureId: z.string(),
  createdAt: z.string().or(z.date()),
});

export const insertPlanFeatureSchema = z.object({
  planId: z.string(),
  featureId: z.string(),
});

export const userFeatureOverrideSchema = z.object({
  id: z.string(),
  userId: z.string(),
  featureId: z.string(),
  isEnabled: z.boolean(),
  reason: z.string().nullable(),
  expiresAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
});

export const insertUserFeatureOverrideSchema = z.object({
  userId: z.string(),
  featureId: z.string(),
  isEnabled: z.boolean(),
  reason: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;
export type FoodLog = z.infer<typeof foodLogSchema>;
export type InsertWeighIn = z.infer<typeof insertWeighInSchema>;
export type WeighIn = z.infer<typeof weighInSchema>;
export type InsertFast = z.infer<typeof insertFastSchema>;
export type Fast = z.infer<typeof fastSchema>;
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
export type DailySummary = z.infer<typeof dailySummarySchema>;
export type InsertWorkoutRoutine = z.infer<typeof insertWorkoutRoutineSchema>;
export type WorkoutRoutine = z.infer<typeof workoutRoutineSchema>;
export type InsertRoutineExercise = z.infer<typeof insertRoutineExerciseSchema>;
export type RoutineExercise = z.infer<typeof routineExerciseSchema>;
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type WorkoutSet = z.infer<typeof workoutSetSchema>;
export type InsertCardioActivity = z.infer<typeof insertCardioActivitySchema>;
export type CardioActivity = z.infer<typeof cardioActivitySchema>;
export type InsertUserCustomActivity = z.infer<typeof insertUserCustomActivitySchema>;
export type UserCustomActivity = z.infer<typeof userCustomActivitySchema>;
export type InsertFood = z.infer<typeof insertFoodSchema>;
export type Food = z.infer<typeof foodSchema>;
export type InsertFoodBarcode = z.infer<typeof insertFoodBarcodeSchema>;
export type FoodBarcode = z.infer<typeof foodBarcodeSchema>;
export type InsertFoodAlias = z.infer<typeof insertFoodAliasSchema>;
export type FoodAlias = z.infer<typeof foodAliasSchema>;

// FDA Nutrition System - Phase 1 Types
export type NutrientGroup = z.infer<typeof nutrientGroupEnum>;
export type DataSource = z.infer<typeof dataSourceEnum>;
export type CaptureType = z.infer<typeof captureTypeEnum>;
export type InsertNutrientDefinition = z.infer<typeof insertNutrientDefinitionSchema>;
export type NutrientDefinition = z.infer<typeof nutrientDefinitionSchema>;
export type InsertFoodItem = z.infer<typeof insertFoodItemSchema>;
export type FoodItem = z.infer<typeof foodItemSchema>;
export type InsertFoodItemNutrient = z.infer<typeof insertFoodItemNutrientSchema>;
export type FoodItemNutrient = z.infer<typeof foodItemNutrientSchema>;
export type InsertFoodItemPortion = z.infer<typeof insertFoodItemPortionSchema>;
export type FoodItemPortion = z.infer<typeof foodItemPortionSchema>;
export type InsertMealCapture = z.infer<typeof insertMealCaptureSchema>;
export type MealCapture = z.infer<typeof mealCaptureSchema>;
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
export type Feature = z.infer<typeof featureSchema>;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;
export type PlanFeature = z.infer<typeof planFeatureSchema>;
export type InsertUserFeatureOverride = z.infer<typeof insertUserFeatureOverrideSchema>;
export type UserFeatureOverride = z.infer<typeof userFeatureOverrideSchema>;

// Stripe Subscription Schemas - Phase 1 Payment System
export const subscriptionStatusEnum = z.enum([
  'trialing',
  'active', 
  'past_due',
  'canceled',
  'unpaid',
  'incomplete'
]);

export const userSubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  status: subscriptionStatusEnum,
  currentPeriodStart: z.string().or(z.date()).nullable(),
  currentPeriodEnd: z.string().or(z.date()).nullable(),
  trialStart: z.string().or(z.date()).nullable(),
  trialEnd: z.string().or(z.date()).nullable(),
  cancelAt: z.string().or(z.date()).nullable(),
  canceledAt: z.string().or(z.date()).nullable(),
  gracePeriodEnd: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertUserSubscriptionSchema = z.object({
  userId: z.string(),
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  status: subscriptionStatusEnum.default('active'),
  currentPeriodStart: z.string().nullable().optional(),
  currentPeriodEnd: z.string().nullable().optional(),
  trialStart: z.string().nullable().optional(),
  trialEnd: z.string().nullable().optional(),
});

export const discountTypeEnum = z.enum(['percent', 'amount']);

export const promoCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  stripeCouponId: z.string().nullable(),
  discountType: discountTypeEnum,
  discountValue: z.number(),
  maxRedemptions: z.number().nullable(),
  redemptionCount: z.number(),
  firstTimeOnly: z.boolean(),
  expiresAt: z.string().or(z.date()).nullable(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  createdBy: z.string().nullable(),
});

export const insertPromoCodeSchema = z.object({
  code: z.string().min(3).max(20),
  stripeCouponId: z.string().nullable().optional(),
  discountType: discountTypeEnum,
  discountValue: z.number().positive(),
  maxRedemptions: z.number().positive().nullable().optional(),
  firstTimeOnly: z.boolean().default(false),
  expiresAt: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
});

export const trialHistorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  trialStartedAt: z.string().or(z.date()),
  trialEndedAt: z.string().or(z.date()).nullable(),
  convertedToPaid: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const insertTrialHistorySchema = z.object({
  userId: z.string(),
  trialStartedAt: z.string().optional(),
  convertedToPaid: z.boolean().default(false),
});

export type SubscriptionStatus = z.infer<typeof subscriptionStatusEnum>;
export type DiscountType = z.infer<typeof discountTypeEnum>;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = z.infer<typeof userSubscriptionSchema>;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = z.infer<typeof promoCodeSchema>;
export type InsertTrialHistory = z.infer<typeof insertTrialHistorySchema>;
export type TrialHistory = z.infer<typeof trialHistorySchema>;

// Phase 3: Marketplace Products & Payments

export const productTypeEnum = z.enum(['one_time', 'subscription', 'package', 'free']);
export const productStatusEnum = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'archived']);
export const purchaseStatusEnum = z.enum(['pending', 'requires_action', 'completed', 'refunded', 'canceled']);
export const billingIntervalEnum = z.enum(['day', 'week', 'month', 'year']);

export const trainerProductSchema = z.object({
  id: z.string(),
  trainerId: z.string(),
  stripeProductId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  productType: productTypeEnum,
  status: productStatusEnum,
  rejectionReason: z.string().nullable(),
  mediaUrls: z.array(z.string()),
  featuresIncluded: z.array(z.string()),
  publishAt: z.string().or(z.date()).nullable(),
  submittedAt: z.string().or(z.date()).nullable(),
  approvedAt: z.string().or(z.date()).nullable(),
  approvedBy: z.string().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertTrainerProductSchema = z.object({
  trainerId: z.string(),
  name: z.string().min(3).max(100),
  description: z.string().max(2000).nullable().optional(),
  productType: productTypeEnum,
  mediaUrls: z.array(z.string()).optional(),
  featuresIncluded: z.array(z.string()).optional(),
});

export const updateTrainerProductSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  mediaUrls: z.array(z.string()).optional(),
  featuresIncluded: z.array(z.string()).optional(),
});

export const productPricingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  stripePriceId: z.string().nullable(),
  amountCents: z.number().int().min(0),
  currency: z.string(),
  billingInterval: billingIntervalEnum.nullable(),
  intervalCount: z.number().int().min(1).nullable(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertProductPricingSchema = z.object({
  productId: z.string(),
  amountCents: z.number().int().min(0),
  currency: z.string().default('usd'),
  billingInterval: billingIntervalEnum.nullable().optional(),
  intervalCount: z.number().int().min(1).nullable().optional(),
  isPrimary: z.boolean().default(false),
});

export const productPurchaseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  pricingId: z.string().nullable(),
  clientId: z.string(),
  trainerId: z.string(),
  stripeCheckoutSessionId: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  amountTotalCents: z.number().int(),
  platformFeeCents: z.number().int(),
  currency: z.string(),
  status: purchaseStatusEnum,
  purchasedAt: z.string().or(z.date()),
  fulfilledAt: z.string().or(z.date()).nullable(),
  frozenAt: z.string().or(z.date()).nullable(),
  refundedAt: z.string().or(z.date()).nullable(),
  refundReason: z.string().nullable(),
  accessExpiresAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertProductPurchaseSchema = z.object({
  productId: z.string(),
  pricingId: z.string().nullable().optional(),
  clientId: z.string(),
  trainerId: z.string(),
  stripeCheckoutSessionId: z.string().nullable().optional(),
  stripePaymentIntentId: z.string().nullable().optional(),
  amountTotalCents: z.number().int(),
  currency: z.string().default('usd'),
});

export const purchaseAccessSchema = z.object({
  purchaseId: z.string(),
  clientId: z.string(),
  trainerId: z.string(),
  productId: z.string(),
  productName: z.string(),
  productType: productTypeEnum,
  purchaseStatus: purchaseStatusEnum,
  purchasedAt: z.string().or(z.date()),
  fulfilledAt: z.string().or(z.date()).nullable(),
  frozenAt: z.string().or(z.date()).nullable(),
  accessExpiresAt: z.string().or(z.date()).nullable(),
  hasAccess: z.boolean(),
});

export type ProductType = z.infer<typeof productTypeEnum>;
export type ProductStatus = z.infer<typeof productStatusEnum>;
export type PurchaseStatus = z.infer<typeof purchaseStatusEnum>;
export type BillingInterval = z.infer<typeof billingIntervalEnum>;
export type TrainerProduct = z.infer<typeof trainerProductSchema>;
export type InsertTrainerProduct = z.infer<typeof insertTrainerProductSchema>;
export type UpdateTrainerProduct = z.infer<typeof updateTrainerProductSchema>;
export type ProductPricing = z.infer<typeof productPricingSchema>;
export type InsertProductPricing = z.infer<typeof insertProductPricingSchema>;
export type ProductPurchase = z.infer<typeof productPurchaseSchema>;
export type InsertProductPurchase = z.infer<typeof insertProductPurchaseSchema>;
export type PurchaseAccess = z.infer<typeof purchaseAccessSchema>;

// Phase 4: Trainer Storefronts

export const trainerStorefrontSchema = z.object({
  id: z.string(),
  trainerId: z.string(),
  slug: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  specialties: z.array(z.string()),
  credentials: z.array(z.string()),
  experienceYears: z.number().int().nullable(),
  isPublished: z.boolean(),
  publishedAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const insertTrainerStorefrontSchema = z.object({
  trainerId: z.string(),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  headline: z.string().max(100).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  specialties: z.array(z.string()).optional(),
  credentials: z.array(z.string()).optional(),
  experienceYears: z.number().int().min(0).max(50).nullable().optional(),
});

export const updateTrainerStorefrontSchema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase letters, numbers, and hyphens').optional(),
  headline: z.string().max(100).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  specialties: z.array(z.string()).optional(),
  credentials: z.array(z.string()).optional(),
  experienceYears: z.number().int().min(0).max(50).nullable().optional(),
  isPublished: z.boolean().optional(),
  locationCity: z.string().max(100).nullable().optional(),
  locationState: z.string().max(100).nullable().optional(),
  locationCountry: z.string().max(100).nullable().optional(),
});

export const storefrontWithProductsSchema = trainerStorefrontSchema.extend({
  trainerName: z.string(),
  trainerPhotoPath: z.string().nullable(),
  trainerPresetAvatarId: z.string().nullable(),
  trainerRole: z.string(),
  approvedProductsCount: z.number().int(),
});

export type TrainerStorefront = z.infer<typeof trainerStorefrontSchema>;
export type InsertTrainerStorefront = z.infer<typeof insertTrainerStorefrontSchema>;
export type UpdateTrainerStorefront = z.infer<typeof updateTrainerStorefrontSchema>;
export type StorefrontWithProducts = z.infer<typeof storefrontWithProductsSchema>;

// Phase 5: Marketplace Analytics

export const marketplaceGmvMetricsSchema = z.object({
  totalCompletedPurchases: z.number().int(),
  totalRefundedPurchases: z.number().int(),
  totalPendingPurchases: z.number().int(),
  totalGmvCents: z.number().int(),
  totalRefundedCents: z.number().int(),
  totalPlatformFeesCents: z.number().int(),
  totalTrainerEarningsCents: z.number().int(),
  uniquePayingClients: z.number().int(),
  trainersWithSales: z.number().int(),
  productsWithSales: z.number().int(),
});

export const gmvDailySchema = z.object({
  purchaseDate: z.string(),
  completedCount: z.number().int(),
  refundedCount: z.number().int(),
  gmvCents: z.number().int(),
  refundedCents: z.number().int(),
  platformFeesCents: z.number().int(),
  uniqueClients: z.number().int(),
});

export const trainerEarningsSummarySchema = z.object({
  trainerId: z.string(),
  trainerName: z.string().nullable(),
  totalSales: z.number().int(),
  totalRefunds: z.number().int(),
  totalRevenueCents: z.number().int(),
  totalEarningsCents: z.number().int(),
  totalRefundedCents: z.number().int(),
  uniqueClients: z.number().int(),
  productsSold: z.number().int(),
  firstSaleAt: z.string().or(z.date()).nullable(),
  lastSaleAt: z.string().or(z.date()).nullable(),
});

export const productSalesMetricsSchema = z.object({
  productId: z.string(),
  trainerId: z.string(),
  productName: z.string(),
  productType: productTypeEnum,
  productStatus: productStatusEnum,
  trainerName: z.string().nullable(),
  totalSales: z.number().int(),
  totalRefunds: z.number().int(),
  totalRevenueCents: z.number().int(),
  uniqueBuyers: z.number().int(),
  lastSaleAt: z.string().or(z.date()).nullable(),
});

export const recentPurchaseAdminSchema = z.object({
  purchaseId: z.string(),
  productId: z.string(),
  productName: z.string(),
  productType: productTypeEnum,
  clientId: z.string(),
  clientName: z.string().nullable(),
  trainerId: z.string(),
  trainerName: z.string().nullable(),
  amountTotalCents: z.number().int(),
  platformFeeCents: z.number().int(),
  currency: z.string(),
  status: purchaseStatusEnum,
  purchasedAt: z.string().or(z.date()),
  fulfilledAt: z.string().or(z.date()).nullable(),
  frozenAt: z.string().or(z.date()).nullable(),
  refundedAt: z.string().or(z.date()).nullable(),
  refundReason: z.string().nullable(),
  stripeCheckoutSessionId: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
});

export const checkoutAbandonmentMetricsSchema = z.object({
  totalSessions: z.number().int(),
  completedSessions: z.number().int(),
  abandonedSessions: z.number().int(),
  pendingSessions: z.number().int(),
  completionRatePercent: z.number().nullable(),
  completedRevenueCents: z.number().int(),
  abandonedRevenueCents: z.number().int(),
});

export const webhookEventSummarySchema = z.object({
  eventType: z.string(),
  totalEvents: z.number().int(),
  processedCount: z.number().int(),
  pendingCount: z.number().int(),
  lastEventAt: z.string().or(z.date()).nullable(),
});

export type MarketplaceGmvMetrics = z.infer<typeof marketplaceGmvMetricsSchema>;
export type GmvDaily = z.infer<typeof gmvDailySchema>;
export type TrainerEarningsSummary = z.infer<typeof trainerEarningsSummarySchema>;
export type ProductSalesMetrics = z.infer<typeof productSalesMetricsSchema>;
export type RecentPurchaseAdmin = z.infer<typeof recentPurchaseAdminSchema>;
export type CheckoutAbandonmentMetrics = z.infer<typeof checkoutAbandonmentMetricsSchema>;
export type WebhookEventSummary = z.infer<typeof webhookEventSummarySchema>;

// ============================================================================
// AI Usage Tracking (Phase 6)
// ============================================================================

export const aiFeatureCodeEnum = z.enum(['ai_photo_recognition', 'ai_workout_builder']);
export type AiFeatureCode = z.infer<typeof aiFeatureCodeEnum>;

export const aiUsageCounterSchema = z.object({
  id: z.string(),
  userId: z.string(),
  featureCode: aiFeatureCodeEnum,
  usageMonth: z.string().or(z.date()),
  usageCount: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const aiFeatureQuotaSchema = z.object({
  id: z.string(),
  featureCode: aiFeatureCodeEnum,
  monthlyLimit: z.number().int(),
  isActive: z.boolean(),
  description: z.string().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const aiUsageStatusSchema = z.object({
  featureCode: z.string(),
  usageCount: z.number().int(),
  monthlyLimit: z.number().int(),
  remaining: z.number().int(),
  usagePercent: z.number(),
  resetDate: z.string().or(z.date()),
});

export const incrementUsageResultSchema = z.object({
  success: z.boolean(),
  currentCount: z.number().int(),
  limit: z.number().int(),
  remaining: z.number().int(),
  error: z.string().optional(),
});

export const activeAiProgramSchema = z.object({
  id: z.string(),
  userId: z.string(),
  blueprintId: z.string(),
  activatedAt: z.string().or(z.date()),
  isActive: z.boolean(),
  deactivatedAt: z.string().or(z.date()).nullable(),
});

export type AiUsageCounter = z.infer<typeof aiUsageCounterSchema>;
export type AiFeatureQuota = z.infer<typeof aiFeatureQuotaSchema>;
export type AiUsageStatus = z.infer<typeof aiUsageStatusSchema>;
export type IncrementUsageResult = z.infer<typeof incrementUsageResultSchema>;
export type ActiveAiProgram = z.infer<typeof activeAiProgramSchema>;

// ============================================================================
// Teaser Messaging (Phase 7)
// ============================================================================

export const teaserMessageUsageSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  trainerId: z.string(),
  clientMessagesSent: z.number().int(),
  trainerMessagesSent: z.number().int(),
  clientLastMessageAt: z.string().or(z.date()).nullable(),
  trainerLastMessageAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const teaserUsageStatusSchema = z.object({
  isPremium: z.boolean(),
  clientMessagesSent: z.number().int(),
  clientLimit: z.number().int(),
  clientRemaining: z.number().int(),
  trainerMessagesSent: z.number().int(),
  trainerLimit: z.number().int(),
  trainerRemaining: z.number().int(),
  isClientBlocked: z.boolean(),
  isTrainerBlocked: z.boolean(),
  error: z.string().optional(),
});

export const incrementTeaserResultSchema = z.object({
  success: z.boolean(),
  messagesSent: z.number().int(),
  limit: z.number().int(),
  remaining: z.number().int(),
  bypassed: z.boolean(),
  error: z.string().optional(),
});

export type TeaserMessageUsage = z.infer<typeof teaserMessageUsageSchema>;
export type TeaserUsageStatus = z.infer<typeof teaserUsageStatusSchema>;
export type IncrementTeaserResult = z.infer<typeof incrementTeaserResultSchema>;
