import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAcceptProgrammeUpdate, useDeclineProgrammeUpdate, type PendingUpdateInfo } from "@/lib/client-programmes";
import { RefreshCw, Check, X, Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PendingUpdateBannerProps {
  assignmentId: string;
  programmeName: string;
  pendingUpdate: PendingUpdateInfo;
}

export function PendingUpdateBanner({ assignmentId, programmeName, pendingUpdate }: PendingUpdateBannerProps) {
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'accept' | 'decline' | null>(null);
  
  const acceptMutation = useAcceptProgrammeUpdate();
  const declineMutation = useDeclineProgrammeUpdate();

  const handleAccept = async () => {
    try {
      await acceptMutation.mutateAsync({ assignmentId });
      toast({
        title: "Update Accepted",
        description: `Your programme has been updated to ${pendingUpdate.version_name}. New sessions are ready!`,
      });
      setConfirmDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Failed to Accept Update",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDecline = async () => {
    try {
      await declineMutation.mutateAsync({ assignmentId });
      toast({
        title: "Update Declined",
        description: "You'll continue with your current programme version.",
      });
      setConfirmDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Failed to Decline Update",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openConfirmDialog = (action: 'accept' | 'decline') => {
    setDialogAction(action);
    setConfirmDialogOpen(true);
  };

  const isPending = acceptMutation.isPending || declineMutation.isPending;

  return (
    <>
      <div 
        className="border border-primary/50 bg-primary/5 rounded-md p-4" 
        data-testid={`banner-pending-update-${assignmentId}`}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm">Programme Update Available</h4>
              <span className="text-xs text-muted-foreground" data-testid={`text-version-name-${assignmentId}`}>
                {pendingUpdate.version_name}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span data-testid={`text-offered-time-${assignmentId}`}>
                  Offered {formatDistanceToNow(new Date(pendingUpdate.offered_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            {pendingUpdate.notes && (
              <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-md p-2 mt-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-muted-foreground" data-testid={`text-update-notes-${assignmentId}`}>
                  {pendingUpdate.notes}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => openConfirmDialog('accept')}
                disabled={isPending}
                data-testid={`button-accept-update-${assignmentId}`}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept Update
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openConfirmDialog('decline')}
                disabled={isPending}
                data-testid={`button-decline-update-${assignmentId}`}
              >
                <X className="h-3 w-3 mr-1" />
                Keep Current
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid={`text-dialog-title-${assignmentId}`}>
              {dialogAction === 'accept' ? 'Accept Programme Update?' : 'Keep Current Version?'}
            </DialogTitle>
            <DialogDescription data-testid={`text-dialog-description-${assignmentId}`}>
              {dialogAction === 'accept' ? (
                <>
                  Your trainer has updated "{programmeName}" to {pendingUpdate.version_name}.
                  Accepting will update your workout sessions to the new version.
                </>
              ) : (
                <>
                  You'll continue with your current version of "{programmeName}".
                  This will dismiss the update from your trainer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialogOpen(false)}
              disabled={isPending}
              data-testid={`button-cancel-dialog-${assignmentId}`}
            >
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'accept' ? 'default' : 'secondary'}
              onClick={dialogAction === 'accept' ? handleAccept : handleDecline}
              disabled={isPending}
              data-testid={`button-confirm-${dialogAction}-${assignmentId}`}
            >
              {isPending ? 'Processing...' : dialogAction === 'accept' ? 'Accept Update' : 'Keep Current'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
