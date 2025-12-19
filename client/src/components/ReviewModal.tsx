import { useState, useEffect, useMemo } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { FoodPortion } from "@/hooks/use-nutrition";
import { NUTRIENT_DEFINITIONS } from "@shared/fda-nutrients";
import { inferPortionGrams, type PortionInferenceResult } from "@/lib/nutrient-utils";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { formatFoodWeight, gramsToOz, snapToCleanValue, ozToGrams } from "@shared/units";

export interface AIFoodData {
  foodName: string;
  servingSize: string;
  servingSizeGrams?: number;
  numberOfServings: number;
  macrosPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  imageUrl?: string;
  barcode?: string;
  fdcId?: number;
  nutrientSnapshot?: {
    fdcId: number;
    dataType?: string;
    nutrients: Array<{
      id: number;
      name: string;
      unit: string;
      value: number | null;
    }>;
    fetchedAt: string;
    portionGrams?: number;
    portionLabel?: string;
    scaledAt?: string;
  };
  portions?: FoodPortion[];
  nutrientsPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  data: AIFoodData | null;
  onSave: (data: AIFoodData) => void;
  isSaving?: boolean;
  onFallbackToText?: () => void;
}

export default function ReviewModal({
  open,
  onClose,
  data,
  onSave,
  isSaving = false,
  onFallbackToText,
}: ReviewModalProps) {
  const [foodName, setFoodName] = useState(data?.foodName || "");
  const [selectedPortionId, setSelectedPortionId] = useState<string>("default");
  const [customGrams, setCustomGrams] = useState<number>(100);
  const [numberOfServings, setNumberOfServings] = useState(data?.numberOfServings || 1);
  const { foodWeight } = useUnitPreferences();
  const unit = foodWeight.unit;

  const getPortionLabel = (p: FoodPortion): string => {
    const descriptor = p.portionDescription || p.modifier || p.measureUnit || "";
    const weightLabel = formatFoodWeight(p.gramWeight, unit);
    if (!descriptor) {
      return weightLabel;
    }
    return `${descriptor} (${weightLabel})`;
  };

  const portionOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; grams: number }> = [];
    const baseLabel = formatFoodWeight(100, unit);
    
    if (data?.portions && data.portions.length > 0) {
      options.push({ id: "100g", label: baseLabel, grams: 100 });
      
      for (const p of data.portions) {
        if (p.gramWeight === null) continue;
        const label = getPortionLabel(p);
        options.push({ 
          id: p.id?.toString() || p.modifier || `portion-${p.gramWeight}`, 
          label, 
          grams: p.gramWeight 
        });
      }
      
      options.push({ id: "custom", label: "Custom amount...", grams: 0 });
    } else if (data?.servingSize && data.servingSize !== "100g") {
      const householdGrams = data.servingSizeGrams || 100;
      options.push({ id: "100g", label: baseLabel, grams: 100 });
      const householdLabel = householdGrams !== 100 
        ? `${data.servingSize} (${formatFoodWeight(householdGrams, unit)})` 
        : data.servingSize;
      options.push({ id: "household", label: householdLabel, grams: householdGrams });
      options.push({ id: "custom", label: "Custom amount...", grams: 0 });
    }
    
    return options;
  }, [data?.portions, data?.servingSize, data?.servingSizeGrams, unit]);

  const getDefaultPortionId = useMemo(() => {
    if (!data?.portions || data.portions.length === 0) {
      if (data?.servingSize && data.servingSize !== "100g") {
        return "household";
      }
      return "default";
    }
    
    const nlea = data.portions.find(p => 
      p.portionDescription?.toLowerCase().includes("nlea") ||
      p.modifier?.toLowerCase().includes("nlea")
    );
    if (nlea) return nlea.id?.toString() || nlea.modifier || `portion-${nlea.gramWeight}`;
    
    const medium = data.portions.find(p => 
      p.portionDescription?.toLowerCase().includes("medium") ||
      p.modifier?.toLowerCase().includes("medium")
    );
    if (medium) return medium.id?.toString() || medium.modifier || `portion-${medium.gramWeight}`;
    
    return "100g";
  }, [data?.portions, data?.servingSize]);

  useEffect(() => {
    if (data) {
      setFoodName(data.foodName || "");
      const existingServings = data.numberOfServings || 1;
      setNumberOfServings(existingServings);
      
      // Check if we have an existing nutrient snapshot with portion info
      const existingTotalGrams = data.nutrientSnapshot?.portionGrams;
      const existingPortionLabel = data.nutrientSnapshot?.portionLabel;
      
      if (existingTotalGrams && existingTotalGrams > 0) {
        // portionGrams is stored as total (per-serving * numberOfServings)
        // Calculate the per-serving grams to match against portion options
        const perServingGrams = existingTotalGrams / existingServings;
        
        // Find matching portion option by per-serving grams
        const matchingOption = portionOptions.find(p => 
          Math.abs(p.grams - perServingGrams) < 0.5 ||
          (existingPortionLabel && p.label.includes(existingPortionLabel))
        );
        
        if (matchingOption && matchingOption.id !== "custom") {
          setSelectedPortionId(matchingOption.id);
          setCustomGrams(matchingOption.grams);
        } else {
          // Use custom grams with the per-serving value
          setSelectedPortionId("custom");
          setCustomGrams(perServingGrams);
        }
      } else if (portionOptions.length > 0) {
        setSelectedPortionId(getDefaultPortionId);
        const defaultOption = portionOptions.find(p => p.id === getDefaultPortionId);
        if (defaultOption && defaultOption.id !== "custom") {
          setCustomGrams(defaultOption.grams);
        }
      } else {
        setSelectedPortionId("default");
      }
    }
  }, [data, portionOptions, getDefaultPortionId]);

  const currentGrams = useMemo(() => {
    if (selectedPortionId === "custom") {
      return customGrams;
    }
    if (selectedPortionId === "default" || portionOptions.length === 0) {
      return data?.macrosPerServing ? 100 : 100;
    }
    const option = portionOptions.find(p => p.id === selectedPortionId);
    return option?.grams || 100;
  }, [selectedPortionId, customGrams, portionOptions, data]);

  const servingSize = useMemo(() => {
    if (selectedPortionId === "custom") {
      return formatFoodWeight(customGrams, unit);
    }
    if (selectedPortionId === "default" || portionOptions.length === 0) {
      return data?.servingSize || formatFoodWeight(100, unit);
    }
    const option = portionOptions.find(p => p.id === selectedPortionId);
    return option?.label || formatFoodWeight(100, unit);
  }, [selectedPortionId, customGrams, portionOptions, data, unit]);

  const macrosPerServing = useMemo(() => {
    if (!data) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    if (data.nutrientsPer100g && (portionOptions.length > 0 || selectedPortionId === "custom")) {
      const multiplier = currentGrams / 100;
      return {
        calories: Math.round(data.nutrientsPer100g.calories * multiplier),
        protein: Math.round(data.nutrientsPer100g.protein * multiplier * 10) / 10,
        carbs: Math.round(data.nutrientsPer100g.carbs * multiplier * 10) / 10,
        fat: Math.round(data.nutrientsPer100g.fat * multiplier * 10) / 10,
      };
    }
    
    return data.macrosPerServing;
  }, [data, currentGrams, portionOptions, selectedPortionId]);

  const calculateTotalMacros = () => {
    return {
      calories: Math.round(numberOfServings * macrosPerServing.calories),
      protein: Math.round(numberOfServings * macrosPerServing.protein * 10) / 10,
      carbs: Math.round(numberOfServings * macrosPerServing.carbs * 10) / 10,
      fat: Math.round(numberOfServings * macrosPerServing.fat * 10) / 10,
    };
  };

  const totalMacros = calculateTotalMacros();

  const handlePortionChange = (value: string) => {
    setSelectedPortionId(value);
    if (value !== "custom") {
      const option = portionOptions.find(p => p.id === value);
      if (option) {
        setCustomGrams(option.grams);
      }
    }
  };

  const portionInference = useMemo((): PortionInferenceResult => {
    if (!data) {
      return { inferredGrams: null, source: 'none', confidence: 'none' };
    }
    
    return inferPortionGrams({
      nutrientSnapshot: data.nutrientSnapshot,
      servingSizeGrams: data.servingSizeGrams,
      quantityValue: data.numberOfServings,
      nutrientsPer100g: data.nutrientsPer100g,
      storedCalories: data.macrosPerServing?.calories,
    });
  }, [data]);

  const canEditPortion = portionInference.confidence !== 'none';

  const generateNutrientSnapshot = () => {
    if (!data?.nutrientSnapshot) return undefined;
    
    const snapshotNutrients = data.nutrientSnapshot.nutrients || [];
    
    // Calculate the total portion in grams we're saving
    const totalNewGrams = currentGrams * numberOfServings;
    
    // Use the inference utility to determine the baseline grams
    const baselineGrams = portionInference.inferredGrams;
    
    // If inference failed and the snapshot was previously scaled, don't rescale
    if (baselineGrams === null) {
      return {
        ...data.nutrientSnapshot,
        portionGrams: totalNewGrams,
        portionLabel: numberOfServings > 1 ? `${numberOfServings}x ${servingSize}` : servingSize,
      };
    }
    
    // Calculate effective multiplier from inferred baseline to new total
    const effectiveMultiplier = totalNewGrams / baselineGrams;
    
    const scaledNutrients = NUTRIENT_DEFINITIONS.map((def) => {
      const snapshotNutrient = snapshotNutrients.find(
        (n) => n.id === def.fdcNutrientId
      );
      
      const fdaName = snapshotNutrient?.name ?? def.name;
      const fdaUnit = snapshotNutrient?.unit ?? def.unit;
      
      let scaledValue: number | null = null;
      if (snapshotNutrient && snapshotNutrient.value !== null && snapshotNutrient.value !== undefined) {
        const rawScaled = snapshotNutrient.value * effectiveMultiplier;
        scaledValue = Math.round(rawScaled * 100) / 100;
      }
      
      return {
        id: def.fdcNutrientId,
        name: fdaName,
        unit: fdaUnit,
        value: scaledValue,
      };
    });
    
    return {
      ...data.nutrientSnapshot,
      nutrients: scaledNutrients,
      portionGrams: totalNewGrams,
      portionLabel: numberOfServings > 1 ? `${numberOfServings}x ${servingSize}` : servingSize,
      scaledAt: new Date().toISOString(),
    };
  };

  const handleSave = () => {
    if (!data) return;

    const nutrientSnapshot = generateNutrientSnapshot();

    onSave({
      ...data,
      foodName,
      servingSize,
      numberOfServings,
      macrosPerServing,
      nutrientSnapshot,
    });
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review & Edit Food Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {data.imageUrl && (
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-muted">
              <img
                src={data.imageUrl}
                alt="Food preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div>
            <Label htmlFor="food-name">Food Name</Label>
            <Input
              id="food-name"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="h-14 text-xl mt-2"
              data-testid="input-food-name"
            />
          </div>

          {!canEditPortion && (
            <Alert variant="destructive" className="bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This entry's portion data couldn't be verified. You can update the name but portion changes are disabled to prevent data errors.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="serving-size">Serving Size</Label>
              {portionOptions.length > 0 ? (
                <div className="space-y-2 mt-2">
                  <Select
                    value={selectedPortionId}
                    onValueChange={handlePortionChange}
                    disabled={!canEditPortion}
                  >
                    <SelectTrigger 
                      className="h-14 text-lg" 
                      data-testid="select-portion"
                    >
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
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.1"
                        step={unit === 'oz' ? '0.25' : '1'}
                        value={unit === 'oz' 
                          ? snapToCleanValue(gramsToOz(customGrams)) 
                          : customGrams}
                        onChange={(e) => {
                          const inputValue = Math.max(0.1, Number(e.target.value) || 0.1);
                          const gramsValue = unit === 'oz' 
                            ? ozToGrams(inputValue)
                            : inputValue;
                          setCustomGrams(Math.round(gramsValue));
                        }}
                        className="h-12 text-lg"
                        data-testid="input-custom-grams"
                        disabled={!canEditPortion}
                      />
                      <span className="text-muted-foreground">{unit === 'oz' ? 'oz' : 'grams'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-lg text-muted-foreground p-4 bg-muted rounded-md">
                  {servingSize}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="num-servings">Number of Servings</Label>
              <Input
                id="num-servings"
                type="number"
                step="0.25"
                min="0.25"
                value={numberOfServings}
                onChange={(e) => setNumberOfServings(Math.max(0.25, Number(e.target.value) || 0.25))}
                className="h-20 text-3xl text-center mt-2 tabular-nums"
                data-testid="input-num-servings"
                disabled={!canEditPortion}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold tabular-nums" data-testid="text-review-calories">
                {totalMacros.calories}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Calories</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-chart-1 tabular-nums" data-testid="text-review-protein">
                {totalMacros.protein}g
              </div>
              <div className="text-sm text-muted-foreground mt-1">Protein</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-chart-2 tabular-nums" data-testid="text-review-carbs">
                {totalMacros.carbs}g
              </div>
              <div className="text-sm text-muted-foreground mt-1">Carbs</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-chart-3 tabular-nums" data-testid="text-review-fat">
                {totalMacros.fat}g
              </div>
              <div className="text-sm text-muted-foreground mt-1">Fat</div>
            </Card>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-14 text-lg"
            data-testid="button-save"
          >
            {isSaving ? "Saving..." : "Save to Log"}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="w-full"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          {onFallbackToText && (
            <button
              type="button"
              onClick={onFallbackToText}
              disabled={isSaving}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 pt-2"
              data-testid="link-fallback-text"
            >
              Not right? Describe it instead
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
