import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Check, MapPin, Award, Clock, ArrowRight, Star, 
  Instagram, Youtube, Globe, Twitter, Facebook,
  Mail, Calendar, Users, ChevronRight, Music
} from "lucide-react";
import { useEffect, useMemo } from "react";
import type { StorefrontWithDetails } from "../../../../server/supabase-storefront-data";

type StorefrontData = StorefrontWithDetails;

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      </nav>
      <div className="h-[70vh] bg-muted flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-24 w-24 rounded-full mx-auto" />
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 px-4">
        <h1 className="text-4xl font-bold">Storefront Not Found</h1>
        <p className="text-muted-foreground max-w-md">
          This storefront doesn't exist or hasn't been published yet.
        </p>
        <Button asChild>
          <a href="/">Go to Homepage</a>
        </Button>
      </div>
    </div>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  switch (platform.toLowerCase()) {
    case 'instagram': return <Instagram className="w-5 h-5" />;
    case 'youtube': return <Youtube className="w-5 h-5" />;
    case 'twitter': return <Twitter className="w-5 h-5" />;
    case 'facebook': return <Facebook className="w-5 h-5" />;
    case 'tiktok': return <Music className="w-5 h-5" />;
    case 'website': return <Globe className="w-5 h-5" />;
    default: return <Globe className="w-5 h-5" />;
  }
}

function formatSocialUrl(platform: string, value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const handle = value.startsWith('@') ? value.slice(1) : value;
  switch (platform.toLowerCase()) {
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'youtube': return `https://youtube.com/@${handle}`;
    case 'twitter': return `https://twitter.com/${handle}`;
    case 'facebook': return `https://facebook.com/${handle}`;
    case 'tiktok': return `https://tiktok.com/@${handle}`;
    default: return value;
  }
}

interface StorefrontContentProps {
  data: StorefrontData;
  variation: string;
}

