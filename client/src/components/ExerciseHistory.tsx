import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Target } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getExerciseHistory, type ExerciseHistorySession } from "@/lib/supabase-data";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";

interface ExerciseHistoryProps {
  exerciseName: string;
  exerciseId?: string | null;
}

export default function ExerciseHistory({ exerciseName, exerciseId }: ExerciseHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { exerciseWeight } = useUnitPreferences();

  const { data: history = [], isLoading } = useQuery<ExerciseHistorySession[]>({
    queryKey: ["exercise-history", exerciseId || exerciseName],
    queryFn: () => getExerciseHistory(exerciseName, exerciseId || undefined),
    enabled: !!exerciseName,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="mb-3">
        <Skeleton className="h-5 w-48" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mb-3 text-sm text-muted-foreground" data-testid="text-no-history">
        First time doing this exercise
      </div>
    );
  }

  const lastSession = history[0];
  const totalSets = lastSession.sets.length;
  const avgReps = Math.round(lastSession.sets.reduce((sum, s) => sum + s.reps, 0) / totalSets);

  const formatSummary = () => {
    if (lastSession.maxWeight !== null && lastSession.maxWeight > 0) {
      return `${totalSets}×${avgReps} @ ${exerciseWeight.format(lastSession.maxWeight)}`;
    }
    return `${totalSets}×${avgReps} reps`;
  };

  const formatDetailedSets = (sets: ExerciseHistorySession["sets"]) => {
    return sets.map(set => {
      if (set.weight !== null && set.weight > 0) {
        return `${set.reps}×${exerciseWeight.format(set.weight)}`;
      }
      return `${set.reps} reps`;
    }).join(", ");
  };

  return (
    <div className="mb-3" data-testid="exercise-history">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Last best:</span>
          <span className="font-medium" data-testid="text-last-best">{formatSummary()}</span>
        </div>
        
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-history"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                History
              </>
            )}
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 pl-5 border-l-2 border-muted" data-testid="exercise-history-detail">
          {history.map((session, index) => (
            <div key={session.sessionId} className="text-xs">
              <span className="text-muted-foreground">
                {format(parseISO(session.date), "MMM d")}:
              </span>
              <span className="ml-1.5" data-testid={`text-history-session-${index}`}>
                {formatDetailedSets(session.sets)}
              </span>
              {session.maxWeight !== null && session.maxWeight > 0 && (
                <span className="ml-1 text-muted-foreground">
                  (max {exerciseWeight.format(session.maxWeight)})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
