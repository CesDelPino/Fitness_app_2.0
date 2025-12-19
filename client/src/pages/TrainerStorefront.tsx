import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Award, Clock, ShoppingCart, ArrowLeft, Star } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StorefrontWithProducts, TrainerProduct, ProductPricing } from "@shared/schema";

interface StorefrontProduct {
  product: TrainerProduct;
  pricing: ProductPricing[];
}

interface StorefrontPreviewData extends StorefrontWithProducts {
  products?: StorefrontProduct[];
}

interface TrainerStorefrontProps {
  previewMode?: boolean;
  previewSlug?: string;
  previewStorefrontData?: StorefrontPreviewData | null;
  params?: { slug?: string };
}

function formatPrice(amountCents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function ProductCard({ 
  product, 
  pricing, 
  isPremium,
  onPurchase,
  previewMode = false
}: { 
  product: TrainerProduct; 
  pricing: ProductPricing[];
  isPremium: boolean;
  onPurchase: (productId: string, pricingId: string) => void;
  previewMode?: boolean;
}) {
  const primaryPrice = pricing.find(p => p.isPrimary) || pricing[0];
  
  if (!primaryPrice) return null;

  const isSubscription = product.productType === 'subscription';
  const isFree = product.productType === 'free' || primaryPrice.amountCents === 0;

  const purchaseButton = (
    <Button
      className="w-full"
      onClick={() => !previewMode && onPurchase(product.id, primaryPrice.id)}
      disabled={previewMode || (!isPremium && !isFree)}
      data-testid={`button-purchase-${product.id}`}
    >
      <ShoppingCart className="w-4 h-4 mr-2" />
      {isFree ? 'Get for Free' : isPremium || previewMode ? 'Purchase' : 'Upgrade to Purchase'}
    </Button>
  );

  return (
    <Card className="hover-elevate" data-testid={`card-product-${product.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg" data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </CardTitle>
            <CardDescription className="mt-1">
              <Badge variant="outline" className="text-xs">
                {product.productType === 'one_time' ? 'One-time' : 
                 product.productType === 'subscription' ? 'Subscription' :
                 product.productType === 'package' ? 'Package' : 'Free'}
              </Badge>
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary" data-testid={`text-product-price-${product.id}`}>
              {isFree ? 'Free' : formatPrice(primaryPrice.amountCents, primaryPrice.currency)}
            </p>
            {isSubscription && primaryPrice.billingInterval && (
              <p className="text-xs text-muted-foreground">
                per {primaryPrice.billingInterval}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      {product.description && (
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {product.description}
          </p>
        </CardContent>
      )}
      {product.featuresIncluded && product.featuresIncluded.length > 0 && (
        <CardContent className="pb-2 pt-0">
          <ul className="text-sm text-muted-foreground space-y-1">
            {product.featuresIncluded.slice(0, 3).map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                <Star className="w-3 h-3 text-primary" />
                {feature}
              </li>
            ))}
            {product.featuresIncluded.length > 3 && (
              <li className="text-xs text-muted-foreground/70">
                +{product.featuresIncluded.length - 3} more features
              </li>
            )}
          </ul>
        </CardContent>
      )}
      <CardFooter className="pt-2">
        {previewMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {purchaseButton}
            </TooltipTrigger>
            <TooltipContent>
              <p>This is how clients see your Buy button</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          purchaseButton
        )}
      </CardFooter>
    </Card>
  );
}

export default function TrainerStorefront({ previewMode = false, previewSlug, previewStorefrontData, params }: TrainerStorefrontProps = {}) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = previewSlug || params?.slug || routeSlug;
  
  const isPreviewMode = previewMode && !!previewSlug;
  const [, navigate] = useLocation();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  // Skip subscription check in preview mode - pro doesn't need premium to preview their own storefront
  const { data: subscriptionData } = useQuery<{ status: string }>({
    queryKey: ['/api/subscription'],
    enabled: !!user && !isPreviewMode,
  });
  const isPremium = isPreviewMode || subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';

  // In preview mode, use data passed from parent; otherwise fetch from public API
  const { data: fetchedStorefront, isLoading: storefrontLoading, error: storefrontError } = useQuery<StorefrontWithProducts>({
    queryKey: ['/api/storefront', slug],
    enabled: !!slug && !isPreviewMode,
  });
  
  // Use preview data if in preview mode, otherwise use fetched data
  const storefront = isPreviewMode ? previewStorefrontData : fetchedStorefront;

  const { data: fetchedProducts, isLoading: productsLoading } = useQuery<StorefrontProduct[]>({
    queryKey: ['/api/storefront', slug, 'products'],
    enabled: !!slug && !!storefront && !isPreviewMode,
  });
  
  // In preview mode, products are included in previewStorefrontData
  const products = isPreviewMode && previewStorefrontData?.products 
    ? previewStorefrontData.products 
    : fetchedProducts;

  const checkoutMutation = useMutation({
    mutationFn: async ({ productId, pricingId }: { productId: string; pricingId: string }) => {
      return apiRequest('POST', `/api/products/${productId}/checkout`, { pricingId });
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = (productId: string, pricingId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!isPremium) {
      toast({
        title: "Premium Required",
        description: "Upgrade to Premium to purchase trainer products.",
        variant: "default",
      });
      navigate('/subscription');
      return;
    }

    checkoutMutation.mutate({ productId, pricingId });
  };

  if (storefrontLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (storefrontError || !storefront) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate('/marketplace')} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Trainer Not Found</h2>
              <p className="text-muted-foreground">
                This trainer's page doesn't exist or is not available.
              </p>
              <Button className="mt-4" onClick={() => navigate('/marketplace')}>
                Browse Marketplace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {storefront.coverImageUrl && (
        <div 
          className="h-48 sm:h-64 bg-cover bg-center relative"
          style={{ backgroundImage: `url(${storefront.coverImageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        </div>
      )}
      
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {!isPreviewMode && (
          <Button 
            variant="ghost" 
            onClick={() => navigate('/marketplace')} 
            className="mb-4"
            data-testid="button-back-marketplace"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        )}

        <Card className={storefront.coverImageUrl ? "-mt-20 relative z-10" : ""}>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Avatar className="w-20 h-20 border-4 border-background">
                <AvatarImage 
                  src={storefront.trainerPhotoPath || (storefront.trainerPresetAvatarId ? `/avatars/${storefront.trainerPresetAvatarId}.svg` : undefined)} 
                  alt={storefront.trainerName} 
                />
                <AvatarFallback className="text-2xl">
                  {storefront.trainerName?.charAt(0) || 'T'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold" data-testid="text-trainer-name">
                  {storefront.trainerName}
                </h1>
                
                {storefront.headline && (
                  <p className="text-lg text-muted-foreground mt-1" data-testid="text-trainer-headline">
                    {storefront.headline}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 mt-3">
                  {storefront.experienceYears && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {storefront.experienceYears}+ years experience
                    </Badge>
                  )}
                  {storefront.approvedProductsCount > 0 && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />
                      {storefront.approvedProductsCount} product{storefront.approvedProductsCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {storefront.bio && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-trainer-bio">
                  {storefront.bio}
                </p>
              </div>
            )}

            {storefront.specialties && storefront.specialties.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {storefront.specialties.map((specialty, i) => (
                    <Badge key={i} variant="outline">{specialty}</Badge>
                  ))}
                </div>
              </div>
            )}

            {storefront.credentials && storefront.credentials.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Credentials</h3>
                <div className="flex flex-wrap gap-2">
                  {storefront.credentials.map((credential, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      {credential}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Products</h2>
          
          {productsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map(({ product, pricing }) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  pricing={pricing}
                  isPremium={isPremium}
                  onPurchase={handlePurchase}
                  previewMode={isPreviewMode}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  This trainer doesn't have any products available yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {!isPreviewMode && !isPremium && products && products.length > 0 && (
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Upgrade to Premium</h3>
                  <p className="text-sm text-muted-foreground">
                    Get access to purchase trainer products and more.
                  </p>
                </div>
                <Button onClick={() => navigate('/subscription')} data-testid="button-upgrade-premium">
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
