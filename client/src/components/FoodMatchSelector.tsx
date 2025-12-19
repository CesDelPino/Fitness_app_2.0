import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useFDAFood, type FDAFood, type FoodNutrient, type FoodPortion } from "@/hooks/use-nutrition";
import { DataSourceBadge } from "./DataSourceBadge";
import { NUTRIENT_DEFINITIONS } from "@shared/fda-nutrients";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { formatFoodWeight, type FoodWeightUnit, ozToGrams, gramsToOz, snapToCleanValue } from "@shared/units";

export interface PortionOption {
  id: string;
  label: string;
  grams: number;
}

export interface NutrientSnapshotValue {
  id: number;
  name: string;
  unit: string;
  value: number | null;
}

export interface NutrientSnapshot {
  fdcId: number;
  dataType?: string;
  nutrients: NutrientSnapshotValue[];
  fetchedAt: string;
  portionGrams?: number;
  portionLabel?: string;
  scaledAt?: string;
}

export interface FoodSelectionResult {
  foodName: string;
  servingSize: string;
  servingSizeGrams: number | null;
  selectedPortionId: string;
  numberOfServings: number;
  macrosPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  fdcId: number;
  dataType?: string;
  nutrientSnapshot: NutrientSnapshot;
  nutrientsPer100g: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  portions?: FoodPortion[];
}

interface FoodMatchSelectorProps {
  open: boolean;
  onClose: () => void;
  food: FDAFood;
  onSave: (result: FoodSelectionResult) => void;
  isSaving?: boolean;
  initialServings?: number;
}

function getPortionLabel(p: FoodPortion, unit: FoodWeightUnit = 'g'): string {
  const measureUnitStr = typeof p.measureUnit === 'object' && p.measureUnit 
    ? (p.measureUnit as { name?: string; abbreviation?: string }).name || (p.measureUnit as { name?: string; abbreviation?: string }).abbreviation || ''
    : (p.measureUnit || '');
  const descriptor = p.portionDescription || p.modifier || measureUnitStr || "";
  const weightDisplay = p.gramWeight != null ? formatFoodWeight(p.gramWeight, unit) : '';
  if (!descriptor) {
    return weightDisplay || '-';
  }
  return weightDisplay ? `${descriptor} (${weightDisplay})` : descriptor;
}

function extractNutrientPer100g(nutrients: FoodNutrient[], nutrientId: number): number | null {
  const n = nutrients.find((n) => n.fdcNutrientId === nutrientId);
  if (!n) return null;
  return n.amountPer100g ?? null;
}

function computeNutrientForGrams(
  nutrients: FoodNutrient[],
  nutrientId: number,
  targetGrams: number | null,
  servingGrams: number | null
): number {
  const n = nutrients.find((n) => n.fdcNutrientId === nutrientId);
  if (!n) return 0;
  
  if (targetGrams === null) {
    if (n.amountPerServing != null) {
      return n.amountPerServing;
    }
    if (n.amountPer100g != null) {
      return n.amountPer100g;
    }
    return 0;
  }
  
  if (n.amountPer100g != null) {
    return n.amountPer100g * (targetGrams / 100);
  }
  
  if (n.amountPerServing != null && servingGrams && servingGrams > 0) {
    const valuePer100g = n.amountPerServing * (100 / servingGrams);
    return valuePer100g * (targetGrams / 100);
  }
  
  if (n.amountPerServing != null) {
    return n.amountPerServing;
  }
  
  return 0;
}

export function buildNutrientSnapshot(
  food: FDAFood,
  currentGrams: number | null,
  servingGrams: number | null,
  portionLabel: string
): NutrientSnapshot {
  const nutrients = food.nutrients || [];
  
  const snapshotNutrients = NUTRIENT_DEFINITIONS.map((def) => {
    const n = nutrients.find((n) => n.fdcNutrientId === def.fdcNutrientId) as any;
    
    const nutrientName = n?.nutrientName || n?.name || def.name;
    const nutrientUnit = n?.unitName || n?.unit || def.unit;
    
    if (!n) {
      return {
        id: def.fdcNutrientId,
        name: nutrientName,
        unit: nutrientUnit,
        value: null,
      };
    }
    
    if (currentGrams === null) {
      return {
        id: def.fdcNutrientId,
        name: nutrientName,
        unit: nutrientUnit,
        value: n.amountPerServing != null 
          ? Math.round(n.amountPerServing * 100) / 100 
          : null,
      };
    }
    
    let value: number | null = null;
    if (n.amountPer100g != null) {
      value = (n.amountPer100g * currentGrams) / 100;
    } else if (n.amountPerServing != null && servingGrams && servingGrams > 0) {
      const valuePer100g = n.amountPerServing * (100 / servingGrams);
      value = valuePer100g * (currentGrams / 100);
    } else if (n.amountPerServing != null) {
      value = n.amountPerServing;
    }
    
    return {
      id: def.fdcNutrientId,
      name: nutrientName,
      unit: nutrientUnit,
      value: value != null ? Math.round(value * 100) / 100 : null,
    };
  });

  return {
    fdcId: food.fdcId,
    dataType: food.dataType,
    nutrients: snapshotNutrients,
    fetchedAt: new Date().toISOString(),
    portionGrams: currentGrams ?? undefined,
    portionLabel,
    scaledAt: new Date().toISOString(),
  };
}

