import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  Check, 
  X, 
  AlertTriangle,
  Lock,
  Apple,
  Dumbbell,
  Scale,
  Camera,
  ClipboardCheck,
  Clock,
  User,
  Settings
} from "lucide-react";
import type { PermissionRequestWithDetails, PermissionCategory } from "@shared/supabase-types";

const CATEGORY_ICONS: Record<PermissionCategory, typeof Apple> = {
  nutrition: Apple,
  workouts: Dumbbell,
  weight: Scale,
  photos: Camera,
  checkins: ClipboardCheck,
  fasting: Clock,
  profile: User,
};

interface PendingPermissionRequestsProps {
  compact?: boolean;
}

export function PendingPermissionRequests({ compact = false }: PendingPermissionRequestsProps) {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ success: boolean; requests: PermissionRequestWithDetails[] }>({
    queryKey: ['/api/client/permission-requests'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/permission-requests');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'deny' }) => {
      const res = await apiRequest('PATCH', `/api/client/permission-requests/${requestId}`, { action });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/permission-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/permissions'] });
      toast({
        title: variables.action === 'approve' ? "Permission Granted" : "Permission Denied",
        description: variables.action === 'approve' 
          ? "The permission has been granted to your professional."
          : "The permission request has been denied.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Action Failed",
        description: err.message || "Failed to respond to permission request",
        variant: "destructive",
      });
    },
  });

  const requests = data?.requests || [];

  if (isLoading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        {!compact && (
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
        )}
        <CardContent className={compact ? "p-0" : ""}>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return null;
  }

  if (requests.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Bell className="h-4 w-4" />
          <span>Pending Permission Requests</span>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        {requests.map((request) => {
          const Icon = CATEGORY_ICONS[request.category] || Settings;
          return (
            <div 
              key={request.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              data-testid={`request-${request.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {request.permission_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    From {request.professional_name}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => respondMutation.mutate({ requestId: request.id, action: 'approve' })}
                  disabled={respondMutation.isPending}
                  data-testid={`button-approve-${request.id}`}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => respondMutation.mutate({ requestId: request.id, action: 'deny' })}
                  disabled={respondMutation.isPending}
                  data-testid={`button-deny-${request.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Permission Requests</CardTitle>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        <CardDescription>
          Your professionals have requested additional permissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {requests.map((request) => {
            const Icon = CATEGORY_ICONS[request.category] || Settings;
            return (
              <div 
                key={request.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                data-testid={`request-${request.id}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{request.permission_name}</p>
                      {request.is_exclusive && (
                        <Badge 
                          variant="outline" 
                          className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          Exclusive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      From {request.professional_name}
                    </p>
                    {request.permission_description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.permission_description}
                      </p>
                    )}
                    {request.is_exclusive && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Granting this may transfer it from another professional
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => respondMutation.mutate({ requestId: request.id, action: 'deny' })}
                    disabled={respondMutation.isPending}
                    data-testid={`button-deny-${request.id}`}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => respondMutation.mutate({ requestId: request.id, action: 'approve' })}
                    disabled={respondMutation.isPending}
                    data-testid={`button-approve-${request.id}`}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function usePendingPermissionRequestsCount() {
  const { data } = useQuery<{ success: boolean; requests: PermissionRequestWithDetails[] }>({
    queryKey: ['/api/client/permission-requests'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/permission-requests');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  return data?.requests?.length || 0;
}
