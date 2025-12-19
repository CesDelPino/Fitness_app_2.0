import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, MapPin, Award, Clock, ArrowRight, Star, Play, Instagram, Twitter, Globe } from "lucide-react";
import { useEffect } from "react";

interface TrainerConfig {
  branding: {
    businessName: string;
    accentColor?: string;
  };
  profile: {
    firstName: string;
    lastName: string;
    headline: string;
    bio: string;
    location?: string;
    yearsExperience?: number;
    specialties: string[];
    certifications: string[];
    avatarUrl?: string;
    heroImageUrl?: string;
    introVideoUrl?: string;
    videoThumbnailUrl?: string;
  };
  contact: {
    ctaText: string;
  };
  availability: {
    acceptingClients: boolean;
    waitlistEnabled?: boolean;
  };
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  services: Array<{
    title: string;
    price: string;
    description?: string;
    features: string[];
    highlighted?: boolean;
  }>;
  testimonials?: Array<{
    name: string;
    quote: string;
    avatarUrl?: string;
    rating?: number;
  }>;
  gallery?: string[];
}

const demoConfig: TrainerConfig = {
  branding: {
    businessName: "Iron Will Fitness",
  },
  profile: {
    firstName: "Sarah",
    lastName: "Chen",
    headline: "Personalized coaching for busy parents. Get fit without sacrificing family time.",
    bio: "I specialize in functional fitness and postpartum recovery. My goal is to help you feel strong and capable in your everyday life. No crash diets, just sustainable habits that work around your schedule. With over 8 years of experience, I've helped hundreds of busy parents transform their health without sacrificing what matters most.",
    location: "Chicago, IL",
    yearsExperience: 8,
    specialties: ["Functional Fitness", "Postpartum Recovery", "Nutrition Coaching", "Weight Loss"],
    certifications: ["NASM Certified Personal Trainer", "Precision Nutrition Coach", "Pre/Postnatal Specialist"],
    heroImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    introVideoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  contact: {
    ctaText: "Start Your Transformation",
  },
  availability: {
    acceptingClients: true,
    waitlistEnabled: false,
  },
  socialLinks: {
    instagram: "https://instagram.com/ironwillfitness",
    twitter: "https://twitter.com/ironwillfitness",
    website: "https://ironwillfitness.com",
  },
  services: [
    {
      title: "1-on-1 Training",
      price: "$90",
      description: "per session",
      features: ["Private studio sessions", "Custom workout plan", "Form correction & technique", "Progress tracking"],
    },
    {
      title: "Online Coaching",
      price: "$120",
      description: "per month",
      features: ["Personalized workout app", "Weekly video check-ins", "Macro guidance", "24/7 chat support"],
      highlighted: true,
    },
    {
      title: "Partner Training",
      price: "$60",
      description: "per person",
      features: ["Train with a friend", "Shared accountability", "Fun partner workouts", "Group motivation"],
    }
  ],
  testimonials: [
    {
      name: "Jessica M.",
      quote: "Sarah completely changed my relationship with fitness. As a new mom, I thought I'd never feel strong again. Now I'm in the best shape of my life!",
      rating: 5,
    },
    {
      name: "Mark T.",
      quote: "The online coaching program fit perfectly into my busy schedule. Lost 30 lbs in 4 months while actually enjoying the process.",
      rating: 5,
    },
    {
      name: "Amanda R.",
      quote: "Professional, knowledgeable, and genuinely caring. Sarah isn't just a trainer, she's a partner in your health journey.",
      rating: 5,
    }
  ],
  gallery: [
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  ]
};

function MinimalTemplate({ config }: { config: TrainerConfig }) {
  const fullName = `${config.profile.firstName} ${config.profile.lastName}`;

  useEffect(() => {
    document.title = `${config.branding.businessName} | LOBA`;
  }, [config.branding.businessName]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Simple Header */}
      <header className="py-16 md:py-24 border-b">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <Avatar className="w-20 h-20 mx-auto mb-6">
            <AvatarImage src={config.profile.avatarUrl} alt={fullName} />
            <AvatarFallback>{config.profile.firstName[0]}{config.profile.lastName[0]}</AvatarFallback>
          </Avatar>
          
          <h1 className="text-3xl font-bold mb-3" data-testid="text-hero-title">
            {fullName}
          </h1>
          
          {config.profile.location && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
              <MapPin className="w-4 h-4" />
              <span>{config.profile.location}</span>
            </div>
          )}
          
          <p className="text-lg text-muted-foreground mb-6" data-testid="text-hero-subtitle">
            {config.profile.headline}
          </p>

          {config.availability.acceptingClients && (
            <Badge variant="secondary" className="mb-6">
              <Check className="w-3 h-3 mr-1" />
              Accepting New Clients
            </Badge>
          )}
        </div>
      </header>

      {/* Bio */}
      <section className="py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-muted-foreground leading-relaxed mb-8" data-testid="text-about-bio">
            {config.profile.bio}
          </p>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {config.profile.specialties.map((specialty, index) => (
              <Badge key={index} variant="outline">
                {specialty}
              </Badge>
            ))}
          </div>

          {config.profile.yearsExperience && (
            <p className="text-sm text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-1" />
              {config.profile.yearsExperience}+ years of experience
            </p>
          )}
        </div>
      </section>

      {/* Services - Simple List */}
      <section className="py-12 md:py-16 border-t">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-xl font-semibold mb-8">Services</h2>
          
          <div className="space-y-6">
            {config.services.map((service, index) => (
              <div 
                key={index} 
                className="flex justify-between items-start pb-6 border-b last:border-0"
                data-testid={`service-${index}`}
              >
                <div>
                  <h3 className="font-medium">{service.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {service.features.slice(0, 2).join(" • ")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{service.price}</span>
                  {service.description && (
                    <span className="text-sm text-muted-foreground ml-1">{service.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-16 border-t">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">Client management powered by</p>
          <p className="text-xl font-bold text-primary mb-6">LOBA</p>
          
          <Button size="lg" asChild data-testid="button-client-signup">
            <a href="/" className="gap-2">
              Sign up as a client
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LOBA Health
          </p>
        </div>
      </footer>
    </div>
  );
}

function ShowcaseTemplate({ config }: { config: TrainerConfig }) {
  const fullName = `${config.profile.firstName} ${config.profile.lastName}`;

  useEffect(() => {
    document.title = `${config.branding.businessName} | LOBA`;
  }, [config.branding.businessName]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Full-bleed Hero */}
      <header 
        className="relative min-h-[80vh] flex items-end"
        data-testid="section-hero"
      >
        {config.profile.heroImageUrl ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${config.profile.heroImageUrl}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary/40" />
        )}
        
        <div className="relative z-10 w-full p-8 md:p-16 text-white">
          <div className="max-w-4xl">
            <Avatar className="w-16 h-16 border-2 border-white/30 mb-4">
              <AvatarImage src={config.profile.avatarUrl} alt={fullName} />
              <AvatarFallback>{config.profile.firstName[0]}{config.profile.lastName[0]}</AvatarFallback>
            </Avatar>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-4" data-testid="text-hero-title">
              {fullName}
            </h1>
            
            <p className="text-xl md:text-2xl opacity-90 mb-6 max-w-2xl" data-testid="text-hero-subtitle">
              {config.profile.headline}
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              {config.profile.location && (
                <span className="flex items-center gap-1 text-white/80">
                  <MapPin className="w-4 h-4" />
                  {config.profile.location}
                </span>
              )}
              {config.profile.yearsExperience && (
                <span className="text-white/80">
                  {config.profile.yearsExperience}+ years experience
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Gallery Grid */}
      {config.gallery && config.gallery.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {config.gallery.map((img, index) => (
                <div 
                  key={index} 
                  className="aspect-square overflow-hidden rounded-lg"
                  data-testid={`gallery-image-${index}`}
                >
                  <img 
                    src={img} 
                    alt={`Gallery ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About with Video */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Video */}
            {config.profile.introVideoUrl ? (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                <iframe
                  src={config.profile.introVideoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  data-testid="video-intro"
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Play className="w-12 h-12 mx-auto mb-2" />
                  <p>Video coming soon</p>
                </div>
              </div>
            )}
            
            {/* Bio */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Meet {config.profile.firstName}</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {config.profile.bio}
              </p>
              
              <div className="flex flex-wrap gap-2">
                {config.profile.specialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services - Cards */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Services</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {config.services.map((service, index) => (
              <Card 
                key={index} 
                className={service.highlighted ? "border-primary" : ""}
                data-testid={`card-service-${index}`}
              >
                <CardContent className="p-6">
                  {service.highlighted && (
                    <Badge className="mb-4">Popular</Badge>
                  )}
                  
                  <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                  
                  <div className="mb-4">
                    <span className="text-2xl font-bold">{service.price}</span>
                    {service.description && (
                      <span className="text-muted-foreground text-sm ml-1">
                        {service.description}
                      </span>
                    )}
                  </div>
                  
                  <ul className="space-y-2">
                    {service.features.map((feature, fIndex) => (
                      <li key={fIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform?</h2>
          <p className="opacity-90 mb-8">
            Join the LOBA platform to connect with {config.profile.firstName}
          </p>
          
          <Button size="lg" variant="secondary" asChild data-testid="button-client-signup">
            <a href="/" className="gap-2">
              Sign up as a client
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LOBA Health
          </p>
          
          {config.socialLinks && (
            <div className="flex items-center gap-4">
              {config.socialLinks.instagram && (
                <a href={config.socialLinks.instagram} className="text-muted-foreground hover:text-foreground">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {config.socialLinks.twitter && (
                <a href={config.socialLinks.twitter} className="text-muted-foreground hover:text-foreground">
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {config.socialLinks.website && (
                <a href={config.socialLinks.website} className="text-muted-foreground hover:text-foreground">
                  <Globe className="w-5 h-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function PremiumTemplate({ config }: { config: TrainerConfig }) {
  const fullName = `${config.profile.firstName} ${config.profile.lastName}`;

  useEffect(() => {
    document.title = `${config.branding.businessName} | LOBA`;
  }, [config.branding.businessName]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <div className="font-semibold text-lg" data-testid="text-business-name">
            {config.branding.businessName}
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <a href="#reviews" className="text-muted-foreground hover:text-foreground transition-colors">Reviews</a>
            <Button asChild>
              <a href="#cta">Get Started</a>
            </Button>
          </div>
          
          {config.socialLinks && (
            <div className="flex items-center gap-3 md:hidden">
              {config.socialLinks.instagram && (
                <a href={config.socialLinks.instagram} className="text-muted-foreground">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <header 
        id="hero"
        className="relative min-h-[70vh] flex items-center justify-center"
        data-testid="section-hero"
      >
        {config.profile.heroImageUrl ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${config.profile.heroImageUrl}')` }}
            />
            <div className="absolute inset-0 bg-black/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary/40" />
        )}
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 text-center text-white">
          <Avatar className="w-24 h-24 mx-auto mb-6 border-4 border-white/20">
            <AvatarImage src={config.profile.avatarUrl} alt={fullName} />
            <AvatarFallback className="text-2xl">{config.profile.firstName[0]}{config.profile.lastName[0]}</AvatarFallback>
          </Avatar>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-hero-title">
            {fullName}
          </h1>
          
          <p className="text-lg md:text-xl mb-6 max-w-2xl mx-auto opacity-90" data-testid="text-hero-subtitle">
            {config.profile.headline}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {config.profile.location && (
              <span className="flex items-center gap-1 text-white/80">
                <MapPin className="w-4 h-4" />
                {config.profile.location}
              </span>
            )}
            {config.availability.acceptingClients && (
              <Badge variant="secondary">
                <Check className="w-3 h-3 mr-1" />
                Accepting Clients
              </Badge>
            )}
          </div>
          
          <Button size="lg" asChild data-testid="button-hero-cta">
            <a href="#cta" className="gap-2">
              {config.contact.ctaText}
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </header>

      {/* Video Introduction */}
      {config.profile.introVideoUrl && (
        <section className="py-16 md:py-24 bg-muted/30" id="video">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Meet {config.profile.firstName}</h2>
              <p className="text-muted-foreground">Watch a quick introduction</p>
            </div>
            
            <div className="aspect-video bg-muted rounded-xl overflow-hidden shadow-lg">
              <iframe
                src={config.profile.introVideoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                data-testid="video-intro"
              />
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section id="about" className="py-16 md:py-24" data-testid="section-about">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6">
                About {config.profile.firstName}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6" data-testid="text-about-bio">
                {config.profile.bio}
              </p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                {config.profile.specialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
              
              {config.profile.yearsExperience && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{config.profile.yearsExperience}+ years of experience</span>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    Certifications
                  </h3>
                  <ul className="space-y-2">
                    {config.profile.certifications.map((cert, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              
              {config.socialLinks && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Connect</h3>
                    <div className="flex items-center gap-4">
                      {config.socialLinks.instagram && (
                        <a 
                          href={config.socialLinks.instagram} 
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <Instagram className="w-5 h-5" />
                          <span className="text-sm">Instagram</span>
                        </a>
                      )}
                      {config.socialLinks.website && (
                        <a 
                          href={config.socialLinks.website} 
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <Globe className="w-5 h-5" />
                          <span className="text-sm">Website</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      {config.gallery && config.gallery.length > 0 && (
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8 text-center">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {config.gallery.map((img, index) => (
                <div 
                  key={index} 
                  className="aspect-square overflow-hidden rounded-lg"
                  data-testid={`gallery-image-${index}`}
                >
                  <img 
                    src={img} 
                    alt={`Gallery ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section id="services" className="py-16 md:py-24" data-testid="section-services">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Training Packages</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Choose the program that fits your lifestyle and goals
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {config.services.map((service, index) => (
              <Card 
                key={index} 
                className={service.highlighted ? "border-primary shadow-lg" : ""}
                data-testid={`card-service-${index}`}
              >
                <CardContent className="p-6">
                  {service.highlighted && (
                    <Badge className="mb-4">Most Popular</Badge>
                  )}
                  
                  <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                  
                  <div className="mb-4">
                    <span className="text-3xl font-bold">{service.price}</span>
                    {service.description && (
                      <span className="text-muted-foreground text-sm ml-1">
                        {service.description}
                      </span>
                    )}
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {service.features.map((feature, fIndex) => (
                      <li key={fIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    variant={service.highlighted ? "default" : "outline"} 
                    className="w-full"
                    asChild
                    data-testid={`button-select-${index}`}
                  >
                    <a href="#cta">Select Plan</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      {config.testimonials && config.testimonials.length > 0 && (
        <section id="reviews" className="py-16 md:py-24 bg-muted/30" data-testid="section-reviews">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">What Clients Say</h2>
              <p className="text-muted-foreground">Real results from real people</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {config.testimonials.map((testimonial, index) => (
                <Card key={index} data-testid={`testimonial-${index}`}>
                  <CardContent className="p-6">
                    {testimonial.rating && (
                      <div className="flex gap-1 mb-4">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                        ))}
                      </div>
                    )}
                    
                    <p className="text-muted-foreground mb-4 italic">
                      "{testimonial.quote}"
                    </p>
                    
                    <p className="font-medium text-sm">{testimonial.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Platform CTA */}
      <section id="cta" className="py-16 md:py-24" data-testid="section-cta">
        <div className="max-w-2xl mx-auto px-4 text-center">
          {config.availability.acceptingClients ? (
            <Badge variant="default" className="mb-4" data-testid="badge-accepting">
              <Check className="w-3 h-3 mr-1" />
              Accepting New Clients
            </Badge>
          ) : (
            <Badge variant="secondary" className="mb-4" data-testid="badge-waitlist">
              Client List Full
            </Badge>
          )}
          
          <p className="text-muted-foreground mb-2">Client management powered by</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary">LOBA</h2>
          <p className="text-muted-foreground mb-8">
            Track your nutrition, workout progress, and connect with your trainer.
          </p>
          
          {config.availability.acceptingClients ? (
            <Button size="lg" asChild data-testid="button-client-signup">
              <a href="/" className="gap-2">
                Sign up as a client
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          ) : config.availability.waitlistEnabled ? (
            <Button size="lg" asChild data-testid="button-join-waitlist">
              <a href="/" className="gap-2">
                Join the Waitlist
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          ) : (
            <Button size="lg" variant="secondary" disabled data-testid="button-full">
              Currently Not Accepting Clients
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8" data-testid="section-footer">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} LOBA Health
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

export default function StorefrontTemplates() {
  const [, params] = useRoute("/s/demo/:template");
  const template = params?.template || "premium";

  const config = demoConfig;

  switch (template) {
    case "minimal":
      return <MinimalTemplate config={config} />;
    case "showcase":
      return <ShowcaseTemplate config={config} />;
    case "premium":
    default:
      return <PremiumTemplate config={config} />;
  }
}

export { MinimalTemplate, ShowcaseTemplate, PremiumTemplate };
