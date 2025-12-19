import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, ArrowLeft, Check } from "lucide-react";
import { useFDASearch, useFDAFood, type FDAFood, type FoodPortion, type AIFoodIdentification } from "@/hooks/use-nutrition";
import { DataSourceBadge } from "./DataSourceBadge";
import { NUTRIENT_DEFINITIONS } from "@shared/fda-nutrients";

export type { AIFoodIdentification };

export interface PhotoFoodResult {
  foodName: string;
  servingSize: string;
  servingSizeGrams?: number | null;
  selectedPortionId?: string;
  numberOfServings: number;
  macrosPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  imageUrl?: string;
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
  };
  portions?: FoodPortion[];
  nutrientsPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface PhotoFoodReviewProps {
  open: boolean;
  onClose: () => void;
  imageUrl?: string;
  identification: AIFoodIdentification | null;
  onSave: (data: PhotoFoodResult) => void;
  isSaving?: boolean;
  isIdentifying?: boolean;
}

function extractNutrientPer100g(nutrients: any[], nutrientId: number): number | null {
  const n = nutrients.find((n: any) => n.fdcNutrientId === nutrientId);
  if (!n) return null;
  return n.amountPer100g ?? null;
}

function extractNutrientValue(nutrients: any[], nutrientId: number): { value: number; isPer100g: boolean } | null {
  const n = nutrients.find((n: any) => n.fdcNutrientId === nutrientId);
  if (!n) return null;
  if (n.amountPer100g != null) {
    return { value: n.amountPer100g, isPer100g: true };
  }
  if (n.amountPerServing != null) {
    return { value: n.amountPerServing, isPer100g: false };
  }
  return null;
}

