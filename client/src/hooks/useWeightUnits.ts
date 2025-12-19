import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  WeightUnit,
  kgToLbs,
  lbsToKg,
  convertWeight,
  formatWeight,
  parseWeightInput,
  smartRoundForDisplay,
  getWeightInputStep,
  getWeightPlaceholder,
  getCommonWeightIncrements,
} from "@shared/units";

export interface WeightDisplayOptions {
  precision?: number;
  showUnit?: boolean;
  enteredValue?: number;
  enteredUnit?: WeightUnit;
}

export interface ParsedWeight {
  valueKg: number;
  enteredValue: number;
  enteredUnit: WeightUnit;
}

function mapPreferenceToUnit(preference: string | undefined | null): WeightUnit {
  if (preference === 'imperial') return 'lbs';
  return 'kg';
}

export function useWeightUnits() {
  const { profile, isLoading } = useSupabaseAuth();
  
  const preferredUnit: WeightUnit = mapPreferenceToUnit(profile?.preferred_unit_system);
  
  const isMetric = preferredUnit === 'kg';
  
  const isReady = !isLoading && profile !== null;

  const format = (
    valueKg: number | null | undefined,
    options?: WeightDisplayOptions
  ): string => {
    return formatWeight(valueKg, preferredUnit, options);
  };

  const formatInUnit = (
    valueKg: number | null | undefined,
    unit: WeightUnit,
    options?: Omit<WeightDisplayOptions, 'enteredValue' | 'enteredUnit'>
  ): string => {
    return formatWeight(valueKg, unit, options);
  };

  const parse = (input: string): ParsedWeight | null => {
    return parseWeightInput(input, preferredUnit);
  };

  const parseInUnit = (input: string, unit: WeightUnit): ParsedWeight | null => {
    return parseWeightInput(input, unit);
  };

  const toDisplayValue = (
    valueKg: number | null | undefined,
    enteredValue?: number,
    enteredUnit?: WeightUnit
  ): number | null => {
    if (valueKg === null || valueKg === undefined) {
      return null;
    }

    if (enteredValue !== undefined && enteredUnit !== undefined && enteredUnit === preferredUnit) {
      return enteredValue;
    }

    const converted = preferredUnit === 'kg' ? valueKg : kgToLbs(valueKg);
    return smartRoundForDisplay(converted, preferredUnit);
  };

  const toKg = (value: number): number => {
    return preferredUnit === 'kg' ? value : lbsToKg(value);
  };

  const fromKg = (valueKg: number): number => {
    return preferredUnit === 'kg' ? valueKg : kgToLbs(valueKg);
  };

  const inputStep = getWeightInputStep(preferredUnit);
  const placeholder = getWeightPlaceholder(preferredUnit);
  const commonIncrements = getCommonWeightIncrements(preferredUnit);

  const unitLabel = preferredUnit;
  const unitLabelLong = preferredUnit === 'kg' ? 'kilograms' : 'pounds';

  return {
    preferredUnit,
    isMetric,
    isReady,
    isLoading,
    format,
    formatInUnit,
    parse,
    parseInUnit,
    toDisplayValue,
    toKg,
    fromKg,
    convertWeight: (value: number, from: WeightUnit, to: WeightUnit) => convertWeight(value, from, to),
    inputStep,
    placeholder,
    commonIncrements,
    unitLabel,
    unitLabelLong,
  };
}

export type UseWeightUnitsReturn = ReturnType<typeof useWeightUnits>;