export function buildPortionOptions(
  food: FDAFood | null,
  canScalePortions: boolean,
  unit: FoodWeightUnit = 'g'
): PortionOption[] {
  const options: PortionOption[] = [];
  
  if (!canScalePortions) {
    options.push({ id: "label-serving", label: "1 serving (per label)", grams: 0 });
    return options;
  }
  
  const standardLabel = unit === 'g' ? '100g' : formatFoodWeight(100, unit);
  options.push({ id: "100g", label: standardLabel, grams: 100 });
  
  if (food?.portions && food.portions.length > 0) {
    for (const p of food.portions) {
      const label = getPortionLabel(p, unit);
      const grams = p.gramWeight ?? 0;
      options.push({
        id: p.id?.toString() || p.modifier || `portion-${grams}`,
        label,
        grams,
      });
    }
  } else if (food?.householdServingFullText && food.servingSize) {
    const grams = food.servingSize;
    const weightDisplay = formatFoodWeight(grams, unit);
    options.push({
      id: "household",
      label: `${food.householdServingFullText} (${weightDisplay})`,
      grams,
    });
  }
  
  options.push({ id: "custom", label: "Custom amount...", grams: 0 });
  
  return options;
}

export function getServingGrams(food: FDAFood | null): number | null {
  if (!food) return null;
  
  if (food.servingSizeUnit && /^(g|gram|grams|G)$/i.test(food.servingSizeUnit) && food.servingSize) {
    return food.servingSize;
  }
  
  if (food.portions && food.portions.length > 0) {
    const firstPortion = food.portions[0];
    if (firstPortion.gramWeight) {
      return firstPortion.gramWeight;
    }
  }
  
  return null;
}

export function hasPer100gData(food: FDAFood | null): boolean {
  if (!food?.nutrients) return true;
  return food.nutrients.some((n) => n.amountPer100g != null);
}

export function canScalePortions(food: FDAFood | null): boolean {
  if (hasPer100gData(food)) return true;
  const servingGrams = getServingGrams(food);
  return servingGrams !== null && servingGrams > 0;
}