function computeNutrientForGrams(
  nutrients: any[],
  nutrientId: number,
  targetGrams: number | null,
  servingGrams: number | null
): number {
  const n = nutrients.find((n: any) => n.fdcNutrientId === nutrientId);
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

export default function PhotoFoodReview({
  open,
  onClose,
  imageUrl,
  identification,
  onSave,
  isSaving = false,
  isIdentifying = false,
}: PhotoFoodReviewProps) {
  const [step, setStep] = useState<"search" | "review">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FDAFood | null>(null);
  const [selectedPortionId, setSelectedPortionId] = useState<string>("100g");
  const [customGrams, setCustomGrams] = useState<number>(100);
  const [numberOfServings, setNumberOfServings] = useState<number>(1);

  const { data: searchData, isLoading: isSearching } = useFDASearch(submittedQuery);
  const searchResults = searchData?.foods || [];

  const { data: foodDetails, isLoading: isLoadingDetails } = useFDAFood(
    selectedFood?.fdcId || null
  );

  useEffect(() => {
    if (!open) {
      setStep("search");
      setSearchQuery("");
      setSubmittedQuery("");
      setSelectedFood(null);
      setSelectedPortionId("100g");
      setCustomGrams(100);
      setNumberOfServings(1);
    }
  }, [open]);

  useEffect(() => {
    if (identification && open) {
      const initialSearch = identification.searchTerms[0] || identification.foodName;
      setSearchQuery(initialSearch);
      setSubmittedQuery(initialSearch);
      setNumberOfServings(identification.numberOfServings || 1);
    }
  }, [identification, open]);

  const handleSearch = useCallback(() => {
    if (searchQuery.length >= 2) {
      setSubmittedQuery(searchQuery);
    }
  }, [searchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  const handleSelectFood = useCallback((food: FDAFood) => {
    setSelectedFood(food);
    setStep("review");
  }, []);

  const handleBackToSearch = useCallback(() => {
    setStep("search");
    setSelectedFood(null);
    setSelectedPortionId("100g");
    setCustomGrams(100);
  }, []);

  const getPortionLabel = (p: FoodPortion): string => {
    const descriptor = p.portionDescription || p.modifier || p.measureUnit || "";
    if (!descriptor) {
      return `${Math.round(p.gramWeight)}g`;
    }
    return `${descriptor} (${Math.round(p.gramWeight)}g)`;
  };

  const servingGrams = useMemo(() => {
    const food = foodDetails || selectedFood;
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
  }, [foodDetails, selectedFood]);

  const hasPer100gData = useMemo(() => {
    const food = foodDetails || selectedFood;
    if (!food?.nutrients) return true;
    const hasAnyPer100g = food.nutrients.some((n: any) => n.amountPer100g != null);
    return hasAnyPer100g;
  }, [foodDetails, selectedFood]);

  const canScalePortions = useMemo(() => {
    if (hasPer100gData) return true;
    return servingGrams !== null && servingGrams > 0;
  }, [hasPer100gData, servingGrams]);

  useEffect(() => {
    if (!canScalePortions) {
      setSelectedPortionId("label-serving");
    } else if (selectedPortionId === "label-serving") {
      setSelectedPortionId("100g");
    }
  }, [canScalePortions, selectedPortionId]);

  const portionOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; grams: number }> = [];
    const food = foodDetails || selectedFood;
    
    if (!canScalePortions) {
      options.push({ id: "label-serving", label: "1 serving (per label)", grams: 0 });
      return options;
    }
    
    options.push({ id: "100g", label: "100g", grams: 100 });
    
    if (food?.portions && food.portions.length > 0) {
      for (const p of food.portions) {
        const label = getPortionLabel(p);
        options.push({
          id: p.id?.toString() || p.modifier || `portion-${p.gramWeight}`,
          label,
          grams: p.gramWeight,
        });
      }
    } else if (food?.householdServingFullText && food.servingSize) {
      const grams = food.servingSize;
      options.push({
        id: "household",
        label: `${food.householdServingFullText} (${Math.round(grams)}g)`,
        grams,
      });
    }
    
    options.push({ id: "custom", label: "Custom amount...", grams: 0 });
    
    return options;
  }, [foodDetails, selectedFood, canScalePortions]);

  const currentGrams = useMemo(() => {
    if (!canScalePortions) {
      return null;
    }
    if (selectedPortionId === "custom") {
      return customGrams;
    }
    const option = portionOptions.find((p) => p.id === selectedPortionId);
    return option?.grams || 100;
  }, [selectedPortionId, customGrams, portionOptions, canScalePortions]);

  const servingSize = useMemo(() => {
    if (!canScalePortions) {
      return "1 serving (per label)";
    }
    if (selectedPortionId === "custom") {
      return `${customGrams}g`;
    }
    const option = portionOptions.find((p) => p.id === selectedPortionId);
    return option?.label || "100g";
  }, [selectedPortionId, customGrams, portionOptions, canScalePortions]);

  const macrosPerServing = useMemo(() => {
    const food = foodDetails || selectedFood;
    if (!food?.nutrients) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    return {
      calories: computeNutrientForGrams(food.nutrients, 1008, currentGrams, servingGrams),
      protein: computeNutrientForGrams(food.nutrients, 1003, currentGrams, servingGrams),
      carbs: computeNutrientForGrams(food.nutrients, 1005, currentGrams, servingGrams),
      fat: computeNutrientForGrams(food.nutrients, 1004, currentGrams, servingGrams),
    };
  }, [foodDetails, selectedFood, currentGrams, servingGrams]);

  const totalMacros = useMemo(() => {
    return {
      calories: Math.round(numberOfServings * macrosPerServing.calories),
      protein: Math.round(numberOfServings * macrosPerServing.protein * 10) / 10,
      carbs: Math.round(numberOfServings * macrosPerServing.carbs * 10) / 10,
      fat: Math.round(numberOfServings * macrosPerServing.fat * 10) / 10,
    };
  }, [numberOfServings, macrosPerServing]);

  const handlePortionChange = (value: string) => {
    setSelectedPortionId(value);
    if (value !== "custom") {
      const option = portionOptions.find((p) => p.id === value);
      if (option) {
        setCustomGrams(option.grams);
      }
    }
  };

  const handleSave = () => {
    const food = foodDetails || selectedFood;
    if (!food) return;

    const nutrients = food.nutrients || [];
    
    const computeSnapshotNutrients = () => {
      return NUTRIENT_DEFINITIONS.map((def) => {
        const n = nutrients.find((n: any) => n.fdcNutrientId === def.fdcNutrientId) as any;
        
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
    };

    const nutrientSnapshot = {
      fdcId: food.fdcId,
      dataType: food.dataType,
      nutrients: computeSnapshotNutrients(),
      fetchedAt: new Date().toISOString(),
    };

    const derivePer100g = (nutrientId: number): number | null => {
      const n = nutrients.find((n: any) => n.fdcNutrientId === nutrientId);
      if (!n) return null;
      if (n.amountPer100g != null) return n.amountPer100g;
      if (n.amountPerServing != null && servingGrams && servingGrams > 0) {
        return n.amountPerServing * (100 / servingGrams);
      }
      return null;
    };

    const calories100g = derivePer100g(1008);
    const protein100g = derivePer100g(1003);
    const carbs100g = derivePer100g(1005);
    const fat100g = derivePer100g(1004);

    const hasAnyPer100g = calories100g !== null || protein100g !== null || carbs100g !== null || fat100g !== null;

    const roundedMacrosPerServing = {
      calories: Math.round(macrosPerServing.calories * 10) / 10,
      protein: Math.round(macrosPerServing.protein * 10) / 10,
      carbs: Math.round(macrosPerServing.carbs * 10) / 10,
      fat: Math.round(macrosPerServing.fat * 10) / 10,
    };

    onSave({
      foodName: food.description,
      servingSize,
      servingSizeGrams: currentGrams,
      selectedPortionId,
      numberOfServings,
      macrosPerServing: roundedMacrosPerServing,
      imageUrl,
      fdcId: food.fdcId,
      nutrientSnapshot,
      portions: food.portions,
      nutrientsPer100g: hasAnyPer100g ? {
        calories: calories100g ?? 0,
        protein: protein100g ?? 0,
        carbs: carbs100g ?? 0,
        fat: fat100g ?? 0,
      } : undefined,
    });
  };

  const food = foodDetails || selectedFood;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "review" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToSearch}
                data-testid="button-back-search"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "search" ? "Identify Food" : "Review & Confirm"}
          </DialogTitle>
        </DialogHeader>

        {isIdentifying && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Identifying food...</p>
          </div>
        )}

        {!isIdentifying && step === "search" && (
          <div className="space-y-4">
            {imageUrl && (
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-muted">
                <img
                  src={imageUrl}
                  alt="Food preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {identification && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AI Identified:</span>
                  <Badge variant={identification.confidence === "high" ? "default" : "secondary"}>
                    {identification.confidence} confidence
                  </Badge>
                </div>
                <p className="font-medium">{identification.foodName}</p>
                <p className="text-sm text-muted-foreground">
                  ~{identification.servingSizeEstimate}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FDA database..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 h-12"
                  autoFocus
                  data-testid="input-photo-food-search"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searchQuery.length < 2 || isSearching}
                className="h-12 px-6"
                data-testid="button-photo-search"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {identification?.searchTerms && identification.searchTerms.length > 1 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Try:</span>
                {identification.searchTerms.slice(0, 4).map((term) => (
                  <Badge
                    key={term}
                    variant="outline"
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSearchQuery(term);
                      setSubmittedQuery(term);
                    }}
                    data-testid={`badge-search-term-${term}`}
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && submittedQuery.length >= 2 && (
              <div className="space-y-2">
                {searchResults.length > 0 ? (
                  <>
                    <div className="text-sm text-muted-foreground px-1">
                      Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                    </div>
                    <div className="max-h-[35vh] overflow-y-auto space-y-2">
                      {searchResults.map((f) => (
                        <FoodResultCard
                          key={f.fdcId}
                          food={f}
                          onSelect={() => handleSelectFood(f)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No matches found for "{submittedQuery}"
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isIdentifying && step === "review" && food && (
          <div className="space-y-6">
            {imageUrl && (
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-muted">
                <img
                  src={imageUrl}
                  alt="Food preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Selected Food</Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{food.description}</p>
                        {food.brandOwner && (
                          <p className="text-sm text-muted-foreground">{food.brandOwner}</p>
                        )}
                      </div>
                      <DataSourceBadge dataType={food.dataType} size="sm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="portion-size">Serving Size</Label>
                    <div className="space-y-2 mt-2">
                      {canScalePortions ? (
                        <Select value={selectedPortionId} onValueChange={handlePortionChange}>
                          <SelectTrigger className="h-14 text-lg" data-testid="select-photo-portion">
                            <SelectValue placeholder="Select portion size" />
                          </SelectTrigger>
                          <SelectContent>
                            {portionOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-2">
                          <div className="h-14 flex items-center px-3 bg-muted rounded-md text-lg">
                            1 serving (per label)
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Custom portions unavailable for this food. Nutrition data is based on the label serving size.
                          </p>
                        </div>
                      )}
                      {selectedPortionId === "custom" && canScalePortions && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={customGrams}
                            onChange={(e) =>
                              setCustomGrams(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="h-12 text-lg"
                            data-testid="input-photo-custom-grams"
                          />
                          <span className="text-muted-foreground">grams</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="num-servings">Number of Servings</Label>
                    <Input
                      id="num-servings"
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={numberOfServings}
                      onChange={(e) =>
                        setNumberOfServings(Math.max(0.25, Number(e.target.value) || 0.25))
                      }
                      className="h-20 text-3xl text-center mt-2 tabular-nums"
                      data-testid="input-photo-num-servings"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4 text-center">
                    <div className="text-3xl font-bold tabular-nums" data-testid="text-photo-calories">
                      {totalMacros.calories}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Calories</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-chart-1 tabular-nums" data-testid="text-photo-protein">
                      {totalMacros.protein}g
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Protein</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-chart-2 tabular-nums" data-testid="text-photo-carbs">
                      {totalMacros.carbs}g
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Carbs</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-chart-3 tabular-nums" data-testid="text-photo-fat">
                      {totalMacros.fat}g
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Fat</div>
                  </Card>
                </div>
              </>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoadingDetails}
                className="w-full h-14 text-lg"
                data-testid="button-photo-save"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save to Log
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isSaving}
                className="w-full"
                data-testid="button-photo-cancel"
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FoodResultCardProps {
  food: FDAFood;
  onSelect: () => void;
}

function FoodResultCard({ food, onSelect }: FoodResultCardProps) {
  const nutrients = food.nutrients || [];
  const getDisplayValue = (nutrientId: number): number => {
    const nutrient = extractNutrientValue(nutrients, nutrientId);
    return nutrient?.value ?? 0;
  };
  const calories = getDisplayValue(1008);
  const protein = getDisplayValue(1003);
  const carbs = getDisplayValue(1005);
  const fat = getDisplayValue(1004);
  const isPerServing = !extractNutrientPer100g(nutrients, 1008);

  const servingLabel = isPerServing
    ? (food.householdServingFullText || "per serving")
    : (food.householdServingFullText
      ? food.householdServingFullText
      : food.servingSize && food.servingSizeUnit
      ? `${food.servingSize}${food.servingSizeUnit}`
      : "per 100g");

  const brandDisplay = food.brandOwner || food.brandName;

  return (
    <Card
      className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-colors"
      onClick={onSelect}
      data-testid={`card-photo-food-${food.fdcId}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium leading-tight">{food.description}</div>
          {brandDisplay && (
            <div className="text-sm text-muted-foreground truncate mt-0.5">{brandDisplay}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{servingLabel}</span>
            <DataSourceBadge dataType={food.dataType} size="sm" />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold tabular-nums">{Math.round(calories)} cal</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            P: {Math.round(protein)}g C: {Math.round(carbs)}g F: {Math.round(fat)}g
          </div>
        </div>
      </div>
    </Card>
  );
}
