import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNutritionTargets, useAcceptNutritionTarget, useDeclineNutritionTarget, calculateCalories } from "@/lib/nutrition-targets";
import { useToast } from "@/hooks/use-toast";
import { Target, Check, X, Loader2, User } from "lucide-react";

export function PendingNutritionTargetsBanner() {
  const { toast } = useToast();
  const { data: targets, isLoading } = useNutritionTargets();
  const acceptMutation = useAcceptNutritionTarget();
  const declineMutation = useDeclineNutritionTarget();

  if (isLoading || !targets?.pending) {
    return null;
  }

  const pending = targets.pending;
  const calories = calculateCalories(pending.protein_g, pending.carbs_g, pending.fat_g);

  const handleAccept = async () => {
    try {
      await acceptMutation.mutateAsync(pending.id);
      toast({
        title: "Targets Accepted",
        description: "Your new nutrition targets are now active.",
      });
    } catch {
      toast({
        title: "Failed to Accept",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDecline = async () => {
    try {
      await declineMutation.mutateAsync(pending.id);
      toast({
        title: "Targets Declined",
        description: "The nutrition targets have been declined.",
      });
    } catch {
      toast({
        title: "Failed to Decline",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const isPending = acceptMutation.isPending || declineMutation.isPending;

  return (
    <Card className="border-primary/30 bg-primary/5" data-testid="card-pending-nutrition-targets">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium">New Nutrition Targets</p>
              <Badge variant="secondary" className="text-xs">
                Pending
              </Badge>
            </div>
            {pending.professional_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                <User className="w-3 h-3" />
                From {pending.professional_name}
              </p>
            )}
            
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-lg font-bold tabular-nums" data-testid="text-pending-calories">
                  {calories}
                </div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-lg font-bold text-chart-1 tabular-nums" data-testid="text-pending-protein">
                  {pending.protein_g}g
                </div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-lg font-bold text-chart-2 tabular-nums" data-testid="text-pending-carbs">
                  {pending.carbs_g}g
                </div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-lg font-bold text-chart-3 tabular-nums" data-testid="text-pending-fat">
                  {pending.fat_g}g
                </div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={isPending}
                className="flex-1"
                data-testid="button-accept-targets"
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecline}
                disabled={isPending}
                className="flex-1"
                data-testid="button-decline-targets"
              >
                {declineMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <X className="w-4 h-4 mr-1" />
                    Decline
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
