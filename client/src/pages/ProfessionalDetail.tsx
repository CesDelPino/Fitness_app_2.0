import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Check, Clock, Star, ChevronLeft, Award, 
  MessageSquare, Calendar, Instagram, Globe, Youtube, 
  ExternalLink, ShoppingCart, Briefcase, Loader2, MapPin, Users, UserPlus, TrendingUp
} from "lucide-react";
import { SiTiktok, SiFacebook, SiX } from "react-icons/si";
import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { 
  useProfessionalDetail, 
  getProfessionLabel,
  type ProfessionalProduct 
} from "@/hooks/useMarketplace";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

function formatPrice(amountCents: number, currency: string, interval?: string | null): string {
  const amount = amountCents / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
  
  if (interval) {
    return `${formatted}/${interval}`;
  }
  return formatted;
}

function getUtcOffset(timezone: string): string {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    if (offsetPart?.value) {
      if (offsetPart.value === 'GMT' || offsetPart.value === 'UTC') {
        return '(UTC)';
      }
      const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1];
        const hours = match[2];
        const mins = match[3] || '00';
        if (mins === '00') {
          return `(UTC ${sign}${hours})`;
        }
        return `(UTC ${sign}${hours}:${mins})`;
      }
    }
    return '';
  } catch {
    return '';
  }
}

function getTimezoneDisplay(timezone: string): string {
  const city = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
  const offset = getUtcOffset(timezone);
  return offset ? `${offset} ${city}` : city;
}

function getTimeDifference(timezone: string): string | null {
  try {
    const now = new Date();
    
    const getOffsetMinutes = (tz: string): number => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'longOffset'
      });
      const parts = formatter.formatToParts(now);
      const offsetPart = parts.find(p => p.type === 'timeZoneName');
      
      if (offsetPart?.value) {
        if (offsetPart.value === 'GMT' || offsetPart.value === 'UTC') return 0;
        
        const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
        if (match) {
          const sign = match[1] === '+' ? 1 : -1;
          const hours = parseInt(match[2], 10) || 0;
          const minutes = parseInt(match[3], 10) || 0;
          return sign * (hours * 60 + minutes);
        }
      }
      return 0;
    };
    
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localOffsetMinutes = getOffsetMinutes(localTz);
    const proOffsetMinutes = getOffsetMinutes(timezone);
    
    const diffMinutes = proOffsetMinutes - localOffsetMinutes;
    
    if (diffMinutes === 0) return 'Same timezone';
    
    const absDiff = Math.abs(diffMinutes);
    const hours = Math.floor(absDiff / 60);
    const mins = absDiff % 60;
    
    let timeStr = '';
    if (hours > 0) timeStr += `${hours}h`;
    if (mins > 0) timeStr += `${mins}m`;
    
    return diffMinutes > 0 ? `${timeStr} ahead` : `${timeStr} behind`;
  } catch {
    return null;
  }
}

function formatLocation(city: string | null, state: string | null, country: string | null): string | null {
  const parts = [city, state].filter(Boolean);
  if (parts.length === 0 && country) return country;
  if (parts.length === 0) return null;
  return parts.join(', ');
}

