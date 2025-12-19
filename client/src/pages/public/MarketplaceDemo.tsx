import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, MapPin, Clock, Star, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";
import { Link } from "wouter";

interface TrainerCard {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  headline: string;
  location: string;
  yearsExperience: number;
  specialties: string[];
  avatarUrl?: string;
  acceptingClients: boolean;
  rating?: number;
  reviewCount?: number;
  startingPrice?: string;
}

const demoTrainers: TrainerCard[] = [
  {
    id: "1",
    firstName: "Sarah",
    lastName: "Chen",
    businessName: "Iron Will Fitness",
    headline: "Personalized coaching for busy parents",
    location: "Chicago, IL",
    yearsExperience: 8,
    specialties: ["Functional Fitness", "Postpartum Recovery", "Nutrition"],
    avatarUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    acceptingClients: true,
    rating: 4.9,
    reviewCount: 47,
    startingPrice: "$90/session",
  },
  {
    id: "2",
    firstName: "Marcus",
    lastName: "Johnson",
    businessName: "Peak Performance Training",
    headline: "Strength & conditioning for athletes",
    location: "Austin, TX",
    yearsExperience: 12,
    specialties: ["Strength Training", "Sports Performance", "Mobility"],
    avatarUrl: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    acceptingClients: true,
    rating: 5.0,
    reviewCount: 89,
    startingPrice: "$120/session",
  },
  {
    id: "3",
    firstName: "Emma",
    lastName: "Rodriguez",
    businessName: "Mind Body Balance",
    headline: "Holistic wellness & stress management",
    location: "Miami, FL",
    yearsExperience: 6,
    specialties: ["Yoga", "Meditation", "Weight Loss"],
    avatarUrl: "https://images.unsplash.com/photo-1594381898411-846e7d193883?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    acceptingClients: false,
    rating: 4.8,
    reviewCount: 32,
    startingPrice: "$75/session",
  },
  {
    id: "4",
    firstName: "David",
    lastName: "Kim",
    businessName: "Elite Physique",
    headline: "Competition prep & body transformation",
    location: "Los Angeles, CA",
    yearsExperience: 10,
    specialties: ["Bodybuilding", "Contest Prep", "Nutrition Planning"],
    avatarUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    acceptingClients: true,
    rating: 4.7,
    reviewCount: 156,
    startingPrice: "$150/session",
  },
];

function TrainerCardComponent({ trainer }: { trainer: TrainerCard }) {
  const fullName = `${trainer.firstName} ${trainer.lastName}`;
  const initials = `${trainer.firstName[0]}${trainer.lastName[0]}`;

  return (
    <Card className="hover-elevate transition-all" data-testid={`card-trainer-${trainer.id}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Avatar */}
          <Avatar className="w-16 h-16 flex-shrink-0">
            <AvatarImage src={trainer.avatarUrl} alt={fullName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold truncate" data-testid={`text-name-${trainer.id}`}>
                  {fullName}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {trainer.businessName}
                </p>
              </div>
              {trainer.acceptingClients ? (
                <Badge variant="default" className="flex-shrink-0 text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex-shrink-0 text-xs">
                  Waitlist
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {trainer.headline}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {trainer.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {trainer.yearsExperience}+ yrs
              </span>
              {trainer.rating && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-primary text-primary" />
                  {trainer.rating} ({trainer.reviewCount})
                </span>
              )}
            </div>

            {/* Specialties */}
            <div className="flex flex-wrap gap-1 mt-3">
              {trainer.specialties.slice(0, 3).map((specialty, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          {trainer.startingPrice && (
            <span className="text-sm">
              From <span className="font-semibold">{trainer.startingPrice}</span>
            </span>
          )}
          <Link href={`/marketplace/trainer/${trainer.id}`}>
            <Button size="sm" className="gap-1" data-testid={`button-view-${trainer.id}`}>
              View Profile
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketplaceDemo() {
  useEffect(() => {
    document.title = "Find a Trainer | LOBA";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-primary" data-testid="text-logo">LOBA</h1>
          <div className="text-sm text-muted-foreground">Marketplace Demo</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-page-title">
            Find Your Trainer
          </h2>
          <p className="text-muted-foreground">
            Browse certified professionals ready to help you reach your goals
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, specialty, or location..." 
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="default" data-testid="button-filter-specialty">
              Specialty
            </Button>
            <Button variant="outline" size="default" data-testid="button-filter-location">
              Location
            </Button>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {demoTrainers.length} trainers
        </p>

        {/* Trainer Grid */}
        <div className="grid gap-4" data-testid="grid-trainers">
          {demoTrainers.map((trainer) => (
            <TrainerCardComponent key={trainer.id} trainer={trainer} />
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <Button variant="outline" data-testid="button-load-more">
            Load More Trainers
          </Button>
        </div>
      </main>

      {/* Footer CTA */}
      <footer className="border-t py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-muted-foreground mb-4">
            Are you a fitness professional?
          </p>
          <Button asChild data-testid="button-become-trainer">
            <a href="/pro">Create Your Storefront</a>
          </Button>
        </div>
      </footer>
    </div>
  );
}
