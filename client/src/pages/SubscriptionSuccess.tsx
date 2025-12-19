import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Crown, Sparkles } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function SubscriptionSuccess() {
  const [, navigate] = useLocation();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    queryClient.invalidateQueries({ queryKey: ["/api/features"] });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Crown className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                <Check className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold" data-testid="text-success-title">
              Welcome to Premium!
            </h1>
            <p className="text-muted-foreground">
              Your subscription is now active. You have full access to all premium features.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm">AI Photo Food Recognition enabled</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Check className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm">31 Micronutrients now tracked</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Check className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm">AI Workout Generation unlocked</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate("/")}
              data-testid="button-go-dashboard"
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/subscription")}
              data-testid="button-manage-subscription"
            >
              Manage Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
