import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Camera, Type, Scan, PencilLine, Loader2, Crown, Database } from "lucide-react";
import { useFDASearch, type FDAFood, type FoodNutrient } from "@/hooks/use-nutrition";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { UpgradePrompt } from "./UpgradePrompt";
import { DataSourceBadge } from "./DataSourceBadge";
import FoodMatchSelector, { type FoodSelectionResult } from "./FoodMatchSelector";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { formatFoodWeight } from "@shared/units";

interface LocalFoodPortion {
  id: string;
  sourcePortionId: string | null;
  description: string;
  amount: number | null;
  gramWeight: number | null;
  unit: string | null;
  sequence: number | null;
  modifier: string | null;
  isDefault: boolean;
}

interface LocalFoodResult extends Omit<FDAFood, 'portions'> {
  id?: string;
  timesUsed?: number;
  isLocalResult?: boolean;
  portions?: LocalFoodPortion[];
}

export interface FDAFoodSelection {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  nutrients: FoodNutrient[];
}

export type { FoodSelectionResult };

interface FoodSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectFood: (food: FDAFoodSelection) => void;
  onSelectFoodWithPortion?: (result: FoodSelectionResult) => void;
  onFallbackText: () => void;
  onFallbackPhoto: () => void;
  onFallbackBarcode: () => void;
  onFallbackManual: () => void;
  enablePortionSelector?: boolean;
  isSaving?: boolean;
}

function extractNutrient(nutrients: FoodNutrient[], nutrientId: number): number | null {
  const nutrient = nutrients.find((n) => n.fdcNutrientId === nutrientId);
  if (!nutrient) return null;
  return nutrient.amountPer100g ?? nutrient.amountPerServing ?? null;
}

