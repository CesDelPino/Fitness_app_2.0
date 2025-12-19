import { useQuery } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { fetchJson } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckCircle2, Circle, User, CreditCard, ShieldCheck, ChevronDown, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ConnectAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardingComplete?: boolean;
  error?: string;
}

interface StatusItem {
  id: string;
  label: string;
  complete: boolean;
  href?: string;
  icon: typeof User;
}

export function AccountStatusCard() {
  const { professionalProfile } = useSupabaseAuth();

  const { data: stripeStatus, isLoading: stripeLoading } = useQuery({
    queryKey: ["/api/stripe/connect/status"],
    queryFn: async (): Promise<ConnectAccountStatus> => {
      try {
        const result = await fetchJson<ConnectAccountStatus>("/api/stripe/connect/status");
        return result ?? { hasAccount: false };
      } catch {
        return { hasAccount: false };
      }
    },
  });

  const isLoading = stripeLoading;

  const profileComplete = Boolean(professionalProfile?.headline);
  const paymentsComplete = Boolean(stripeStatus?.onboardingComplete);
  const verificationComplete = professionalProfile?.verification_status === "verified";

  const allComplete = profileComplete && paymentsComplete && verificationComplete;

  const statusItems: StatusItem[] = [
    {
      id: "profile",
      label: "Profile",
      complete: profileComplete,
      href: "/pro/profile",
      icon: User,
    },
    {
      id: "payments",
      label: "Payments",
      complete: paymentsComplete,
      href: "/pro/profile",
      icon: CreditCard,
    },
    {
      id: "verification",
      label: "Verification",
      complete: verificationComplete,
      icon: ShieldCheck,
    },
  ];

  const completedCount = statusItems.filter(item => item.complete).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2 gap-1">
          <CardTitle className="text-xs md:text-sm font-medium whitespace-nowrap">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <Skeleton className="h-5 w-20" />
        </CardContent>
      </Card>
    );
  }

  if (allComplete) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2 gap-1">
          <CardTitle className="text-xs md:text-sm font-medium whitespace-nowrap">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <Badge 
            className="text-[10px] md:text-xs whitespace-nowrap bg-green-500/10 text-green-600 border-green-500/20"
            data-testid="badge-account-status-complete"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            All Set!
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2 gap-1">
        <CardTitle className="text-xs md:text-sm font-medium whitespace-nowrap">Account Status</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 hover:bg-transparent"
              data-testid="button-account-status-details"
            >
              <Badge 
                variant="secondary"
                className="text-[10px] md:text-xs whitespace-nowrap bg-amber-500/10 text-amber-600 border-amber-500/20"
                data-testid="badge-account-status-incomplete"
              >
                {completedCount}/3 Complete
                <ChevronDown className="w-3 h-3 ml-1" />
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <p className="text-sm font-medium">Setup Checklist</p>
              <div className="space-y-2">
                {statusItems.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <div 
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md text-sm",
                        !item.complete && item.href && "hover-elevate cursor-pointer"
                      )}
                      data-testid={`status-item-${item.id}`}
                    >
                      {item.complete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className={cn(
                        item.complete && "text-muted-foreground line-through"
                      )}>
                        {item.label}
                      </span>
                      {item.complete && (
                        <span className="ml-auto text-xs text-green-600">Done</span>
                      )}
                    </div>
                  );

                  if (!item.complete && item.href) {
                    return (
                      <Link key={item.id} href={item.href}>
                        {content}
                      </Link>
                    );
                  }

                  return content;
                })}
              </div>
              {!verificationComplete && (
                <p className="text-xs text-muted-foreground">
                  Verification is handled by our admin team after you complete your profile.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
