import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { AIFoodData } from "./ReviewModal";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { formatFoodWeight } from "@shared/units";

export interface ManualFormData {
  foodName: string;
  servingSize: string;
  numberOfServings: number;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  isInitialized: boolean;
}

interface ManualEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: AIFoodData) => void;
  isSaving: boolean;
  formData: ManualFormData;
  onFormChange: (data: ManualFormData) => void;
}

export default function ManualEntryModal({
  open,
  onClose,
  onSave,
  isSaving,
  formData,
  onFormChange,
}: ManualEntryModalProps) {
  const { foodWeight } = useUnitPreferences();
  const servingPlaceholder = `e.g., ${formatFoodWeight(100, foodWeight.unit)}`;
  
  const updateField = <K extends keyof ManualFormData>(field: K, value: ManualFormData[K]) => {
    onFormChange({ ...formData, [field]: value });
  };

  const handleSave = () => {
    const caloriesNum = parseFloat(formData.calories) || 0;
    const proteinNum = parseFloat(formData.protein) || 0;
    const carbsNum = parseFloat(formData.carbs) || 0;
    const fatNum = parseFloat(formData.fat) || 0;

    const data: AIFoodData = {
      foodName: formData.foodName.trim(),
      servingSize: formData.servingSize,
      numberOfServings: formData.numberOfServings,
      macrosPerServing: {
        calories: caloriesNum,
        protein: proteinNum,
        carbs: carbsNum,
        fat: fatNum,
      },
    };

    onSave(data);
  };

  const caloriesValue = parseFloat(formData.calories);
  const isValid = formData.foodName.trim().length > 0 && 
    !isNaN(caloriesValue) && 
    caloriesValue >= 0 && 
    formData.calories.trim() !== "";

  const totalCalories = Math.round((parseFloat(formData.calories) || 0) * formData.numberOfServings);
  const totalProtein = Math.round((parseFloat(formData.protein) || 0) * formData.numberOfServings * 10) / 10;
  const totalCarbs = Math.round((parseFloat(formData.carbs) || 0) * formData.numberOfServings * 10) / 10;
  const totalFat = Math.round((parseFloat(formData.fat) || 0) * formData.numberOfServings * 10) / 10;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enter Food Manually</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the nutritional information for your food.
          </p>

          <div>
            <Label htmlFor="manual-food-name">Food Name *</Label>
            <Input
              id="manual-food-name"
              value={formData.foodName}
              onChange={(e) => updateField("foodName", e.target.value)}
              placeholder="e.g., Grilled Chicken Breast"
              className="h-12 mt-2"
              disabled={isSaving}
              data-testid="input-manual-food-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="manual-serving-size">Serving Size</Label>
              <Input
                id="manual-serving-size"
                value={formData.servingSize}
                onChange={(e) => updateField("servingSize", e.target.value)}
                placeholder={servingPlaceholder}
                className="mt-2"
                disabled={isSaving}
                data-testid="input-manual-serving-size"
              />
            </div>
            <div>
              <Label htmlFor="manual-num-servings">Servings</Label>
              <Input
                id="manual-num-servings"
                type="number"
                step="0.25"
                min="0.25"
                value={formData.numberOfServings}
                onChange={(e) => updateField("numberOfServings", Math.max(0.25, Number(e.target.value) || 0.25))}
                className="mt-2"
                disabled={isSaving}
                data-testid="input-manual-num-servings"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Macros per serving</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="manual-calories">Calories *</Label>
                <Input
                  id="manual-calories"
                  type="number"
                  min="0"
                  value={formData.calories}
                  onChange={(e) => updateField("calories", e.target.value)}
                  placeholder="Required"
                  className="mt-2"
                  disabled={isSaving}
                  data-testid="input-manual-calories"
                />
              </div>
              <div>
                <Label htmlFor="manual-protein">Protein (g)</Label>
                <Input
                  id="manual-protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.protein}
                  onChange={(e) => updateField("protein", e.target.value)}
                  placeholder="0"
                  className="mt-2"
                  disabled={isSaving}
                  data-testid="input-manual-protein"
                />
              </div>
              <div>
                <Label htmlFor="manual-carbs">Carbs (g)</Label>
                <Input
                  id="manual-carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.carbs}
                  onChange={(e) => updateField("carbs", e.target.value)}
                  placeholder="0"
                  className="mt-2"
                  disabled={isSaving}
                  data-testid="input-manual-carbs"
                />
              </div>
              <div>
                <Label htmlFor="manual-fat">Fat (g)</Label>
                <Input
                  id="manual-fat"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.fat}
                  onChange={(e) => updateField("fat", e.target.value)}
                  placeholder="0"
                  className="mt-2"
                  disabled={isSaving}
                  data-testid="input-manual-fat"
                />
              </div>
            </div>
          </div>

          {formData.numberOfServings !== 1 && (formData.calories || formData.protein || formData.carbs || formData.fat) && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Total ({formData.numberOfServings} servings)</p>
              <div className="grid grid-cols-4 gap-2">
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold tabular-nums" data-testid="text-manual-total-calories">
                    {totalCalories}
                  </div>
                  <div className="text-xs text-muted-foreground">Cal</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-chart-1 tabular-nums" data-testid="text-manual-total-protein">
                    {totalProtein}g
                  </div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-chart-2 tabular-nums" data-testid="text-manual-total-carbs">
                    {totalCarbs}g
                  </div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-chart-3 tabular-nums" data-testid="text-manual-total-fat">
                    {totalFat}g
                  </div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </Card>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="w-full h-14 text-lg"
            data-testid="button-save-manual"
          >
            {isSaving ? "Saving..." : "Save to Log"}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="w-full"
            data-testid="button-cancel-manual"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