export default function FoodMatchSelector({
  open,
  onClose,
  food,
  onSave,
  isSaving = false,
  initialServings = 1,
}: FoodMatchSelectorProps) {
  const [selectedPortionId, setSelectedPortionId] = useState<string>("100g");
  const [customGrams, setCustomGrams] = useState<number>(100);
  const [customDisplayValue, setCustomDisplayValue] = useState<string>("100");
  const [numberOfServings, setNumberOfServings] = useState<number>(initialServings);

  const { data: foodDetails, isLoading: isLoadingDetails } = useFDAFood(food?.fdcId || null);
  const { foodWeight } = useUnitPreferences();
  
  const activeFood = foodDetails || food;

  useEffect(() => {
    if (!open) {
      setSelectedPortionId("100g");
      setCustomGrams(100);
      const defaultDisplay = foodWeight.unit === 'g' ? '100' : snapToCleanValue(gramsToOz(100)).toString();
      setCustomDisplayValue(defaultDisplay);
      setNumberOfServings(initialServings);
    }
  }, [open, initialServings, foodWeight.unit]);

  const servingGrams = useMemo(() => getServingGrams(activeFood), [activeFood]);
  const canScale = useMemo(() => canScalePortions(activeFood), [activeFood]);

  useEffect(() => {
    if (!canScale) {
      setSelectedPortionId("label-serving");
    } else if (selectedPortionId === "label-serving") {
      setSelectedPortionId("100g");
    }
  }, [canScale, selectedPortionId]);

  const portionOptions = useMemo(
    () => buildPortionOptions(activeFood, canScale, foodWeight.unit),
    [activeFood, canScale, foodWeight.unit]
  );

  const currentGrams = useMemo(() => {
    if (!canScale) return null;
    if (selectedPortionId === "custom") return customGrams;
    const option = portionOptions.find((p) => p.id === selectedPortionId);
    return option?.grams || 100;
  }, [selectedPortionId, customGrams, portionOptions, canScale]);

  const servingSize = useMemo(() => {
    if (!canScale) return "1 serving (per label)";
    if (selectedPortionId === "custom") return formatFoodWeight(customGrams, foodWeight.unit);
    const option = portionOptions.find((p) => p.id === selectedPortionId);
    return option?.label || formatFoodWeight(100, foodWeight.unit);
  }, [selectedPortionId, customGrams, portionOptions, canScale, foodWeight.unit]);

  const macrosPerServing = useMemo(() => {
    if (!activeFood?.nutrients) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      calories: computeNutrientForGrams(activeFood.nutrients, 1008, currentGrams, servingGrams),
      protein: computeNutrientForGrams(activeFood.nutrients, 1003, currentGrams, servingGrams),
      carbs: computeNutrientForGrams(activeFood.nutrients, 1005, currentGrams, servingGrams),
      fat: computeNutrientForGrams(activeFood.nutrients, 1004, currentGrams, servingGrams),
    };
  }, [activeFood, currentGrams, servingGrams]);

  const totalMacros = useMemo(() => ({
    calories: Math.round(numberOfServings * macrosPerServing.calories),
    protein: Math.round(numberOfServings * macrosPerServing.protein * 10) / 10,
    carbs: Math.round(numberOfServings * macrosPerServing.carbs * 10) / 10,
    fat: Math.round(numberOfServings * macrosPerServing.fat * 10) / 10,
  }), [numberOfServings, macrosPerServing]);

  const handlePortionChange = useCallback((value: string) => {
    setSelectedPortionId(value);
    if (value !== "custom") {
      const option = portionOptions.find((p) => p.id === value);
      if (option) {
        setCustomGrams(option.grams);
        const displayVal = foodWeight.unit === 'g' 
          ? option.grams.toString() 
          : snapToCleanValue(gramsToOz(option.grams)).toString();
        setCustomDisplayValue(displayVal);
      }
    }
  }, [portionOptions, foodWeight.unit]);

  const handleSave = useCallback(() => {
    if (!activeFood) return;

    const nutrients = activeFood.nutrients || [];
    const totalPortionGrams = currentGrams ? currentGrams * numberOfServings : null;
    const nutrientSnapshot = buildNutrientSnapshot(
      activeFood,
      totalPortionGrams,
      servingGrams,
      numberOfServings > 1 ? `${numberOfServings}x ${servingSize}` : servingSize
    );

    const derivePer100g = (nutrientId: number): number | null => {
      const n = nutrients.find((n) => n.fdcNutrientId === nutrientId);
      if (!n) return null;
      if (n.amountPer100g != null) return n.amountPer100g;
      if (n.amountPerServing != null && servingGrams && servingGrams > 0) {
        return n.amountPerServing * (100 / servingGrams);
      }
      return null;
    };

    onSave({
      foodName: activeFood.description,
      servingSize,
      servingSizeGrams: currentGrams,
      selectedPortionId,
      numberOfServings,
      macrosPerServing,
      fdcId: activeFood.fdcId,
      dataType: activeFood.dataType,
      nutrientSnapshot,
      nutrientsPer100g: {
        calories: derivePer100g(1008),
        protein: derivePer100g(1003),
        carbs: derivePer100g(1005),
        fat: derivePer100g(1004),
      },
      portions: activeFood.portions,
    });
  }, [activeFood, currentGrams, servingGrams, servingSize, numberOfServings, selectedPortionId, macrosPerServing, onSave]);

  if (!food) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Portion Size</DialogTitle>
        </DialogHeader>

        {isLoadingDetails ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold" data-testid="text-selected-food-name">
                    {activeFood?.description}
                  </h3>
                  {activeFood?.brandOwner && (
                    <p className="text-sm text-muted-foreground">{activeFood.brandOwner}</p>
                  )}
                </div>
                {activeFood?.dataType && <DataSourceBadge dataType={activeFood.dataType} />}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Portion Size</Label>
                <Select
                  value={selectedPortionId}
                  onValueChange={handlePortionChange}
                  disabled={!canScale}
                >
                  <SelectTrigger className="h-14 text-lg mt-2" data-testid="select-portion-size">
                    <SelectValue placeholder="Select portion size" />
                  </SelectTrigger>
                  <SelectContent>
                    {portionOptions.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                        data-testid={`option-portion-${option.id}`}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPortionId === "custom" && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      min="1"
                      step={foodWeight.unit === 'g' ? "1" : "0.5"}
                      value={customDisplayValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomDisplayValue(val);
                        const numVal = parseFloat(val) || 1;
                        const grams = foodWeight.unit === 'g' ? numVal : ozToGrams(numVal);
                        setCustomGrams(Math.max(1, grams));
                      }}
                      className="h-12 text-lg"
                      data-testid="input-custom-grams"
                    />
                    <span className="text-muted-foreground">{foodWeight.unit === 'g' ? 'grams' : 'oz'}</span>
                  </div>
                )}
              </div>

              <div>
                <Label>Number of Servings</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={numberOfServings}
                  onChange={(e) => setNumberOfServings(Math.max(0.25, Number(e.target.value) || 0.25))}
                  className="h-20 text-3xl text-center mt-2 tabular-nums"
                  data-testid="input-num-servings"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold tabular-nums" data-testid="text-total-calories">
                  {totalMacros.calories}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Calories</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-chart-1 tabular-nums" data-testid="text-total-protein">
                  {totalMacros.protein}g
                </div>
                <div className="text-sm text-muted-foreground mt-1">Protein</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-chart-2 tabular-nums" data-testid="text-total-carbs">
                  {totalMacros.carbs}g
                </div>
                <div className="text-sm text-muted-foreground mt-1">Carbs</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-chart-3 tabular-nums" data-testid="text-total-fat">
                  {totalMacros.fat}g
                </div>
                <div className="text-sm text-muted-foreground mt-1">Fat</div>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-portion">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoadingDetails}
            data-testid="button-confirm-portion"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add to Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
