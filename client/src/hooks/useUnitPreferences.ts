import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  WeightUnit,
  MeasurementUnit,
  FoodWeightUnit,
  DistanceUnit,
  VolumeUnit,
  UnitPreferences,
  DEFAULT_UNIT_PREFERENCES,
  formatWeight,
  formatMeasurement,
  formatFoodWeight,
  formatDistance,
  formatVolume,
  convertMeasurement,
  convertFoodWeight,
  convertDistance,
  cmToInches,
  inchesToCm,
  gramsToOz,
  ozToGrams,
  kmToMiles,
  milesToKm,
  kgToLbs,
  lbsToKg,
} from "@shared/units";

/**
 * Hook to access all unit preferences from the user's profile.
 * Each domain has its own preference that can be set independently.
 */
export function useUnitPreferences() {
  const { profile, isLoading } = useSupabaseAuth();
  
  const isReady = !isLoading && profile !== null;

  // Get unit preferences from profile, falling back to defaults
  const preferences: UnitPreferences = {
    bodyWeight: (profile?.unit_body_weight as WeightUnit) || 
      (profile?.preferred_unit_system === 'imperial' ? 'lbs' : 'kg'),
    bodyMeasurements: (profile?.unit_body_measurements as MeasurementUnit) || 
      (profile?.preferred_unit_system === 'imperial' ? 'in' : 'cm'),
    exerciseWeight: (profile?.unit_exercise_weight as WeightUnit) || 
      (profile?.preferred_unit_system === 'imperial' ? 'lbs' : 'kg'),
    cardioDistance: (profile?.unit_cardio_distance as DistanceUnit) || 
      (profile?.preferred_unit_system === 'imperial' ? 'mi' : 'km'),
    foodWeight: (profile?.unit_food_weight as FoodWeightUnit) || 
      (profile?.preferred_unit_system === 'imperial' ? 'oz' : 'g'),
    foodVolume: (profile?.unit_food_volume as VolumeUnit) || 
      (profile?.preferred_unit_system === 'imperial' ? 'fl_oz' : 'ml'),
  };

  // Body Weight helpers
  const bodyWeight = {
    unit: preferences.bodyWeight,
    isMetric: preferences.bodyWeight === 'kg',
    format: (valueKg: number | null | undefined) => formatWeight(valueKg, preferences.bodyWeight),
    toKg: (value: number) => preferences.bodyWeight === 'kg' ? value : lbsToKg(value),
    fromKg: (valueKg: number) => preferences.bodyWeight === 'kg' ? valueKg : kgToLbs(valueKg),
  };

  // Body Measurements helpers
  const bodyMeasurements = {
    unit: preferences.bodyMeasurements,
    isMetric: preferences.bodyMeasurements === 'cm',
    format: (valueCm: number | null | undefined) => formatMeasurement(valueCm, preferences.bodyMeasurements),
    toCm: (value: number) => preferences.bodyMeasurements === 'cm' ? value : inchesToCm(value),
    fromCm: (valueCm: number) => preferences.bodyMeasurements === 'cm' ? valueCm : cmToInches(valueCm),
    convert: (value: number, from: MeasurementUnit, to: MeasurementUnit) => convertMeasurement(value, from, to),
  };

  // Exercise Weight helpers
  const exerciseWeight = {
    unit: preferences.exerciseWeight,
    isMetric: preferences.exerciseWeight === 'kg',
    format: (valueKg: number | null | undefined) => formatWeight(valueKg, preferences.exerciseWeight),
    toKg: (value: number) => preferences.exerciseWeight === 'kg' ? value : lbsToKg(value),
    fromKg: (valueKg: number) => preferences.exerciseWeight === 'kg' ? valueKg : kgToLbs(valueKg),
  };

  // Cardio Distance helpers
  const cardioDistance = {
    unit: preferences.cardioDistance,
    isMetric: preferences.cardioDistance === 'km',
    format: (valueKm: number | null | undefined) => formatDistance(valueKm, preferences.cardioDistance),
    toKm: (value: number) => preferences.cardioDistance === 'km' ? value : milesToKm(value),
    fromKm: (valueKm: number) => preferences.cardioDistance === 'km' ? valueKm : kmToMiles(valueKm),
    convert: (value: number, from: DistanceUnit, to: DistanceUnit) => convertDistance(value, from, to),
  };

  // Food Weight helpers
  const foodWeight = {
    unit: preferences.foodWeight,
    isMetric: preferences.foodWeight === 'g',
    format: (grams: number | null | undefined) => formatFoodWeight(grams, preferences.foodWeight),
    toGrams: (value: number) => preferences.foodWeight === 'g' ? value : ozToGrams(value),
    fromGrams: (grams: number) => preferences.foodWeight === 'g' ? grams : gramsToOz(grams),
    convert: (value: number, from: FoodWeightUnit, to: FoodWeightUnit) => convertFoodWeight(value, from, to),
  };

  // Food Volume helpers  
  const foodVolume = {
    unit: preferences.foodVolume,
    isMetric: preferences.foodVolume === 'ml',
    format: (ml: number | null | undefined) => ml != null ? formatVolume(ml, preferences.foodVolume) : '-',
  };

  return {
    isReady,
    isLoading,
    preferences,
    bodyWeight,
    bodyMeasurements,
    exerciseWeight,
    cardioDistance,
    foodWeight,
    foodVolume,
  };
}

export type UseUnitPreferencesReturn = ReturnType<typeof useUnitPreferences>;
