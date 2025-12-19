import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Clock, ChevronRight, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import { useClientUpcomingCheckIn } from "@/lib/client-checkins";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export function UpcomingCheckIn() {
  const [, navigate] = useLocation();
  const { user, profile } = useSupabaseAuth();
  const isClient = profile?.role === 'client' || profile?.role === 'pro_connected';
  
  const { data, isLoading, error, isError } = useClientUpcomingCheckIn();

  if (!user || !isClient) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  if (isError || error || !data?.upcoming) {
    return null;
  }

  const { submission, questions } = data.upcoming;
  const dueDate = new Date(submission.due_at);
  const weekStart = new Date(submission.week_start);
  const now = new Date();
  
  const isOverdue = isAfter(now, dueDate);
  const isDueSoon = !isOverdue && isBefore(now, dueDate) && isBefore(now, addDays(dueDate, 1));
  const isInProgress = submission.status === 'in_progress';

  const getStatusBadge = () => {
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isInProgress) {
      return <Badge variant="secondary">In Progress</Badge>;
    }
    if (isDueSoon) {
      return <Badge variant="default">Due Soon</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  const getActionLabel = () => {
    if (isInProgress) return "Continue Check-In";
    if (isOverdue) return "Submit Late";
    return "Start Check-In";
  };

  return (
    <Card className={isOverdue ? "border-destructive/50" : isDueSoon ? "border-primary/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Weekly Check-In</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Week of {format(weekStart, "MMMM d")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className={isOverdue ? "text-destructive" : "text-muted-foreground"}>
            {isOverdue ? (
              <>Overdue by {formatDistanceToNow(dueDate)}</>
            ) : (
              <>Due {formatDistanceToNow(dueDate, { addSuffix: true })}</>
            )}
          </span>
        </div>

        {isOverdue && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive">
              Your trainer is waiting for your update. Late submissions are still helpful!
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {questions.length} questions · Auto-metrics included
          </p>
          <Button 
            onClick={() => navigate(`/check-in/${submission.id}`)}
            data-testid="button-start-checkin"
          >
            {getActionLabel()}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