function ProductCard({ 
  product, 
  onBuy, 
  isLoading 
}: { 
  product: ProfessionalProduct; 
  onBuy: (productId: string, pricingId: string) => void;
  isLoading: boolean;
}) {
  const primaryPricing = product.pricing.find(p => p.isPrimary) || product.pricing[0];
  const isFree = !primaryPricing || primaryPricing.amountCents === 0;
  
  return (
    <Card data-testid={`card-product-${product.id}`}>
      <CardContent className="p-5">
        <Badge variant="secondary" className="mb-3">
          {product.productType === 'subscription' ? 'Subscription' : 
           product.productType === 'package' ? 'Package' : 'One-time'}
        </Badge>
        <h3 className="font-semibold text-lg">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-3 mb-4">
          {isFree ? (
            <span className="text-2xl font-bold text-primary">Free</span>
          ) : primaryPricing ? (
            <span className="text-2xl font-bold">
              {formatPrice(
                primaryPricing.amountCents, 
                primaryPricing.currency,
                primaryPricing.billingInterval
              )}
            </span>
          ) : (
            <span className="text-lg text-muted-foreground">Price not set</span>
          )}
        </div>
        {product.featuresIncluded && product.featuresIncluded.length > 0 && (
          <ul className="space-y-2 mb-4">
            {product.featuresIncluded.slice(0, 4).map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        )}
        <Button 
          className="w-full gap-2"
          onClick={() => primaryPricing && onBuy(product.id, primaryPricing.id)}
          disabled={isLoading || !primaryPricing}
          data-testid={`button-buy-product-${product.id}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShoppingCart className="w-4 h-4" />
          )}
          {isFree ? 'Get Access' : 'Buy Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded" />
          <Skeleton className="w-32 h-4" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <Skeleton className="w-28 h-28 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <Skeleton className="w-48 h-8" />
            <Skeleton className="w-full h-16" />
            <div className="flex gap-2">
              <Skeleton className="w-32 h-10" />
              <Skeleton className="w-32 h-10" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-full h-64" />
        </div>
      </main>
    </div>
  );
}

export default function ProfessionalDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, session } = useSupabaseAuth();
  const { data: pro, isLoading, error } = useProfessionalDetail(id);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (pro?.displayName) {
      document.title = `${pro.displayName} | LOBA`;
    }
    return () => {
      document.title = 'LOBA';
    };
  }, [pro?.displayName]);

  const handleBuyProduct = async (productId: string, pricingId: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to purchase products",
        variant: "destructive"
      });
      setLocation('/auth');
      return;
    }

    setCheckoutLoading(productId);
    try {
      if (!session?.access_token) {
        toast({
          title: "Session Error",
          description: "Please log in again to continue",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`/api/products/${productId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ pricingId }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: "Checkout Failed",
        description: err instanceof Error ? err.message : "Unable to start checkout",
        variant: "destructive"
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleMessage = () => {
    if (pro?.proId) {
      setLocation(`/messages/${pro.proId}`);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !pro) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Professional Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This profile doesn't exist or you don't have access to view it.
            </p>
            <Link href="/marketplace">
              <Button data-testid="button-back-marketplace">Back to Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = pro.displayName || 'Professional';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const firstName = displayName.split(' ')[0];
  const location = formatLocation(pro.locationCity, pro.locationState, pro.locationCountry);
  const timeDiff = pro.timezone ? getTimeDifference(pro.timezone) : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/marketplace">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">Back to Marketplace</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <UserAvatar
            photoPath={pro.photoPath}
            name={displayName}
            className="w-28 h-28 flex-shrink-0"
            fallbackClassName="text-2xl"
          />

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-pro-name">{displayName}</h1>
                {pro.businessName && (
                  <p className="text-lg text-muted-foreground" data-testid="text-business-name">{pro.businessName}</p>
                )}
                {pro.professionTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pro.professionTypes.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs gap-1">
                        <Briefcase className="w-3 h-3" />
                        {getProfessionLabel(type)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {pro.isConnected && (
                  <Badge variant="default" data-testid="badge-connected">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
                {!pro.isConnected && pro.acceptingNewClients && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid="badge-accepting">
                    <UserPlus className="w-3 h-3 mr-1" />
                    Accepting Clients
                  </Badge>
                )}
              </div>
            </div>

            {pro.headline && (
              <p className="mt-3 text-muted-foreground">{pro.headline}</p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              {location && (
                <span className="flex items-center gap-1 text-muted-foreground" data-testid="text-location">
                  <MapPin className="w-4 h-4" />
                  {location}
                  {timeDiff && <span className="text-xs ml-1">({timeDiff})</span>}
                </span>
              )}
              {pro.experienceYears && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Award className="w-4 h-4" />
                  {pro.experienceYears}+ years
                </span>
              )}
              {pro.activeClientsCount > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground" data-testid="text-active-clients">
                  <Users className="w-4 h-4" />
                  {pro.activeClientsCount} active client{pro.activeClientsCount !== 1 ? 's' : ''}
                </span>
              )}
              {pro.testimonials.length > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  <span className="text-muted-foreground">
                    {pro.testimonials.length} review{pro.testimonials.length !== 1 ? 's' : ''}
                  </span>
                </span>
              )}
            </div>

            {/* Languages */}
            {pro.languages.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {pro.languages.map((lang) => (
                  <Badge key={lang} variant="secondary" className="text-xs">
                    {lang.toUpperCase()}
                  </Badge>
                ))}
              </div>
            )}

            {/* Social Links */}
            {pro.socialLinks && Object.keys(pro.socialLinks).length > 0 && (
              <div className="flex gap-3 mt-4">
                {pro.socialLinks.instagram && (
                  <a 
                    href={`https://instagram.com/${pro.socialLinks.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {pro.socialLinks.youtube && (
                  <a 
                    href={`https://youtube.com/${pro.socialLinks.youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-youtube"
                  >
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
                {pro.socialLinks.tiktok && (
                  <a 
                    href={`https://tiktok.com/@${pro.socialLinks.tiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-tiktok"
                  >
                    <SiTiktok className="w-5 h-5" />
                  </a>
                )}
                {pro.socialLinks.twitter && (
                  <a 
                    href={`https://twitter.com/${pro.socialLinks.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-twitter"
                  >
                    <SiX className="w-5 h-5" />
                  </a>
                )}
                {pro.socialLinks.facebook && (
                  <a 
                    href={`https://facebook.com/${pro.socialLinks.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-facebook"
                  >
                    <SiFacebook className="w-5 h-5" />
                  </a>
                )}
                {pro.socialLinks.website && (
                  <a 
                    href={pro.socialLinks.website.startsWith('http') ? pro.socialLinks.website : `https://${pro.socialLinks.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-website"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {!pro.isConnected && pro.acceptingNewClients && (
                <Link href={`/marketplace/request/${pro.proId}`}>
                  <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700" data-testid="button-request-work">
                    <UserPlus className="w-4 h-4" />
                    Request to Work Together
                  </Button>
                </Link>
              )}
              {pro.isConnected && (
                <Button size="lg" variant="outline" className="gap-2" onClick={handleMessage} data-testid="button-message">
                  <MessageSquare className="w-4 h-4" />
                  Message
                </Button>
              )}
              {!pro.isConnected && (
                <Button size="lg" variant="outline" className="gap-2" onClick={handleMessage} data-testid="button-message">
                  <MessageSquare className="w-4 h-4" />
                  Message
                </Button>
              )}
              {pro.bookingUrl && (
                <a href={pro.bookingUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="gap-2" data-testid="button-book">
                    <Calendar className="w-4 h-4" />
                    Book Consultation
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tabs - Reordered: About, Products, Reviews, Results */}
        <Tabs defaultValue="about" className="mt-8">
          <TabsList className="w-full justify-start" data-testid="tabs-profile">
            <TabsTrigger value="about" data-testid="tab-about">About</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">
              Products {pro.products.length > 0 && `(${pro.products.length})`}
            </TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">
              Reviews {pro.testimonials.length > 0 && `(${pro.testimonials.length})`}
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              Results {pro.transformations.length > 0 && `(${pro.transformations.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-6">
            {pro.products.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Products Available</h3>
                  <p className="text-muted-foreground">
                    This professional hasn't added any products yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pro.products.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onBuy={handleBuyProduct}
                    isLoading={checkoutLoading === product.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Reviews Tab - Testimonials Only */}
          <TabsContent value="reviews" className="mt-6 space-y-4">
            {pro.testimonials.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Reviews Yet</h3>
                  <p className="text-muted-foreground">
                    Be the first to leave a review!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {pro.testimonials.map((testimonial) => (
                  <Card key={testimonial.id} data-testid={`card-review-${testimonial.id}`}>
                    <CardContent className="p-5">
                      {testimonial.rating && (
                        <div className="flex items-center gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`w-4 h-4 ${star <= (testimonial.rating || 0) ? 'fill-primary text-primary' : 'text-muted'}`} 
                            />
                          ))}
                        </div>
                      )}
                      {testimonial.quote && (
                        <p className="text-muted-foreground italic">"{testimonial.quote}"</p>
                      )}
                      {testimonial.client_name && (
                        <p className="mt-3 font-medium text-sm">{testimonial.client_name}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* Results Tab - Transformations (Before/After) */}
          <TabsContent value="results" className="mt-6">
            {pro.transformations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Results Yet</h3>
                  <p className="text-muted-foreground">
                    This professional hasn't added client transformations yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {pro.transformations.map((transformation) => (
                  <Card key={transformation.id} data-testid={`card-transformation-${transformation.id}`}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 text-center">Before</p>
                          <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden">
                            {transformation.before_image_url && (
                              <img 
                                src={transformation.before_image_url} 
                                alt="Before" 
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 text-center">After</p>
                          <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden">
                            {transformation.after_image_url && (
                              <img 
                                src={transformation.after_image_url} 
                                alt="After" 
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      {(transformation.title || transformation.duration_weeks) && (
                        <p className="text-sm text-center text-muted-foreground mt-3">
                          {transformation.title || `${transformation.duration_weeks} week transformation`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="mt-6 space-y-6">
            {pro.bio && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About {firstName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{pro.bio}</p>
                </CardContent>
              </Card>
            )}

            {pro.specialties.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Specialties</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {pro.specialties.map((specialty, index) => (
                      <Badge key={index} variant="secondary">{specialty}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {pro.credentials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    Certifications & Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {pro.credentials.map((cert, index) => (
                      <li key={index} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {!pro.bio && pro.specialties.length === 0 && pro.credentials.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Additional Information</h3>
                  <p className="text-muted-foreground">
                    This professional hasn't added their bio or credentials yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky Bottom CTA (Mobile) */}
      {pro.products.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden">
          <Button size="lg" className="w-full gap-2" data-testid="button-view-products-mobile">
            <ShoppingCart className="w-4 h-4" />
            View Products ({pro.products.length})
          </Button>
        </div>
      )}
    </div>
  );
}
