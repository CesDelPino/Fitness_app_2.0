import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Check, MapPin, Clock, Star, ChevronLeft, Award, 
  MessageSquare, Calendar, Users, Instagram, Globe
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

const trainerProfile = {
  id: "1",
  firstName: "Sarah",
  lastName: "Chen",
  businessName: "Iron Will Fitness",
  headline: "Personalized coaching for busy parents. Get fit without sacrificing family time.",
  bio: "I specialize in functional fitness and postpartum recovery. After becoming a mom myself, I realized how challenging it can be to prioritize your health while juggling family responsibilities. My approach focuses on sustainable habits that fit into your real life - no extreme diets, no 2-hour gym sessions.\n\nI've helped over 200 clients transform their relationship with fitness, and I'm passionate about making strength training accessible to everyone.",
  location: "Chicago, IL",
  yearsExperience: 8,
  specialties: ["Functional Fitness", "Postpartum Recovery", "Nutrition Coaching", "Weight Loss", "Strength Training"],
  certifications: [
    "NASM Certified Personal Trainer",
    "Precision Nutrition Level 2 Coach", 
    "Pre/Postnatal Fitness Specialist",
    "Functional Movement Screen (FMS) Certified"
  ],
  avatarUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
  acceptingClients: true,
  rating: 4.9,
  reviewCount: 47,
  clientCount: 24,
  socialLinks: {
    instagram: "ironwillfitness",
    website: "ironwillfitness.com"
  },
  services: [
    {
      id: "1",
      title: "1-on-1 Training",
      price: "$90",
      description: "per session",
      features: ["Private studio sessions", "Custom workout plan", "Form correction & technique", "Progress tracking"],
    },
    {
      id: "2",
      title: "Online Coaching",
      price: "$120",
      description: "per month",
      features: ["Personalized workout app", "Weekly video check-ins", "Macro guidance", "24/7 chat support"],
      highlighted: true,
    },
    {
      id: "3",
      title: "Partner Training",
      price: "$60",
      description: "per person",
      features: ["Train with a friend", "Shared accountability", "Fun partner workouts", "Group motivation"],
    }
  ],
  testimonials: [
    {
      id: "1",
      clientName: "Jennifer M.",
      quote: "Sarah completely changed my approach to fitness. As a working mom of two, I never thought I'd have time to work out. Now I'm stronger than I was in my 20s!",
      rating: 5,
    },
    {
      id: "2", 
      clientName: "Amanda K.",
      quote: "The postpartum program was exactly what I needed. Sarah understood my body and helped me rebuild my core safely. Highly recommend!",
      rating: 5,
    },
    {
      id: "3",
      clientName: "Rachel T.",
      quote: "Best investment I've made in myself. Lost 30 lbs and gained so much confidence. Sarah's coaching goes way beyond just workouts.",
      rating: 5,
    }
  ],
  transformations: [
    {
      id: "1",
      beforeUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
      afterUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
      caption: "12-week transformation",
    },
    {
      id: "2",
      beforeUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
      afterUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
      caption: "6-month journey",
    }
  ]
};

export default function TrainerProfileDemo() {
  const trainer = trainerProfile;
  const fullName = `${trainer.firstName} ${trainer.lastName}`;
  const initials = `${trainer.firstName[0]}${trainer.lastName[0]}`;

  useEffect(() => {
    document.title = `${fullName} - ${trainer.businessName} | LOBA`;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/marketplace/demo">
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
          <Avatar className="w-28 h-28 flex-shrink-0">
            <AvatarImage src={trainer.avatarUrl} alt={fullName} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-trainer-name">{fullName}</h1>
                <p className="text-muted-foreground">{trainer.businessName}</p>
              </div>
              {trainer.acceptingClients ? (
                <Badge variant="default" data-testid="badge-status">
                  <Check className="w-3 h-3 mr-1" />
                  Accepting Clients
                </Badge>
              ) : (
                <Badge variant="secondary">Waitlist Only</Badge>
              )}
            </div>

            <p className="mt-3 text-muted-foreground">{trainer.headline}</p>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {trainer.location}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                {trainer.yearsExperience}+ years
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-primary text-primary" />
                <span className="font-medium">{trainer.rating}</span>
                <span className="text-muted-foreground">({trainer.reviewCount} reviews)</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-4 h-4" />
                {trainer.clientCount} active clients
              </span>
            </div>

            {/* Social Links */}
            {trainer.socialLinks && (
              <div className="flex gap-3 mt-4">
                {trainer.socialLinks.instagram && (
                  <a 
                    href={`https://instagram.com/${trainer.socialLinks.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {trainer.socialLinks.website && (
                  <a 
                    href={`https://${trainer.socialLinks.website}`}
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
            <div className="flex gap-3 mt-6">
              <Button size="lg" className="gap-2" data-testid="button-request">
                <Calendar className="w-4 h-4" />
                Request to Work Together
              </Button>
              <Button size="lg" variant="outline" className="gap-2" data-testid="button-message">
                <MessageSquare className="w-4 h-4" />
                Message
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="about" className="mt-8">
          <TabsList className="w-full justify-start" data-testid="tabs-profile">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          {/* About Tab */}
          <TabsContent value="about" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About {trainer.firstName}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{trainer.bio}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Specialties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {trainer.specialties.map((specialty, index) => (
                    <Badge key={index} variant="secondary">{specialty}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {trainer.certifications.map((cert, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      {cert}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            <div className="grid md:grid-cols-3 gap-4">
              {trainer.services.map((service) => (
                <Card 
                  key={service.id}
                  className={service.highlighted ? "border-primary shadow-md" : ""}
                  data-testid={`card-service-${service.id}`}
                >
                  <CardContent className="p-5">
                    {service.highlighted && (
                      <Badge className="mb-3">Most Popular</Badge>
                    )}
                    <h3 className="font-semibold text-lg">{service.title}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-2xl font-bold">{service.price}</span>
                      <span className="text-muted-foreground text-sm ml-1">{service.description}</span>
                    </div>
                    <ul className="space-y-2 mb-4">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      variant={service.highlighted ? "default" : "outline"} 
                      className="w-full"
                      data-testid={`button-select-service-${service.id}`}
                    >
                      Select
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="mt-6 space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl font-bold">{trainer.rating}</div>
              <div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-5 h-5 ${star <= Math.round(trainer.rating) ? 'fill-primary text-primary' : 'text-muted'}`} 
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{trainer.reviewCount} reviews</p>
              </div>
            </div>

            {trainer.testimonials.map((testimonial) => (
              <Card key={testimonial.id} data-testid={`card-review-${testimonial.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-4 h-4 ${star <= testimonial.rating ? 'fill-primary text-primary' : 'text-muted'}`} 
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">"{testimonial.quote}"</p>
                  <p className="mt-3 font-medium text-sm">{testimonial.clientName}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-6">
            <p className="text-muted-foreground mb-6">
              Real transformations from {trainer.firstName}'s clients
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {trainer.transformations.map((transformation) => (
                <Card key={transformation.id} data-testid={`card-transformation-${transformation.id}`}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 text-center">Before</p>
                        <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden">
                          <img 
                            src={transformation.beforeUrl} 
                            alt="Before" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 text-center">After</p>
                        <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden">
                          <img 
                            src={transformation.afterUrl} 
                            alt="After" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-center text-muted-foreground mt-3">
                      {transformation.caption}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky Bottom CTA (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden">
        <Button size="lg" className="w-full gap-2" data-testid="button-request-mobile">
          <Calendar className="w-4 h-4" />
          Request to Work Together
        </Button>
      </div>
    </div>
  );
}
