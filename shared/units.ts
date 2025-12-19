export type WeightUnit = 'kg' | 'lbs';

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;

export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

export function lbsToKg(lbs: number): number {
  return lbs * LBS_TO_KG;
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? kgToLbs(value) : lbsToKg(value);
}

export function roundWeight(value: number, unit: WeightUnit): number {
  if (unit === 'kg') {
    return Math.round(value * 20) / 20;
  }
  return Math.round(value * 10) / 10;
}

export function smartRoundForDisplay(value: number, unit: WeightUnit): number {
  const rounded = roundWeight(value, unit);
  const nearestHalf = Math.round(value * 2) / 2;
  const nearestWhole = Math.round(value);
  
  if (Math.abs(value - nearestWhole) < 0.05) {
    return nearestWhole;
  }
  if (Math.abs(value - nearestHalf) < 0.05) {
    return nearestHalf;
  }
  return rounded;
}

export function formatWeight(
  valueKg: number | null | undefined,
  displayUnit: WeightUnit,
  options?: {
    precision?: number;
    showUnit?: boolean;
    enteredValue?: number;
    enteredUnit?: WeightUnit;
  }
): string {
  if (valueKg === null || valueKg === undefined) {
    return options?.showUnit ? `- ${displayUnit}` : '-';
  }

  const { precision, showUnit = true, enteredValue, enteredUnit } = options || {};

  let displayValue: number;

  if (enteredValue !== undefined && enteredUnit !== undefined && enteredUnit === displayUnit) {
    displayValue = enteredValue;
  } else {
    const converted = displayUnit === 'kg' ? valueKg : kgToLbs(valueKg);
    displayValue = smartRoundForDisplay(converted, displayUnit);
  }

  const finalPrecision = precision ?? (displayUnit === 'kg' ? 1 : 1);
  const formatted = displayValue.toFixed(finalPrecision);
  
  const cleanFormatted = parseFloat(formatted).toString();
  const displayFormatted = cleanFormatted.includes('.') ? formatted : cleanFormatted;

  return showUnit ? `${displayFormatted} ${displayUnit}` : displayFormatted;
}

export function parseWeightInput(
  input: string,
  inputUnit: WeightUnit
): { valueKg: number; enteredValue: number; enteredUnit: WeightUnit } | null {
  const parsed = parseFloat(input);
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  const valueKg = inputUnit === 'kg' ? parsed : lbsToKg(parsed);

  return {
    valueKg: Math.round(valueKg * 1000) / 1000,
    enteredValue: Math.round(parsed * 100) / 100,
    enteredUnit: inputUnit,
  };
}

export function getWeightInputStep(unit: WeightUnit): string {
  return unit === 'kg' ? '0.5' : '0.5';
}

export function getWeightPlaceholder(unit: WeightUnit): string {
  return unit === 'kg' ? 'e.g. 60' : 'e.g. 135';
}

export function getCommonWeightIncrements(unit: WeightUnit): number[] {
  if (unit === 'kg') {
    return [1.25, 2.5, 5, 10, 20];
  }
  return [2.5, 5, 10, 25, 45];
}

export type HeightUnit = 'cm' | 'ft';

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export interface HeightImperial {
  feet: number;
  inches: number;
}

