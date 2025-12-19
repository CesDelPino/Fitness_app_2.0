import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Crown, ArrowLeft, Gift, Sparkles, Shield, Star, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cn } from "@/lib/utils";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: {
    interval: "month" | "year";
    interval_count: number;
  };
  metadata: {
    tier?: string;
    display_name?: string;
    discount?: string;
    billing_cycle?: string;
  };
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
}

interface SubscriptionData {
  id: string;
  status: string;
  current_period_end: string;
  stripeData?: {
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  };
}

export default function Subscription() {
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoValidation, setPromoValidation] = useState<{
    valid?: boolean;
    discountType?: string;
    discountValue?: number;
    message?: string;
  } | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: Product[] }>({
    queryKey: ["/api/stripe/products"],
  });

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<{
    subscription: SubscriptionData | null;
    status: string;
  }>({
    queryKey: ["/api/stripe/subscription"],
    enabled: !!user,
  });

  const { data: trialData } = useQuery<{ eligible: boolean; trialDays: number }>({
    queryKey: ["/api/stripe/trial-eligibility"],
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: { priceId: string; promoCode?: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", data);
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  const validatePromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/stripe/promo/validate", { code });
      return res.json() as Promise<{
        valid: boolean;
        discountType?: string;
        discountValue?: number;
        message?: string;
      }>;
    },
    onSuccess: (data) => {
      setPromoValidation(data);
      if (data.valid) {
        toast({
          title: "Promo code applied!",
          description: `${data.discountType === "percent" ? data.discountValue + "%" : "$" + ((data.discountValue || 0) / 100).toFixed(2)} off your subscription`,
        });
      }
    },
    onError: () => {
      setPromoValidation({ valid: false, message: "Invalid promo code" });
    },
  });

  const handleCheckout = () => {
    if (!selectedPriceId) {
      toast({
        title: "Select a plan",
        description: "Please select a subscription plan to continue",
        variant: "destructive",
      });
      return;
    }

    checkoutMutation.mutate({
      priceId: selectedPriceId,
      promoCode: promoValidation?.valid ? promoCode : undefined,
    });
  };

  const premiumFeatures = [
    { icon: Sparkles, label: "AI Photo Food Recognition", description: "Scan your meals with AI" },
    { icon: Shield, label: "31 Micronutrients Tracked", description: "Complete nutrition insights" },
    { icon: Star, label: "AI Workout Generation", description: "Personalized training plans" },
    { icon: Crown, label: "Trainer Marketplace Access", description: "Connect with professionals" },
    { icon: Gift, label: "Priority Support", description: "Get help when you need it" },
  ];

  if (productsLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const premiumProduct = productsData?.products?.find(
    (p) => p.metadata?.plan_code === "premium"
  );

  const hasActiveSubscription =
    subscriptionData?.status === "active" || subscriptionData?.status === "trialing";

  if (hasActiveSubscription && subscriptionData?.subscription) {
    const endDate = subscriptionData.subscription.stripeData?.currentPeriodEnd
      ? new Date(subscriptionData.subscription.stripeData.currentPeriodEnd * 1000)
      : null;
    const isCanceling = subscriptionData.subscription.stripeData?.cancelAtPeriodEnd;

    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Subscription</h1>
          </div>
        </header>

        <div className="p-4 space-y-6">
          <Card className="border-primary">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">LOBA Premium</CardTitle>
              </div>
              <Badge
                variant={isCanceling ? "secondary" : "default"}
                data-testid="badge-subscription-status"
              >
                {isCanceling ? "Canceling" : subscriptionData.status === "trialing" ? "Trial" : "Active"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {endDate && (
                <p className="text-sm text-muted-foreground" data-testid="text-renewal-date">
                  {isCanceling
                    ? `Access until ${endDate.toLocaleDateString()}`
                    : `Renews on ${endDate.toLocaleDateString()}`}
                </p>
              )}

              <div className="space-y-2">
                {premiumFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Upgrade to Premium</h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {trialData?.eligible && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">7-Day Free Trial</p>
                <p className="text-sm text-muted-foreground">
                  Try Premium free for 7 days. Cancel anytime.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <h2 className="text-base font-medium">Premium Features</h2>
          <div className="space-y-2">
            {premiumFeatures.map((feature, index) => (
              <Card key={index} className="bg-card">
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {premiumProduct && (
          <div className="space-y-3">
            <h2 className="text-base font-medium">Choose Your Plan</h2>
            <div className="grid gap-3">
              {premiumProduct.prices
                .sort((a, b) => {
                  const order = ["monthly", "quarterly", "semi_annual", "annual"];
                  return (
                    order.indexOf(a.metadata.tier || "") -
                    order.indexOf(b.metadata.tier || "")
                  );
                })
                .map((price) => {
                  const isSelected = selectedPriceId === price.id;
                  const monthlyEquivalent = getMonthlyEquivalent(price);
                  const savings = price.metadata.discount;

                  return (
                    <Card
                      key={price.id}
                      className={cn(
                        "cursor-pointer transition-all hover-elevate",
                        isSelected && "border-primary ring-1 ring-primary"
                      )}
                      onClick={() => setSelectedPriceId(price.id)}
                      data-testid={`card-price-${price.metadata.tier}`}
                    >
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border-2",
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {price.metadata.display_name?.replace("LOBA Premium ", "")}
                              </span>
                              {savings && (
                                <Badge variant="secondary" className="text-xs">
                                  Save {savings}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              ${monthlyEquivalent.toFixed(2)}/month equivalent
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            ${(price.unit_amount / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBillingCycle(price)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-base font-medium">Have a promo code?</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Enter code"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoValidation(null);
              }}
              className="flex-1"
              data-testid="input-promo-code"
            />
            <Button
              variant="outline"
              onClick={() => validatePromoMutation.mutate(promoCode)}
              disabled={!promoCode || validatePromoMutation.isPending}
              data-testid="button-apply-promo"
            >
              {validatePromoMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
          {promoValidation && (
            <p
              className={cn(
                "text-sm",
                promoValidation.valid ? "text-green-600" : "text-destructive"
              )}
              data-testid="text-promo-result"
            >
              {promoValidation.valid
                ? `${promoValidation.discountType === "percent" ? promoValidation.discountValue + "%" : "$" + (promoValidation.discountValue! / 100).toFixed(2)} discount applied!`
                : promoValidation.message}
            </p>
          )}
        </div>

        <Button
          className="w-full h-12"
          size="lg"
          onClick={handleCheckout}
          disabled={!selectedPriceId || checkoutMutation.isPending}
          data-testid="button-checkout"
        >
          {checkoutMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Crown className="h-5 w-5 mr-2" />
          )}
          {trialData?.eligible ? "Start Free Trial" : "Subscribe Now"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By subscribing, you agree to our Terms of Service and Privacy Policy.
          {trialData?.eligible && " Your card will be charged after the 7-day trial."}
        </p>
      </div>
    </div>
  );
}

function getMonthlyEquivalent(price: Price): number {
  const amount = price.unit_amount / 100;
  const interval = price.recurring.interval;
  const intervalCount = price.recurring.interval_count;

  if (interval === "year") {
    return amount / 12;
  } else if (interval === "month") {
    return amount / intervalCount;
  }
  return amount;
}

function formatBillingCycle(price: Price): string {
  const interval = price.recurring.interval;
  const count = price.recurring.interval_count;

  if (interval === "year" && count === 1) return "billed yearly";
  if (interval === "month" && count === 1) return "billed monthly";
  if (interval === "month" && count === 3) return "billed quarterly";
  if (interval === "month" && count === 6) return "billed semi-annually";
  return `billed every ${count} ${interval}s`;
}
