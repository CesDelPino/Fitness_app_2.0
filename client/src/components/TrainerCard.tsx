import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Check, Clock, ChevronRight, Globe } from "lucide-react";
import { Link } from "wouter";
import type { MarketplaceStorefront } from "@/hooks/useMarketplace";

interface TrainerCardProps {
  trainer: MarketplaceStorefront;
}

export function TrainerCard({ trainer }: TrainerCardProps) {
  const displayName = trainer.trainer_name || trainer.business_name || 'Trainer';
  const isAccepting = !trainer.waitlist_enabled;

  const professionLabels: Record<string, string> = {
    trainer: 'Personal Trainer',
    nutritionist: 'Nutritionist',
    yoga: 'Yoga Instructor',
    wellness: 'Wellness Coach',
    physio: 'Physiotherapist',
  };

  const primaryProfession = trainer.profession_types?.[0];
  const professionLabel = primaryProfession ? professionLabels[primaryProfession] : null;

  return (
    <Card className="hover-elevate transition-all" data-testid={`card-trainer-${trainer.slug}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <UserAvatar
            photoPath={trainer.trainer_photo_path}
            name={displayName}
            className="w-16 h-16 flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold truncate" data-testid={`text-name-${trainer.slug}`}>
                  {displayName}
                </h3>
                {trainer.business_name && trainer.trainer_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {trainer.business_name}
                  </p>
                )}
              </div>
              {isAccepting ? (
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

            {trainer.headline && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {trainer.headline}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {professionLabel && (
                <span className="flex items-center gap-1">
                  {professionLabel}
                </span>
              )}
              {trainer.experience_years && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {trainer.experience_years}+ yrs
                </span>
              )}
              {trainer.languages && trainer.languages.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {trainer.languages.slice(0, 2).join(', ')}
                </span>
              )}
            </div>

            {trainer.specialties && trainer.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {trainer.specialties.slice(0, 3).map((specialty, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {trainer.specialties.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{trainer.specialties.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end mt-4 pt-3 border-t">
          <Link href={`/marketplace/pro/${trainer.trainer_id}`}>
            <Button size="sm" className="gap-1" data-testid={`link-view-${trainer.slug}`}>
              View Profile
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrainerCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded animate-pulse w-1/3" />
            <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            <div className="flex gap-1 mt-2">
              <div className="h-5 bg-muted rounded animate-pulse w-16" />
              <div className="h-5 bg-muted rounded animate-pulse w-20" />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4 pt-3 border-t">
          <div className="h-8 bg-muted rounded animate-pulse w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
