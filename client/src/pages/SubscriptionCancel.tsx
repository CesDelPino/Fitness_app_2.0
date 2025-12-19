import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Crown } from "lucide-react";

export default function SubscriptionCancel() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Crown className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold" data-testid="text-cancel-title">
              Checkout Canceled
            </h1>
            <p className="text-muted-foreground">
              Your subscription checkout was canceled. No charges were made to your card.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            You can upgrade to Premium anytime to unlock AI-powered features and advanced tracking.
          </p>

          <div className="space-y-3 pt-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate("/subscription")}
              data-testid="button-try-again"
            >
              <Crown className="h-5 w-5 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
              data-testid="button-go-home"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
