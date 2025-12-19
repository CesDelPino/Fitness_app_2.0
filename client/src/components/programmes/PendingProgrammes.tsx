import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useClientProgrammes, useAcceptProgramme, useRejectProgramme, useClientTier, type ClientAssignment } from "@/lib/client-programmes";
import { PendingUpdateBanner } from "./PendingUpdateBanner";
import { Check, X, Calendar, Target, Clock, User, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProgrammeCardProps {
  assignment: ClientAssignment;
  onAccept: () => void;
  onReject: (reason?: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  disabled?: boolean;
}

function ProgrammeCard({ assignment, onAccept, onReject, isAccepting, isRejecting, disabled = false }: ProgrammeCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = () => {
    onReject(rejectReason || undefined);
    setRejectDialogOpen(false);
    setRejectReason("");
  };

  return (
    <Card data-testid={`card-programme-${assignment.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg" data-testid={`text-programme-name-${assignment.id}`}>
              {assignment.programme.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {assignment.programme.description || "No description"}
            </CardDescription>
          </div>
          <Badge variant="secondary" data-testid={`badge-status-${assignment.id}`}>
            Pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {assignment.programme.goal && (
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              <span data-testid={`text-goal-${assignment.id}`}>{assignment.programme.goal}</span>
            </div>
          )}
          {assignment.programme.sessions_per_week && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span data-testid={`text-sessions-${assignment.id}`}>
                {assignment.programme.sessions_per_week}x/week
              </span>
            </div>
          )}
          {assignment.programme.duration_weeks && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span data-testid={`text-duration-${assignment.id}`}>
                {assignment.programme.duration_weeks} weeks
              </span>
            </div>
          )}
        </div>
        
        {assignment.assigned_by && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t">
            <User className="h-4 w-4 text-muted-foreground" />
            <span data-testid={`text-assigned-by-${assignment.id}`}>
              Assigned by <strong>{assignment.assigned_by.name}</strong>
              {assignment.assigned_by.headline && (
                <span className="text-muted-foreground"> - {assignment.assigned_by.headline}</span>
              )}
            </span>
          </div>
        )}

        {assignment.notes && (
          <div className="text-sm bg-muted/50 rounded-md p-3">
            <p className="text-muted-foreground" data-testid={`text-notes-${assignment.id}`}>
              {assignment.notes}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Assigned {formatDistanceToNow(new Date(assignment.assigned_at), { addSuffix: true })}
        </p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          className="flex-1"
          onClick={onAccept}
          disabled={disabled || isAccepting || isRejecting}
          data-testid={`button-accept-${assignment.id}`}
        >
          <Check className="h-4 w-4 mr-2" />
          {isAccepting ? "Accepting..." : "Accept Programme"}
        </Button>
        
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline"
              disabled={disabled || isAccepting || isRejecting}
              data-testid={`button-reject-${assignment.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Programme</DialogTitle>
              <DialogDescription>
                Are you sure you want to decline "{assignment.programme.name}"? 
                You can optionally provide a reason for your trainer.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="Let your trainer know why you're declining..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                data-testid="input-reject-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReject}
                disabled={isRejecting}
                data-testid="button-confirm-reject"
              >
                {isRejecting ? "Declining..." : "Decline Programme"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}

export function PendingProgrammes() {
  const { toast } = useToast();
  const tierQuery = useClientTier();
  const programmesQuery = useClientProgrammes();
  const acceptMutation = useAcceptProgramme();
  const rejectMutation = useRejectProgramme();

  const tierData = tierQuery.data;
  const data = programmesQuery.data;

  const handleAccept = async (assignmentId: string, programmeName: string) => {
    try {
      await acceptMutation.mutateAsync({ assignmentId });
      toast({
        title: "Programme Accepted",
        description: `You've accepted "${programmeName}". Your workout sessions are now ready!`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Accept",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (assignmentId: string, programmeName: string, reason?: string) => {
    try {
      await rejectMutation.mutateAsync({ assignmentId, reason });
      toast({
        title: "Programme Declined",
        description: `You've declined "${programmeName}".`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Decline",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isInitialLoading = (programmesQuery.isLoading && !data) || (tierQuery.isLoading && !tierData);

  if (isInitialLoading) {
    return (
      <div className="space-y-4" data-testid="loading-pending-programmes">
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (programmesQuery.error) {
    return (
      <Card data-testid="error-pending-programmes">
        <CardContent className="pt-6">
          <p className="text-destructive">Failed to load programmes. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const pendingProgrammes = data?.pending || [];
  const canReceiveProAssignments = tierData?.entitlements?.can_receive_pro_assignments ?? true;

  if (pendingProgrammes.length === 0) {
    const isPro = tierData?.tier === 'pro_connected';
    return (
      <Card data-testid="empty-pending-programmes">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-5 w-5" />
            <p>
              {isPro 
                ? "No pending programmes. Your trainer will assign you new programmes when ready."
                : "No pending programmes at the moment."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasTrainerAssignedPending = pendingProgrammes.some(p => p.assigned_by !== null);

  if (!canReceiveProAssignments && hasTrainerAssignedPending) {
    return (
      <Card data-testid="no-pro-connection">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-5 w-5" />
            <p>You have pending programmes from a trainer, but your connection has ended. Please contact your trainer to re-establish the relationship.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="pending-programmes-container">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Pending Programmes</h2>
        <Badge variant="secondary" data-testid="badge-pending-count">
          {pendingProgrammes.length}
        </Badge>
      </div>
      
      {tierData?.tier === 'pro_connected' && tierData.professional && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
          <Shield className="h-4 w-4" />
          <span>
            Connected with <strong>{tierData.professional.display_name}</strong>
            {tierData.professional.headline && ` - ${tierData.professional.headline}`}
          </span>
        </div>
      )}
      
      <p className="text-sm text-muted-foreground">
        Your trainer has assigned you new programmes. Accept to start your workouts.
      </p>
      <div className="grid gap-4">
        {pendingProgrammes.map((assignment) => (
          <ProgrammeCard
            key={assignment.id}
            assignment={assignment}
            onAccept={() => handleAccept(assignment.id, assignment.programme.name)}
            onReject={(reason) => handleReject(assignment.id, assignment.programme.name, reason)}
            isAccepting={acceptMutation.isPending && acceptMutation.variables?.assignmentId === assignment.id}
            isRejecting={rejectMutation.isPending && rejectMutation.variables?.assignmentId === assignment.id}
          />
        ))}
      </div>
    </div>
  );
}

export function ActiveProgrammes() {
  const { data, isLoading, error } = useClientProgrammes();

  if (isLoading || error) {
    return null;
  }

  const activeProgrammes = data?.active || [];

  if (activeProgrammes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="active-programmes-container">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Active Programmes</h2>
        <Badge variant="outline" data-testid="badge-active-count">
          {activeProgrammes.length}
        </Badge>
      </div>
      <div className="grid gap-4">
        {activeProgrammes.map((assignment) => (
          <Card key={assignment.id} data-testid={`card-active-programme-${assignment.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg" data-testid={`text-active-programme-name-${assignment.id}`}>
                    {assignment.programme.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {assignment.programme.description || "No description"}
                  </CardDescription>
                </div>
                <Badge 
                  variant={assignment.has_pending_update ? "default" : "secondary"}
                  data-testid={`badge-active-status-${assignment.id}`}
                >
                  {assignment.has_pending_update ? "Update Available" : "Active"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignment.has_pending_update && assignment.pending_update && (
                <PendingUpdateBanner
                  assignmentId={assignment.id}
                  programmeName={assignment.programme.name}
                  pendingUpdate={assignment.pending_update}
                />
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {assignment.programme.goal && (
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    <span>{assignment.programme.goal}</span>
                  </div>
                )}
                {assignment.programme.sessions_per_week && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{assignment.programme.sessions_per_week}x/week</span>
                  </div>
                )}
                {assignment.programme.duration_weeks && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{assignment.programme.duration_weeks} weeks</span>
                  </div>
                )}
              </div>
              {assignment.assigned_by && (
                <div className="flex items-center gap-2 text-sm pt-4 mt-4 border-t">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    From <strong>{assignment.assigned_by.name}</strong>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
