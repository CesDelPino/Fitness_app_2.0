import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useProClientPermissions,
  useCreatePermissionRequests,
  getQuickActionState,
  type QuickActionPermissionState,
} from "@/lib/permissions";
import {
  ClipboardList,
  Apple,
  CalendarCheck,
  Lock,
  Clock,
  Loader2,
  Send,
} from "lucide-react";
import { MessageButton } from "@/components/messages/MessageButton";
import type { PermissionSlug } from "@shared/supabase-types";

const ACTION_ICONS: Record<string, typeof ClipboardList> = {
  assign_programmes: ClipboardList,
  set_nutrition_targets: Apple,
  assign_checkins: CalendarCheck,
};

const ACTION_LABELS: Record<string, string> = {
  assign_programmes: "Assign Programme",
  set_nutrition_targets: "Set Macros",
  assign_checkins: "Assign Check-in",
};

interface QuickActionButtonProps {
  slug: PermissionSlug;
  state: QuickActionPermissionState;
  onAction: () => void;
  onRequest: () => void;
  disabled?: boolean;
}

function QuickActionButton({ slug, state, onAction, onRequest, disabled }: QuickActionButtonProps) {
  const Icon = ACTION_ICONS[slug] || ClipboardList;
  const label = ACTION_LABELS[slug] || slug;
  
  const getTooltipText = () => {
    if (state === 'granted') return label;
    if (state === 'pending') return `${label} (Awaiting approval)`;
    return `Request: ${label}`;
  };
  
  const handleClick = () => {
    if (state === 'granted') {
      onAction();
    } else if (state === 'missing') {
      onRequest();
    }
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClick}
          disabled={disabled || state === 'pending'}
          data-testid={`button-quick-${slug}`}
        >
          {state === 'granted' ? (
            <Icon className="h-4 w-4" />
          ) : state === 'pending' ? (
            <Clock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <div className="relative">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <Lock className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-muted-foreground" />
            </div>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface ClientQuickActionsProps {
  clientId: string;
  clientName?: string;
  onAssignProgramme: () => void;
  onSetMacros?: () => void;
  onAssignCheckin?: () => void;
  compact?: boolean;
}

export function ClientQuickActions({
  clientId,
  clientName,
  onAssignProgramme,
  onSetMacros,
  onAssignCheckin,
  compact = true,
}: ClientQuickActionsProps) {
  const { toast } = useToast();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [permissionToRequest, setPermissionToRequest] = useState<PermissionSlug | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  
  const { data: permissions, isLoading } = useProClientPermissions(clientId);
  const createRequestsMutation = useCreatePermissionRequests(clientId);
  
  const grantedPermissions = permissions?.granted_permissions || [];
  const pendingPermissions = permissions?.pending_permissions || [];
  const relationshipId = permissions?.relationship_id;
  
  const handleRequestPermission = (slug: PermissionSlug) => {
    setPermissionToRequest(slug);
    setRequestDialogOpen(true);
  };
  
  const handleSubmitRequest = async () => {
    if (!relationshipId || !permissionToRequest) return;
    
    try {
      const result = await createRequestsMutation.mutateAsync({
        relationship_id: relationshipId,
        permission_slugs: [permissionToRequest],
        message: requestMessage.trim() || undefined,
      });
      
      if (result.created_count > 0) {
        toast({
          title: "Request sent",
          description: `Requested ${ACTION_LABELS[permissionToRequest] || permissionToRequest} from ${clientName || 'client'}.`,
        });
        setRequestDialogOpen(false);
        setPermissionToRequest(null);
        setRequestMessage("");
      } else if (result.failed_count > 0) {
        toast({
          title: "Request failed",
          description: result.results[0]?.error || "Could not send request",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Failed to send request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const quickActions: Array<{
    slug: PermissionSlug;
    onAction: (() => void) | undefined;
  }> = [
    { slug: 'assign_programmes' as PermissionSlug, onAction: onAssignProgramme },
    ...(onSetMacros ? [{ slug: 'set_nutrition_targets' as PermissionSlug, onAction: onSetMacros }] : []),
    { slug: 'assign_checkins' as PermissionSlug, onAction: onAssignCheckin },
  ];
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    );
  }
  
  const pendingCount = quickActions.filter(
    a => getQuickActionState(a.slug, grantedPermissions, pendingPermissions) === 'pending'
  ).length;
  
  return (
    <>
      <div className="flex items-center gap-1" data-testid={`quick-actions-${clientId}`}>
        <MessageButton 
          userId={clientId} 
          userName={clientName}
        />
        {quickActions.map(({ slug, onAction }) => {
          const state = getQuickActionState(slug, grantedPermissions, pendingPermissions);
          
          return (
            <QuickActionButton
              key={slug}
              slug={slug}
              state={state}
              onAction={() => onAction?.()}
              onRequest={() => handleRequestPermission(slug)}
              disabled={createRequestsMutation.isPending}
            />
          );
        })}
        {pendingCount > 0 && compact && (
          <Badge variant="outline" className="ml-1 h-5 text-xs px-1.5">
            {pendingCount} pending
          </Badge>
        )}
      </div>
      
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Permission</DialogTitle>
            <DialogDescription>
              Ask {clientName || 'your client'} to grant you the "{permissionToRequest ? (ACTION_LABELS[permissionToRequest] || permissionToRequest) : 'this'}" permission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Textarea
                placeholder="Optional message explaining why you need this permission..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                maxLength={200}
                className="resize-none"
                rows={3}
                data-testid="input-request-message"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {requestMessage.length}/200
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setRequestDialogOpen(false);
                setRequestMessage("");
              }}
              data-testid="button-cancel-request"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={createRequestsMutation.isPending}
              data-testid="button-send-request"
            >
              {createRequestsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