export default function FoodSearchModal({
  open,
  onClose,
  onSelectFood,
  onSelectFoodWithPortion,
  onFallbackText,
  onFallbackPhoto,
  onFallbackBarcode,
  onFallbackManual,
  enablePortionSelector = false,
  isSaving = false,
}: FoodSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedFoodForPortion, setSelectedFoodForPortion] = useState<FDAFood | null>(null);
  const [localResults, setLocalResults] = useState<LocalFoodResult[]>([]);
  const [isLocalSearching, setIsLocalSearching] = useState(false);
  const [showLocalDropdown, setShowLocalDropdown] = useState(false);
  const pendingSubmitRef = useRef(false);
  const localSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { canUseFeature } = useFeatureAccess();
  const { foodWeight } = useUnitPreferences();
  const canSearch = canUseFeature("text_food_search");
  const canUsePhoto = canUseFeature("ai_photo_recognition");

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSubmittedQuery("");
      setSelectedFoodForPortion(null);
      setLocalResults([]);
      setShowLocalDropdown(false);
      pendingSubmitRef.current = false;
    }
  }, [open]);

  // Debounced local search
  useEffect(() => {
    if (localSearchTimeoutRef.current) {
      clearTimeout(localSearchTimeoutRef.current);
    }

    if (searchQuery.length < 2) {
      setLocalResults([]);
      setShowLocalDropdown(false);
      return;
    }

    setIsLocalSearching(true);
    localSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/foods/local-search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        if (response.ok) {
          const foods = await response.json();
          setLocalResults(foods);
          setShowLocalDropdown(foods.length > 0);
        }
      } catch (error) {
        console.error("Local search error:", error);
      } finally {
        setIsLocalSearching(false);
      }
    }, 300);

    return () => {
      if (localSearchTimeoutRef.current) {
        clearTimeout(localSearchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleLocalSelect = useCallback((food: LocalFoodResult) => {
    setShowLocalDropdown(false);
    // Reset both so FDC search button can work again if needed
    setSearchQuery("");
    setSubmittedQuery("");
    setLocalResults([]);
    if (enablePortionSelector) {
      // Convert LocalFoodResult to FDAFood format for FoodMatchSelector
      // Preserve null values instead of forcing defaults - FoodMatchSelector handles nulls
      const fdaFood: FDAFood = {
        fdcId: food.fdcId,
        description: food.description,
        dataType: food.dataType,
        brandOwner: food.brandOwner,
        brandName: food.brandName,
        servingSize: food.servingSize,
        servingSizeUnit: food.servingSizeUnit,
        householdServingFullText: food.householdServingFullText,
        gtinUpc: food.gtinUpc,
        nutrients: food.nutrients,
        // Convert local portions to FDAFood portions format
        // Preserve original values - let FoodMatchSelector handle null/undefined
        portions: (food.portions || []).map(p => ({
          id: p.sourcePortionId ? parseInt(p.sourcePortionId) : undefined,
          amount: p.amount,
          gramWeight: p.gramWeight,
          modifier: p.modifier || p.description,
          measureUnit: p.unit ? { name: p.unit, abbreviation: p.unit } : undefined,
          portionDescription: p.description,
        })),
      };
      setSelectedFoodForPortion(fdaFood);
    } else {
      onSelectFood({
        fdcId: food.fdcId,
        description: food.description,
        dataType: food.dataType,
        brandOwner: food.brandOwner,
        brandName: food.brandName,
        servingSize: food.servingSize,
        servingSizeUnit: food.servingSizeUnit,
        householdServingFullText: food.householdServingFullText,
        nutrients: food.nutrients,
      });
    }
  }, [enablePortionSelector, onSelectFood]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        const dropdown = document.querySelector('[data-local-dropdown]');
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setShowLocalDropdown(false);
        }
      }
    };

    if (showLocalDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLocalDropdown]);

  const { data: searchData, isLoading: isSearching } = useFDASearch(
    canSearch ? submittedQuery : ""
  );

  useEffect(() => {
    if (!isSearching) {
      pendingSubmitRef.current = false;
    }
  }, [isSearching]);

  const searchResults = searchData?.foods || [];

  const canSubmitSearch = canSearch && 
    searchQuery.length >= 2 && 
    searchQuery !== submittedQuery && 
    !isSearching;

  const handleSearch = useCallback(() => {
    if (canSubmitSearch && !pendingSubmitRef.current) {
      pendingSubmitRef.current = true;
      setSubmittedQuery(searchQuery);
    }
  }, [canSubmitSearch, searchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowLocalDropdown(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setShowLocalDropdown(false);
      if (canSubmitSearch && !pendingSubmitRef.current) {
        pendingSubmitRef.current = true;
        setSubmittedQuery(searchQuery);
      }
    }
  }, [canSubmitSearch, searchQuery]);

  const handleSelectFood = useCallback(
    (food: FDAFood) => {
      if (enablePortionSelector) {
        setSelectedFoodForPortion(food);
      } else {
        onSelectFood({
          fdcId: food.fdcId,
          description: food.description,
          dataType: food.dataType,
          brandOwner: food.brandOwner,
          brandName: food.brandName,
          servingSize: food.servingSize,
          servingSizeUnit: food.servingSizeUnit,
          householdServingFullText: food.householdServingFullText,
          nutrients: food.nutrients,
        });
      }
    },
    [onSelectFood, enablePortionSelector]
  );

  const handlePortionSave = useCallback(
    (result: FoodSelectionResult) => {
      if (onSelectFoodWithPortion) {
        onSelectFoodWithPortion(result);
      } else {
        console.warn("FoodSearchModal: onSelectFoodWithPortion not provided but enablePortionSelector is true");
        onSelectFood({
          fdcId: result.fdcId,
          description: result.foodName,
          dataType: result.dataType,
          nutrients: result.nutrientSnapshot.nutrients.map(n => ({
            fdcNutrientId: n.id,
            name: n.name,
            unit: n.unit,
            amountPer100g: n.value,
            amountPerServing: null,
          })),
        });
      }
      setSelectedFoodForPortion(null);
    },
    [onSelectFoodWithPortion, onSelectFood]
  );

  const handlePortionClose = useCallback(() => {
    setSelectedFoodForPortion(null);
  }, []);

  const hasSearchResults = submittedQuery.length >= 2 && canSearch;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg h-[75vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Food</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                ref={inputRef}
                placeholder="Search foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => localResults.length > 0 && setShowLocalDropdown(true)}
                className="pl-9 h-12"
                autoFocus
                data-testid="input-food-search"
              />
              {isLocalSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              
              {/* Local search dropdown */}
              {showLocalDropdown && localResults.length > 0 && (
                <div 
                  data-local-dropdown
                  className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg"
                >
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Quick results from saved foods</span>
                  </div>
                  <ScrollArea className="max-h-[250px]">
                    <div className="p-1">
                      {localResults.map((food, index) => (
                        <LocalFoodItem
                          key={food.id || `local-${index}`}
                          food={food}
                          onSelect={() => handleLocalSelect(food)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="px-3 py-2 border-t bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Not found? Click "Search FDC" to search 900,000+ foods
                    </p>
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={() => {
                setShowLocalDropdown(false);
                handleSearch();
              }}
              disabled={!canSubmitSearch}
              className="h-12 px-4"
              data-testid="button-search-food"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search FDC"}
            </Button>
          </div>

          {!canSearch && (
            <UpgradePrompt feature="text_food_search" compact />
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {submittedQuery.length >= 2 && !isSearching && (
            <div className="space-y-2">
              {searchResults.length > 0 ? (
                <>
                  <div className="text-sm text-muted-foreground px-1">
                    Found {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {searchResults.map((food) => (
                      <FDAFoodResultCard
                        key={food.fdcId}
                        food={food}
                        onSelect={() => handleSelectFood(food)}
                        foodWeightUnit={foodWeight.unit}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-2">
                      No matches found for "{submittedQuery}"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try different keywords or use one of these options:
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-3 justify-start gap-3"
                      onClick={onFallbackText}
                      data-testid="button-fallback-describe"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Type className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">Describe what you ate</div>
                        <div className="text-xs text-muted-foreground">
                          AI will estimate nutrition from your description
                        </div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-auto py-3 justify-start gap-3"
                      onClick={onFallbackManual}
                      data-testid="button-fallback-manual"
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <PencilLine className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">Enter values manually</div>
                        <div className="text-xs text-muted-foreground">
                          Know the exact calories and macros? Add them directly
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-3">
              {hasSearchResults && searchResults.length === 0
                ? "Add new food"
                : "Other ways to add food"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={onFallbackText}
                data-testid="button-add-text"
              >
                <Type className="h-5 w-5" />
                <span className="text-xs">Describe it</span>
              </Button>
              <Button
                variant="outline"
                className="h-16 flex-col gap-1 relative"
                onClick={onFallbackPhoto}
                data-testid="button-add-photo"
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">Take photo</span>
                {!canUsePhoto && (
                  <Crown className="absolute top-1 right-1 h-3 w-3 text-amber-500" />
                )}
              </Button>
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={onFallbackBarcode}
                data-testid="button-add-barcode"
              >
                <Scan className="h-5 w-5" />
                <span className="text-xs">Scan barcode</span>
              </Button>
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={onFallbackManual}
                data-testid="button-add-manual"
              >
                <PencilLine className="h-5 w-5" />
                <span className="text-xs">Enter manually</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {selectedFoodForPortion && (
        <FoodMatchSelector
          open={!!selectedFoodForPortion}
          onClose={handlePortionClose}
          food={selectedFoodForPortion}
          onSave={handlePortionSave}
          isSaving={isSaving}
        />
      )}
    </Dialog>
  );
}

interface FDAFoodResultCardProps {
  food: FDAFood;
  onSelect: () => void;
  foodWeightUnit?: 'g' | 'oz';
}

function FDAFoodResultCard({ food, onSelect, foodWeightUnit = 'g' }: FDAFoodResultCardProps) {
  const nutrients = food.nutrients || [];
  const calories = extractNutrient(nutrients, 1008) ?? 0;
  const protein = extractNutrient(nutrients, 1003) ?? 0;
  const carbs = extractNutrient(nutrients, 1005) ?? 0;
  const fat = extractNutrient(nutrients, 1004) ?? 0;

  const defaultServingLabel = formatFoodWeight(100, foodWeightUnit);
  const servingLabel = food.householdServingFullText
    ? food.householdServingFullText
    : food.servingSize && food.servingSizeUnit
    ? `${food.servingSize}${food.servingSizeUnit}`
    : defaultServingLabel;

  const brandDisplay = food.brandOwner || food.brandName;

  return (
    <Card
      className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-colors"
      onClick={onSelect}
      data-testid={`card-food-result-${food.fdcId}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium leading-tight">{food.description}</div>
          {brandDisplay && (
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {brandDisplay}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{servingLabel}</span>
            <DataSourceBadge dataType={food.dataType} size="sm" />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold tabular-nums">{Math.round(calories)} cal</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            P:{Math.round(protein)}g C:{Math.round(carbs)}g F:{Math.round(fat)}g
          </div>
        </div>
      </div>
    </Card>
  );
}

interface LocalFoodItemProps {
  food: LocalFoodResult;
  onSelect: () => void;
}

function LocalFoodItem({ food, onSelect }: LocalFoodItemProps) {
  const nutrients = food.nutrients || [];
  const calories = extractNutrient(nutrients, 1008) ?? 0;
  const protein = extractNutrient(nutrients, 1003) ?? 0;
  const carbs = extractNutrient(nutrients, 1005) ?? 0;
  const fat = extractNutrient(nutrients, 1004) ?? 0;

  const brandDisplay = food.brandOwner || food.brandName;

  return (
    <div
      className="px-3 py-2 rounded-md cursor-pointer hover-elevate active-elevate-2 transition-colors"
      onClick={onSelect}
      data-testid={`local-food-item-${food.fdcId}`}
    >
      <div className="flex justify-between items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{food.description}</div>
          {brandDisplay && (
            <div className="text-xs text-muted-foreground truncate">{brandDisplay}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-medium tabular-nums">{Math.round(calories)} cal</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            P:{Math.round(protein)} C:{Math.round(carbs)} F:{Math.round(fat)}
          </div>
        </div>
      </div>
    </div>
  );
}