function HeroSection({ data, accentColor }: { data: StorefrontData; accentColor?: string }) {
  const displayName = data.business_name || data.trainer_name || 'Professional';
  const heroImage = data.cover_image_url;
  
  return (
    <header 
      id="hero"
      className="relative min-h-[70vh] flex items-center justify-center"
      data-testid="section-hero"
    >
      {heroImage ? (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${heroImage}')` }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div 
          className="absolute inset-0" 
          style={{ 
            background: accentColor 
              ? `linear-gradient(135deg, ${accentColor}CC, ${accentColor}66)` 
              : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))'
          }} 
        />
      )}
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 text-center text-white">
        {data.trainer_photo_path && (
          <div className="mb-6">
            <img 
              src={data.trainer_photo_path} 
              alt={displayName}
              className="w-24 h-24 rounded-full mx-auto border-4 border-white/20 object-cover"
              data-testid="img-avatar"
            />
          </div>
        )}
        
        <h1 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-hero-title">
          {displayName}
        </h1>
        
        {data.headline && (
          <p className="text-lg md:text-xl mb-6 max-w-2xl mx-auto opacity-90" data-testid="text-hero-subtitle">
            {data.headline}
          </p>
        )}
        
        <div className="flex items-center justify-center gap-4 flex-wrap text-white/80 mb-8">
          {data.timezone && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{data.timezone.replace('_', ' ')}</span>
            </div>
          )}
          {data.languages && data.languages.length > 0 && (
            <div className="flex items-center gap-1">
              <Globe className="w-4 h-4" />
              <span className="text-sm">{data.languages.join(', ')}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {data.booking_url ? (
            <Button size="lg" asChild data-testid="button-hero-cta">
              <a href={data.booking_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                Book a Session
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          ) : (
            <Button size="lg" asChild data-testid="button-hero-cta">
              <a href="#contact" className="gap-2">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function AboutSection({ data }: { data: StorefrontData }) {
  const displayName = data.trainer_name?.split(' ')[0] || 'Me';
  const specialties = data.specialties || [];
  const credentials = data.credentials || [];
  
  if (!data.bio && specialties.length === 0 && credentials.length === 0) {
    return null;
  }
  
  return (
    <section id="about" className="py-16 md:py-24" data-testid="section-about">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6" data-testid="text-about-heading">
              About {displayName}
            </h2>
            {data.bio && (
              <p className="text-muted-foreground leading-relaxed mb-6 whitespace-pre-line" data-testid="text-about-bio">
                {data.bio}
              </p>
            )}
            
            {data.experience_years && (
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <Clock className="w-4 h-4" />
                <span>{data.experience_years}+ years of experience</span>
              </div>
            )}
            
            {data.profession_types && data.profession_types.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {data.profession_types.map((type, i) => (
                  <Badge key={i} variant="outline">{type}</Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            {specialties.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((specialty, index) => (
                      <Badge key={index} variant="secondary">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {credentials.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    Certifications & Credentials
                  </h3>
                  <ul className="space-y-2">
                    {credentials.map((cert, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ServicesSection({ data, accentColor }: { data: StorefrontData; accentColor?: string }) {
  const services = data.services || [];
  
  if (services.length === 0) return null;
  
  const sortedServices = [...services].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  
  return (
    <section id="services" className="py-16 md:py-24 bg-muted/50" data-testid="section-services">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Services & Packages</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Choose the program that fits your lifestyle and goals
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedServices.map((service) => (
            <Card 
              key={service.id} 
              className={service.is_featured ? "border-primary shadow-lg" : ""}
              data-testid={`card-service-${service.id}`}
            >
              <CardContent className="p-6">
                {service.is_featured && (
                  <Badge className="mb-4" style={accentColor ? { backgroundColor: accentColor } : undefined}>
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                )}
                
                <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                
                {service.price_display && (
                  <div className="mb-4">
                    <span className="text-2xl font-bold">{service.price_display}</span>
                    {service.duration && (
                      <span className="text-muted-foreground text-sm ml-2">
                        · {service.duration}
                      </span>
                    )}
                  </div>
                )}
                
                {service.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {service.description}
                  </p>
                )}
                
                <Button 
                  variant={service.is_featured ? "default" : "outline"} 
                  className="w-full"
                  asChild
                  data-testid={`button-service-${service.id}`}
                >
                  <a href="#contact">Learn More</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ data }: { data: StorefrontData }) {
  const testimonials = data.testimonials || [];
  
  if (testimonials.length === 0) return null;
  
  const sortedTestimonials = [...testimonials].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  
  return (
    <section id="testimonials" className="py-16 md:py-24" data-testid="section-testimonials">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Client Testimonials</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See what others have to say about working together
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTestimonials.map((testimonial) => (
            <Card key={testimonial.id} data-testid={`card-testimonial-${testimonial.id}`}>
              <CardContent className="p-6">
                {testimonial.is_featured && (
                  <Badge variant="secondary" className="mb-3">
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                )}
                
                {testimonial.rating && (
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i <= testimonial.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
                      />
                    ))}
                  </div>
                )}
                
                <blockquote className="text-muted-foreground mb-4 italic">
                  "{testimonial.quote}"
                </blockquote>
                
                <div className="flex items-center gap-3">
                  {testimonial.client_photo_url && (
                    <img 
                      src={testimonial.client_photo_url} 
                      alt={testimonial.client_name || 'Client'} 
                      className="w-10 h-10 rounded-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div>
                    <p className="font-medium">{testimonial.client_name}</p>
                    {testimonial.result_achieved && (
                      <p className="text-sm text-muted-foreground">{testimonial.result_achieved}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TransformationsSection({ data }: { data: StorefrontData }) {
  const transformations = data.transformations || [];
  
  if (transformations.length === 0) return null;
  
  const sortedTransformations = [...transformations].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  
  return (
    <section id="transformations" className="py-16 md:py-24 bg-muted/50" data-testid="section-transformations">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Transformations</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Real results from dedicated clients
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTransformations.map((transformation) => (
            <Card key={transformation.id} className="overflow-hidden" data-testid={`card-transformation-${transformation.id}`}>
              <CardContent className="p-0">
                <div className="grid grid-cols-2">
                  <div className="relative">
                    {transformation.before_image_url ? (
                      <img 
                        src={transformation.before_image_url} 
                        alt="Before" 
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">
                        Before
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Before
                    </span>
                  </div>
                  <div className="relative">
                    {transformation.after_image_url ? (
                      <img 
                        src={transformation.after_image_url} 
                        alt="After" 
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">
                        After
                      </div>
                    )}
                    <span className="absolute bottom-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      After
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {transformation.is_featured && (
                    <Badge variant="secondary" className="mb-2">
                      <Star className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                  {transformation.title && (
                    <h4 className="font-medium mb-1">{transformation.title}</h4>
                  )}
                  {transformation.duration_weeks && (
                    <p className="text-sm text-muted-foreground">
                      {transformation.duration_weeks} weeks
                    </p>
                  )}
                  {transformation.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {transformation.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ data, accentColor }: { data: StorefrontData; accentColor?: string }) {
  return (
    <section id="contact" className="py-16 md:py-24 bg-muted/30" data-testid="section-cta">
      <div className="max-w-2xl mx-auto px-4 text-center">
        {data.waitlist_enabled ? (
          <Badge variant="secondary" className="mb-4" data-testid="badge-waitlist">
            <Users className="w-3 h-3 mr-1" />
            Waitlist Open
          </Badge>
        ) : (
          <Badge variant="default" className="mb-4" data-testid="badge-accepting" style={accentColor ? { backgroundColor: accentColor } : undefined}>
            <Check className="w-3 h-3 mr-1" />
            Accepting New Clients
          </Badge>
        )}
        
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Ready to Get Started?
        </h2>
        <p className="text-muted-foreground mb-8">
          Take the first step towards your fitness goals today.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {data.booking_url ? (
            <Button size="lg" asChild data-testid="button-cta-book" style={accentColor ? { backgroundColor: accentColor } : undefined}>
              <a href={data.booking_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                <Calendar className="w-4 h-4" />
                Book a Session
              </a>
            </Button>
          ) : data.waitlist_enabled ? (
            <Button size="lg" asChild data-testid="button-cta-waitlist">
              <a href="/" className="gap-2">
                Join the Waitlist
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          ) : (
            <Button size="lg" asChild data-testid="button-cta-signup">
              <a href="/" className="gap-2">
                Sign Up as a Client
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
        
        <div className="mt-12 pt-8 border-t">
          <p className="text-muted-foreground mb-2 text-sm">Client management powered by</p>
          <p className="text-2xl font-bold text-primary">LOBA</p>
        </div>
      </div>
    </section>
  );
}

function SocialLinksSection({ data }: { data: StorefrontData }) {
  const socialLinks = data.social_links as Record<string, string> | null;
  
  if (!socialLinks || Object.keys(socialLinks).filter(k => socialLinks[k]).length === 0) {
    return null;
  }
  
  const links = Object.entries(socialLinks).filter(([_, value]) => value);
  
  return (
    <div className="flex items-center justify-center gap-4 py-8" data-testid="section-social">
      {links.map(([platform, value]) => (
        <a
          key={platform}
          href={formatSocialUrl(platform, value)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          data-testid={`link-social-${platform}`}
        >
          <SocialIcon platform={platform} />
        </a>
      ))}
    </div>
  );
}

function StorefrontContent({ data, variation }: StorefrontContentProps) {
  const displayName = data.business_name || data.trainer_name || 'Professional';
  const accentColor = data.accent_color || undefined;
  
  const services = data.services || [];
  const testimonials = data.testimonials || [];
  const transformations = data.transformations || [];
  
  const hasAbout = !!(data.bio || (data.specialties && data.specialties.length > 0) || (data.credentials && data.credentials.length > 0));
  const hasServices = services.length > 0;
  const hasTestimonials = testimonials.length > 0;
  const hasTransformations = transformations.length > 0;
  
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `${displayName} | LOBA`;
    
    const createdTags: Element[] = [];
    
    const setMetaTag = (selector: string, attr: string, attrValue: string, content: string) => {
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, attrValue);
        document.head.appendChild(tag);
        createdTags.push(tag);
      }
      tag.setAttribute('content', content);
    };
    
    const description = data.headline || data.bio?.slice(0, 160) || `${displayName} - Professional storefront`;
    
    setMetaTag('meta[name="description"]', 'name', 'description', description);
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', displayName);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', 'profile');
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', window.location.href);
    if (data.cover_image_url) {
      setMetaTag('meta[property="og:image"]', 'property', 'og:image', data.cover_image_url);
    }
    
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', displayName);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    if (data.cover_image_url) {
      setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', data.cover_image_url);
    }
    
    // JSON-LD structured data for SEO
    const jsonLdScript = document.createElement('script');
    jsonLdScript.type = 'application/ld+json';
    
    const services = data.services || [];
    const testimonials = data.testimonials || [];
    
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "name": displayName,
      "description": description,
      "url": window.location.href,
    };
    
    if (data.trainer_photo_path) {
      jsonLd.image = data.trainer_photo_path;
    }
    
    if (data.timezone) {
      jsonLd.areaServed = data.timezone.replace('_', ' ');
    }
    
    // Add services as offers
    if (services.length > 0) {
      jsonLd.hasOfferCatalog = {
        "@type": "OfferCatalog",
        "name": "Services",
        "itemListElement": services.map((s, idx) => ({
          "@type": "Offer",
          "position": idx + 1,
          "name": s.title,
          "description": s.description || undefined,
          "priceSpecification": s.price_display ? {
            "@type": "PriceSpecification",
            "price": s.price_display
          } : undefined
        }))
      };
    }
    
    // Add aggregate rating from testimonials
    if (testimonials.length > 0) {
      const ratingsWithValue = testimonials.filter(t => t.rating && t.rating > 0);
      if (ratingsWithValue.length > 0) {
        const avgRating = ratingsWithValue.reduce((sum, t) => sum + (t.rating || 0), 0) / ratingsWithValue.length;
        jsonLd.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": avgRating.toFixed(1),
          "reviewCount": ratingsWithValue.length,
          "bestRating": "5",
          "worstRating": "1"
        };
      }
      
      // Add first 3 reviews
      jsonLd.review = testimonials.slice(0, 3).map(t => ({
        "@type": "Review",
        "author": { "@type": "Person", "name": t.client_name || "Client" },
        "reviewBody": t.quote,
        "reviewRating": t.rating ? {
          "@type": "Rating",
          "ratingValue": t.rating,
          "bestRating": "5"
        } : undefined
      }));
    }
    
    jsonLdScript.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(jsonLdScript);
    createdTags.push(jsonLdScript);
    
    return () => {
      document.title = originalTitle;
      createdTags.forEach(tag => tag.remove());
    };
  }, [data, displayName]);
  
  const getSectionOrder = () => {
    const allSections = (() => {
      switch (variation) {
        case 'bold':
          return ['hero', 'services', 'about', 'testimonials', 'transformations', 'cta'];
        case 'services-first':
          return ['hero', 'services', 'testimonials', 'about', 'transformations', 'cta'];
        case 'story-driven':
          return ['hero', 'about', 'testimonials', 'transformations', 'services', 'cta'];
        case 'classic':
        default:
          return ['hero', 'about', 'services', 'testimonials', 'transformations', 'cta'];
      }
    })();
    
    return allSections.filter(section => {
      switch (section) {
        case 'hero': return true;
        case 'about': return hasAbout;
        case 'services': return hasServices;
        case 'testimonials': return hasTestimonials;
        case 'transformations': return hasTransformations;
        case 'cta': return true;
        default: return false;
      }
    });
  };
  
  const sectionOrder = getSectionOrder();
  
  const renderSection = (section: string) => {
    switch (section) {
      case 'hero':
        return <HeroSection key="hero" data={data} accentColor={accentColor} />;
      case 'about':
        return <AboutSection key="about" data={data} />;
      case 'services':
        return <ServicesSection key="services" data={data} accentColor={accentColor} />;
      case 'testimonials':
        return <TestimonialsSection key="testimonials" data={data} />;
      case 'transformations':
        return <TransformationsSection key="transformations" data={data} />;
      case 'cta':
        return <CTASection key="cta" data={data} accentColor={accentColor} />;
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <div className="font-semibold text-lg" data-testid="text-business-name">
            {displayName}
          </div>
          <div className="hidden md:flex items-center gap-4">
            {hasAbout && <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-about">About</a>}
            {hasServices && <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-services">Services</a>}
            {hasTestimonials && <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-testimonials">Testimonials</a>}
            <Button asChild data-testid="link-book-now" style={accentColor ? { backgroundColor: accentColor } : undefined}>
              <a href="#contact">Get Started</a>
            </Button>
          </div>
        </div>
      </nav>
      
      {sectionOrder.map(section => renderSection(section))}
      
      <SocialLinksSection data={data} />
      
      <footer className="border-t py-8" data-testid="section-footer">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {displayName}
            </p>
            <div className="flex items-center gap-6 text-sm">
              <a 
                href="/pro" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-trainer-signup"
              >
                Are you a trainer? Create your storefront
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PublicStorefront() {
  const [, params] = useRoute("/s/:slug");
  const slug = params?.slug;
  
  const { data, isLoading, error } = useQuery<StorefrontData>({
    queryKey: ['/api/storefronts', slug],
    enabled: !!slug,
  });
  
  if (!slug) {
    return <NotFoundPage />;
  }
  
  if (isLoading) {
    return <StorefrontSkeleton />;
  }
  
  if (error || !data) {
    return <NotFoundPage />;
  }
  
  const variation = data.storefront_variation || 'classic';
  
  return <StorefrontContent data={data} variation={variation} />;
}
