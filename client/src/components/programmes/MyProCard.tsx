import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { useClientProOverview, useClientTier } from "@/lib/client-programmes";
import { User, Dumbbell, Search, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function MyProCard() {
  const tierQuery = useClientTier();
  const proOverviewQuery = useClientProOverview();
  
  const tierData = tierQuery.data;
  const proData = proOverviewQuery.data;
  
  const isInitialLoading = (tierQuery.isLoading && !tierData) || (proOverviewQuery.isLoading && !proData);
  
  if (isInitialLoading) {
    return (
      <Card data-testid="loading-my-pro">
        <CardHeader>
          <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted/50 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (tierQuery.isError || proOverviewQuery.error) {
    return (
      <Card data-testid="error-my-pro">
        <CardContent className="pt-6">
          <p className="text-destructive">Failed to load trainer info. Please try again.</p>
        </CardContent>
      </Card>
    );
  }
  
  const isProConnected = tierData?.tier === 'pro_connected';
  const professional = proData?.professional;
  
  if (!isProConnected || !professional) {
    return (
      <Card data-testid="empty-my-pro">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            My Trainer
          </CardTitle>
          <CardDescription>
            Get personalized workout programmes from a fitness professional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 rounded-md p-4">
            <Search className="h-5 w-5 shrink-0" />
            <p>
              Connect with a certified trainer to receive customized programmes tailored to your goals.
            </p>
          </div>
          <Button variant="outline" className="w-full" data-testid="button-find-pro">
            <Search className="h-4 w-4 mr-2" />
            Find a Trainer
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const relationshipDate = proData?.relationshipSince 
    ? formatDistanceToNow(new Date(proData.relationshipSince), { addSuffix: true })
    : null;
  
  return (
    <Card data-testid="my-pro-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          My Trainer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            photoPath={professional.profile_photo_path}
            name={professional.display_name}
            className="h-16 w-16"
            fallbackClassName="text-lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate" data-testid="text-pro-name">
              {professional.display_name}
            </h3>
            {professional.headline && (
              <p className="text-sm text-muted-foreground truncate" data-testid="text-pro-headline">
                {professional.headline}
              </p>
            )}
            {relationshipDate && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-relationship-since">
                Connected {relationshipDate}
              </p>
            )}
          </div>
        </div>
        
        {professional.specialties && professional.specialties.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="container-specialties">
            {professional.specialties.slice(0, 4).map((specialty, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {specialty}
              </Badge>
            ))}
            {professional.specialties.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{professional.specialties.length - 4} more
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-active-count">
              <strong>{proData?.activeProgrammeCount || 0}</strong> active programme{(proData?.activeProgrammeCount || 0) !== 1 ? 's' : ''}
            </span>
          </div>
          
          {professional.contact_email && (
            <Button variant="ghost" size="sm" className="ml-auto" asChild data-testid="button-contact-pro">
              <a href={`mailto:${professional.contact_email}`}>
                <Mail className="h-4 w-4 mr-1" />
                Contact
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