export function cmToFeetInches(cm: number): HeightImperial {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round(totalInches % INCHES_PER_FOOT);
  if (inches === 12) {
    return { feet: feet + 1, inches: 0 };
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = (feet * INCHES_PER_FOOT) + inches;
  return Math.round(totalInches * CM_PER_INCH * 10) / 10;
}

export function formatHeightDual(cm: number | null | undefined): { metric: string; imperial: string } {
  if (cm === null || cm === undefined) {
    return { metric: '—', imperial: '—' };
  }
  
  const { feet, inches } = cmToFeetInches(cm);
  return {
    metric: `${Math.round(cm)} cm`,
    imperial: `${feet}'${inches}"`,
  };
}

export function formatWeightDual(kg: number | null | undefined): { metric: string; imperial: string } {
  if (kg === null || kg === undefined) {
    return { metric: '—', imperial: '—' };
  }
  
  const lbs = kgToLbs(kg);
  return {
    metric: `${kg.toFixed(1)} kg`,
    imperial: `${lbs.toFixed(1)} lbs`,
  };
}

export function calculateAge(birthdate: string | Date | null | undefined): number | null {
  if (!birthdate) return null;
  
  const birth = typeof birthdate === 'string' ? new Date(birthdate) : birthdate;
  if (isNaN(birth.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Volume units for water tracking
export type VolumeUnit = 'ml' | 'fl_oz';

const ML_PER_FL_OZ = 29.5735;

export function mlToFlOz(ml: number): number {
  return ml / ML_PER_FL_OZ;
}

export function flOzToMl(flOz: number): number {
  return flOz * ML_PER_FL_OZ;
}

export function formatVolume(ml: number, unit: VolumeUnit): string {
  if (unit === 'ml') {
    return `${Math.round(ml)} ml`;
  }
  const flOz = mlToFlOz(ml);
  return `${Math.round(flOz)} fl oz`;
}

export function formatVolumeShort(ml: number, unit: VolumeUnit): string {
  if (unit === 'ml') {
    if (ml >= 1000) {
      return `${(ml / 1000).toFixed(1)}L`;
    }
    return `${Math.round(ml)}ml`;
  }
  const flOz = mlToFlOz(ml);
  return `${Math.round(flOz)}oz`;
}

export function getWaterPresets(unit: VolumeUnit): { label: string; ml: number }[] {
  if (unit === 'ml') {
    return [
      { label: '250ml', ml: 250 },
      { label: '500ml', ml: 500 },
      { label: '750ml', ml: 750 },
    ];
  }
  return [
    { label: '8oz', ml: 237 },   // ~8 fl oz
    { label: '16oz', ml: 473 },  // ~16 fl oz
    { label: '24oz', ml: 710 },  // ~24 fl oz
  ];
}

export function getDefaultWaterTarget(unit: VolumeUnit): number {
  return 2000; // Always stored in ml, 2L default
}

export function getVolumeUnitFromSystem(preferredUnitSystem: string): VolumeUnit {
  return preferredUnitSystem === 'imperial' ? 'fl_oz' : 'ml';
}

// ============================================
// Body Measurement Units (cm/in)
// ============================================

export type MeasurementUnit = 'cm' | 'in';

// CM_PER_INCH already defined above for height conversions

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export function formatMeasurement(valueCm: number | null | undefined, unit: MeasurementUnit): string {
  if (valueCm === null || valueCm === undefined) {
    return '-';
  }
  
  if (unit === 'cm') {
    return `${Math.round(valueCm * 10) / 10} cm`;
  }
  
  const inches = cmToInches(valueCm);
  return `${Math.round(inches * 10) / 10} in`;
}

export function convertMeasurement(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (from === to) return value;
  return from === 'cm' ? cmToInches(value) : inchesToCm(value);
}

// ============================================
// Food Weight Units (g/oz)
// ============================================

export type FoodWeightUnit = 'g' | 'oz';

const GRAMS_PER_OZ = 28.3495;

export function gramsToOz(grams: number): number {
  return grams / GRAMS_PER_OZ;
}

export function ozToGrams(oz: number): number {
  return oz * GRAMS_PER_OZ;
}

/**
 * Snap to clean values for food weight display.
 * If within 1% of a whole or half number, snap to it.
 */
export function snapToCleanValue(value: number): number {
  // Check if within 1% of a whole number
  const rounded = Math.round(value);
  if (rounded > 0 && Math.abs(value - rounded) / rounded < 0.01) {
    return rounded;
  }
  
  // Check if within 1% of a half number
  const halfRounded = Math.round(value * 2) / 2;
  if (halfRounded > 0 && Math.abs(value - halfRounded) / halfRounded < 0.01) {
    return halfRounded;
  }
  
  // Otherwise, round to 1 decimal
  return Math.round(value * 10) / 10;
}

export function formatFoodWeight(grams: number | null | undefined, unit: FoodWeightUnit): string {
  if (grams === null || grams === undefined) {
    return '-';
  }
  
  if (unit === 'g') {
    return `${Math.round(grams)}g`;
  }
  
  const oz = gramsToOz(grams);
  const snapped = snapToCleanValue(oz);
  // Format without trailing zeros for whole numbers
  const formatted = snapped % 1 === 0 ? snapped.toString() : snapped.toFixed(1);
  return `${formatted} oz`;
}

export function convertFoodWeight(value: number, from: FoodWeightUnit, to: FoodWeightUnit): number {
  if (from === to) return value;
  return from === 'g' ? gramsToOz(value) : ozToGrams(value);
}

// ============================================
// Cardio Distance Units (km/mi)
// ============================================

export type DistanceUnit = 'km' | 'mi';

const KM_PER_MILE = 1.60934;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

export function formatDistance(km: number | null | undefined, unit: DistanceUnit): string {
  if (km === null || km === undefined) {
    return '-';
  }
  
  if (unit === 'km') {
    return `${Math.round(km * 10) / 10} km`;
  }
  
  const miles = kmToMiles(km);
  return `${Math.round(miles * 10) / 10} mi`;
}

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  return from === 'km' ? kmToMiles(value) : milesToKm(value);
}

// ============================================
// Unit Preference Types
// ============================================

export interface UnitPreferences {
  bodyWeight: WeightUnit;
  bodyMeasurements: MeasurementUnit;
  exerciseWeight: WeightUnit;
  cardioDistance: DistanceUnit;
  foodWeight: FoodWeightUnit;
  foodVolume: VolumeUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  bodyWeight: 'kg',
  bodyMeasurements: 'cm',
  exerciseWeight: 'kg',
  cardioDistance: 'km',
  foodWeight: 'g',
  foodVolume: 'ml',
};

export const IMPERIAL_UNIT_PREFERENCES: UnitPreferences = {
  bodyWeight: 'lbs',
  bodyMeasurements: 'in',
  exerciseWeight: 'lbs',
  cardioDistance: 'mi',
  foodWeight: 'oz',
  foodVolume: 'fl_oz',
};
