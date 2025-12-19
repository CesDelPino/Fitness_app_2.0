import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Target, Loader2 } from "lucide-react";

interface SetNutritionTargetsModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  currentTargets?: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
}

function calculateCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function SetNutritionTargetsModal({
  open,
  onClose,
  clientId,
  clientName,
  currentTargets,
}: SetNutritionTargetsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [proteinG, setProteinG] = useState(currentTargets?.protein_g ?? 150);
  const [carbsG, setCarbsG] = useState(currentTargets?.carbs_g ?? 200);
  const [fatG, setFatG] = useState(currentTargets?.fat_g ?? 60);

  useEffect(() => {
    if (open && currentTargets) {
      setProteinG(currentTargets.protein_g);
      setCarbsG(currentTargets.carbs_g);
      setFatG(currentTargets.fat_g);
    } else if (open && !currentTargets) {
      setProteinG(150);
      setCarbsG(200);
      setFatG(60);
    }
  }, [open, currentTargets]);

  const calculatedCalories = calculateCalories(proteinG, carbsG, fatG);

  const setTargetsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pro/clients/${clientId}/nutrition-targets`, {
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Nutrition Targets Sent",
        description: `${clientName} will receive your nutrition targets for review.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/clients", clientId] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Targets",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (proteinG < 0 || carbsG < 0 || fatG < 0) {
      toast({
        title: "Invalid Values",
        description: "Macro values cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    setTargetsMutation.mutate();
  };

  const handleNumberInput = (
    value: string,
    setter: (n: number) => void,
    max: number = 2000
  ) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setter(0);
    } else {
      setter(Math.min(Math.max(0, num), max));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Set Nutrition Targets
          </DialogTitle>
          <DialogDescription>
            Set daily macro targets for {clientName}. They will be asked to accept or decline these targets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="protein" className="text-sm font-medium">
                  Protein (g)
                </Label>
                <Input
                  id="protein"
                  type="number"
                  min="0"
                  max="1000"
                  value={proteinG}
                  onChange={(e) => handleNumberInput(e.target.value, setProteinG, 1000)}
                  className="h-12 text-lg text-center mt-2 tabular-nums"
                  disabled={setTargetsMutation.isPending}
                  data-testid="input-protein-g"
                />
              </div>
              <div>
                <Label htmlFor="carbs" className="text-sm font-medium">
                  Carbs (g)
                </Label>
                <Input
                  id="carbs"
                  type="number"
                  min="0"
                  max="2000"
                  value={carbsG}
                  onChange={(e) => handleNumberInput(e.target.value, setCarbsG, 2000)}
                  className="h-12 text-lg text-center mt-2 tabular-nums"
                  disabled={setTargetsMutation.isPending}
                  data-testid="input-carbs-g"
                />
              </div>
              <div>
                <Label htmlFor="fat" className="text-sm font-medium">
                  Fat (g)
                </Label>
                <Input
                  id="fat"
                  type="number"
                  min="0"
                  max="500"
                  value={fatG}
                  onChange={(e) => handleNumberInput(e.target.value, setFatG, 500)}
                  className="h-12 text-lg text-center mt-2 tabular-nums"
                  disabled={setTargetsMutation.isPending}
                  data-testid="input-fat-g"
                />
              </div>
            </div>

            <Card className="p-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Daily Calories</div>
                <div className="text-3xl font-bold tabular-nums" data-testid="text-calculated-calories">
                  {calculatedCalories.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  (Protein × 4) + (Carbs × 4) + (Fat × 9)
                </div>
              </div>
            </Card>

            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-semibold text-chart-1" data-testid="text-protein-pct">
                  {Math.round((proteinG * 4 / calculatedCalories) * 100) || 0}%
                </div>
                <div className="text-muted-foreground">Protein</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-chart-2" data-testid="text-carbs-pct">
                  {Math.round((carbsG * 4 / calculatedCalories) * 100) || 0}%
                </div>
                <div className="text-muted-foreground">Carbs</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-chart-3" data-testid="text-fat-pct">
                  {Math.round((fatG * 9 / calculatedCalories) * 100) || 0}%
                </div>
                <div className="text-muted-foreground">Fat</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={setTargetsMutation.isPending}
              data-testid="button-cancel-targets"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={setTargetsMutation.isPending || calculatedCalories === 0}
              data-testid="button-send-targets"
            >
              {setTargetsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Targets"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
