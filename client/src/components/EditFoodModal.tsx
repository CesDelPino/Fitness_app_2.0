import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

export interface EditableFoodLog {
  id: string;
  foodName: string;
  quantityValue: number;
  quantityUnit: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  caloriesPerUnit: number | null;
  proteinPerUnit: number | null;
  carbsPerUnit: number | null;
  fatPerUnit: number | null;
}

interface EditFoodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foodLog: EditableFoodLog | null;
  onSave: (id: string, updates: {
    quantityValue: number;
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }) => void;
  isPending?: boolean;
}

export default function EditFoodModal({
  open,
  onOpenChange,
  foodLog,
  onSave,
  isPending = false,
}: EditFoodModalProps) {
  const [servingSize, setServingSize] = useState("");
  const [numberOfServings, setNumberOfServings] = useState(1);
  const [manualCalories, setManualCalories] = useState(0);
  const [manualProtein, setManualProtein] = useState(0);
  const [manualCarbs, setManualCarbs] = useState(0);
  const [manualFat, setManualFat] = useState(0);

  useEffect(() => {
    if (foodLog) {
      setServingSize(foodLog.quantityUnit);
      setNumberOfServings(foodLog.quantityValue);
      setManualCalories(foodLog.calories);
      setManualProtein(foodLog.proteinG || 0);
      setManualCarbs(foodLog.carbsG || 0);
      setManualFat(foodLog.fatG || 0);
    }
  }, [foodLog]);

  if (!foodLog) return null;

  const hasPerUnitData = foodLog.caloriesPerUnit !== null;
  
  const calculatedCalories = hasPerUnitData
    ? Math.round(numberOfServings * (foodLog.caloriesPerUnit || 0))
    : manualCalories;
  const calculatedProtein = hasPerUnitData
    ? numberOfServings * (foodLog.proteinPerUnit || 0)
    : manualProtein;
  const calculatedCarbs = hasPerUnitData
    ? numberOfServings * (foodLog.carbsPerUnit || 0)
    : manualCarbs;
  const calculatedFat = hasPerUnitData
    ? numberOfServings * (foodLog.fatPerUnit || 0)
    : manualFat;

  const handleSave = () => {
    onSave(foodLog.id, {
      quantityValue: numberOfServings,
      calories: calculatedCalories,
      proteinG: calculatedProtein,
      carbsG: calculatedCarbs,
      fatG: calculatedFat,
    });
  };

  const adjustServings = (amount: number) => {
    setNumberOfServings((s) => Math.max(0.25, Number((s + amount).toFixed(2))));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-food-title">Edit Food Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <p className="font-medium text-lg" data-testid="text-food-name">{foodLog.foodName}</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Serving Size</Label>
              <p className="text-lg font-medium mt-1" data-testid="text-serving-size">{servingSize}</p>
            </div>
            
            <Label className="text-muted-foreground">Number of Servings</Label>
            
            <div className="flex items-baseline justify-center gap-2 my-4">
              <input
                type="number"
                value={numberOfServings}
                onChange={(e) => setNumberOfServings(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
                className="w-28 bg-transparent text-5xl font-bold text-center tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                step="0.25"
                min="0.25"
                data-testid="input-num-servings"
              />
              <span className="text-xl text-muted-foreground font-medium">servings</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base font-semibold"
                onClick={() => adjustServings(-1)}
                disabled={numberOfServings <= 1}
                data-testid="button-subtract-1"
              >
                -1
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base font-semibold"
                onClick={() => adjustServings(-0.25)}
                disabled={numberOfServings <= 0.25}
                data-testid="button-subtract-quarter"
              >
                -0.25
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base font-semibold"
                onClick={() => adjustServings(0.25)}
                data-testid="button-add-quarter"
              >
                +0.25
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base font-semibold"
                onClick={() => adjustServings(1)}
                data-testid="button-add-1"
              >
                +1
              </Button>
            </div>
          </div>

          {!hasPerUnitData && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Macros can't auto-recalculate for this item. Edit values manually below.
              </p>
            </div>
          )}

          <div className="bg-muted rounded-lg p-4 space-y-3">
            {hasPerUnitData ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Calories</span>
                  <span className="text-xl font-bold" data-testid="text-preview-calories">{calculatedCalories}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Protein</span>
                  <span data-testid="text-preview-protein">{calculatedProtein.toFixed(1)}g</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Carbs</span>
                  <span data-testid="text-preview-carbs">{calculatedCarbs.toFixed(1)}g</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fat</span>
                  <span data-testid="text-preview-fat">{calculatedFat.toFixed(1)}g</span>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-4">
                  <Label htmlFor="manual-calories" className="text-muted-foreground">Calories</Label>
                  <Input
                    id="manual-calories"
                    type="number"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 text-right"
                    data-testid="input-manual-calories"
                  />
                </div>
                <div className="flex justify-between items-center gap-4">
                  <Label htmlFor="manual-protein" className="text-muted-foreground text-sm">Protein (g)</Label>
                  <Input
                    id="manual-protein"
                    type="number"
                    step="0.1"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 text-right"
                    data-testid="input-manual-protein"
                  />
                </div>
                <div className="flex justify-between items-center gap-4">
                  <Label htmlFor="manual-carbs" className="text-muted-foreground text-sm">Carbs (g)</Label>
                  <Input
                    id="manual-carbs"
                    type="number"
                    step="0.1"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 text-right"
                    data-testid="input-manual-carbs"
                  />
                </div>
                <div className="flex justify-between items-center gap-4">
                  <Label htmlFor="manual-fat" className="text-muted-foreground text-sm">Fat (g)</Label>
                  <Input
                    id="manual-fat"
                    type="number"
                    step="0.1"
                    value={manualFat}
                    onChange={(e) => setManualFat(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 text-right"
                    data-testid="input-manual-fat"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-edit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            data-testid="button-save-edit"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
