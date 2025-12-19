import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Package, ShoppingCart, User, Loader2, Crown, AlertCircle, CheckCircle, Users, Search, X, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, formatBillingInterval, productTypeLabels } from "@/lib/trainer-products";
import { TrainerCard, TrainerCardSkeleton } from "@/components/TrainerCard";
import { useDiscoverTrainers, useMyTrainers, PROFESSION_TYPES, LANGUAGES, type MarketplaceFilters } from "@/hooks/useMarketplace";

interface MarketplaceProduct {
  id: string;
  name: string;
  description: string | null;
  productType: 'one_time' | 'subscription' | 'package' | 'free';
  trainerId: string;
  trainerName?: string;
  pricing: {
    id: string;
    amountCents: number;
    currency: string;
    billingInterval: string | null;
    intervalCount: number | null;
    stripePriceId: string | null;
    isActive: boolean;
  }[];
}

function TrainerDiscoveryTab() {
  const { user } = useSupabaseAuth();
  const [filters, setFilters] = useState<MarketplaceFilters>({});
  const [page, setPage] = useState(1);

  const { data: myTrainersData, isLoading: myTrainersLoading } = useMyTrainers(!!user);
  const { data: discoverData, isLoading: discoverLoading } = useDiscoverTrainers({ ...filters, page, limit: 12 });

  const myTrainers = myTrainersData || [];
  const discoverTrainers = discoverData?.storefronts || [];
  const total = discoverData?.total ?? 0;
  const limit = discoverData?.limit ?? 12;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const hasActiveFilters = filters.language || filters.professionType || filters.acceptingClients !== undefined;

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {user && (
        <section data-testid="section-your-trainers">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Trainers
          </h2>
          {myTrainersLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <TrainerCardSkeleton />
              <TrainerCardSkeleton />
            </div>
          ) : myTrainers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <UserPlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No connected trainers yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Browse trainers below to find one that fits your goals
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myTrainers.map(trainer => (
                <TrainerCard key={trainer.id} trainer={trainer} />
              ))}
            </div>
          )}
        </section>
      )}

      <section data-testid="section-discover-trainers">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Search className="w-5 h-5" />
            Discover Trainers
          </h2>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-reset-filters"
            >
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1 min-w-[150px]" data-testid="filter-profession">
            <Label className="text-xs text-muted-foreground mb-1 block">Profession</Label>
            <Select
              value={filters.professionType || "all"}
              onValueChange={(value) => {
                setFilters(f => ({ ...f, professionType: value === "all" ? undefined : value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" data-testid="select-profession">
                <SelectValue placeholder="All Professions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Professions</SelectItem>
                {PROFESSION_TYPES.map(pt => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]" data-testid="filter-language">
            <Label className="text-xs text-muted-foreground mb-1 block">Language</Label>
            <Select
              value={filters.language || "all"}
              onValueChange={(value) => {
                setFilters(f => ({ ...f, language: value === "all" ? undefined : value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" data-testid="select-language">
                <SelectValue placeholder="All Languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 min-w-[180px]" data-testid="filter-accepting">
            <Switch
              id="accepting-clients"
              data-testid="switch-accepting-clients"
              checked={filters.acceptingClients === true}
              onCheckedChange={(checked) => {
                setFilters(f => ({ ...f, acceptingClients: checked ? true : undefined }));
                setPage(1);
              }}
            />
            <Label htmlFor="accepting-clients" className="text-sm">
              Accepting clients only
            </Label>
          </div>
        </div>

        {discoverLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <TrainerCardSkeleton key={i} />)}
          </div>
        ) : discoverTrainers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No trainers found</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? "Try adjusting your filters to see more results"
                  : "Check back soon as more trainers join the platform"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters-empty">
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {discoverTrainers.map(trainer => (
                <TrainerCard key={trainer.id} trainer={trainer} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  data-testid="button-load-more"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ProductsTab() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const { data: subscriptionData } = useQuery({
    queryKey: ['/api/stripe/subscription'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      
      const response = await fetch('/api/stripe/subscription', { 
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user,
    retry: false,
    staleTime: 30000,
  });

  const isPremium = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';

  const { data: products, isLoading, error } = useQuery<MarketplaceProduct[]>({
    queryKey: ['/api/marketplace/products'],
    queryFn: async () => {
      const response = await fetch('/api/marketplace/products', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ['/api/client/purchases'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return [];
      
      const response = await fetch('/api/client/purchases', { 
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
    retry: false,
  });

  const purchasedProductIds = new Set(
    (purchases || []).filter((p: any) => p.status === 'completed').map((p: any) => p.productId)
  );

  const handleCheckout = async (product: MarketplaceProduct, pricingId: string) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to purchase products", variant: "destructive" });
      return;
    }

    if (!isPremium) {
      toast({ 
        title: "Premium Required", 
        description: "Upgrade to LOBA Premium to access trainer products", 
        variant: "destructive" 
      });
      return;
    }

    setCheckoutLoading(pricingId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please log in to continue');
      }

      const response = await fetch(`/api/products/${product.id}/checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          pricingId,
          successUrl: `${window.location.origin}/marketplace?tab=products&success=true&product=${product.id}`,
          cancelUrl: `${window.location.origin}/marketplace?tab=products&canceled=true`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive py-8">
        <AlertCircle className="h-5 w-5" />
        <span>Failed to load marketplace products</span>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No products available</h3>
          <p className="text-muted-foreground">
            Check back soon for new products from trainers.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!isPremium && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Upgrade to LOBA Premium to purchase trainer products
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {products.map(product => {
          const primaryPricing = product.pricing.find(p => p.isActive);
          const isPurchased = purchasedProductIds.has(product.id);

          return (
            <Card key={product.id} data-testid={`card-marketplace-product-${product.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    {product.trainerName && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <User className="h-3 w-3" />
                        <span>{product.trainerName}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">{productTypeLabels[product.productType]}</Badge>
                </div>
                {product.description && (
                  <CardDescription className="mt-2 line-clamp-2">
                    {product.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {primaryPricing ? (
                  <div className="text-2xl font-bold">
                    {product.productType === 'free' 
                      ? 'Free' 
                      : formatPrice(primaryPricing.amountCents, primaryPricing.currency)}
                    {primaryPricing.billingInterval && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{formatBillingInterval(primaryPricing.billingInterval, primaryPricing.intervalCount)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">Pricing not available</div>
                )}
              </CardContent>
              <CardFooter>
                {isPurchased ? (
                  <Button disabled className="w-full" variant="outline">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Purchased
                  </Button>
                ) : (
                  <Button 
                    className="w-full"
                    disabled={!isPremium || !primaryPricing || checkoutLoading === primaryPricing?.id}
                    onClick={() => primaryPricing && handleCheckout(product, primaryPricing.id)}
                    data-testid={`button-buy-${product.id}`}
                  >
                    {checkoutLoading === primaryPricing?.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-4 w-4 mr-2" />
                    )}
                    {!isPremium ? 'Upgrade to Purchase' : 'Purchase'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState("trainers");

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Users className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-marketplace-title">Marketplace</h1>
          <p className="text-muted-foreground">Find trainers and browse products</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="trainers" data-testid="tab-trainers">
            <Users className="w-4 h-4 mr-2" />
            Find a Trainer
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="w-4 h-4 mr-2" />
            Products
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trainers" className="mt-6">
          <TrainerDiscoveryTab />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <ProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
