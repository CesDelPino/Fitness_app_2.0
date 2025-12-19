import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dumbbell, ChevronDown, Loader2 } from "lucide-react";
import { 
  getWorkoutSessionDetails,
  type WorkoutSession,
  type WorkoutSet,
} from "@/lib/supabase-data";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";

interface WorkoutSectionProps {
  sessions: WorkoutSession[];
}

function getIntensityLabel(intensity: number | null | undefined): string | null {
  if (intensity == null) return null;
  const labels: Record<number, string> = {
    1: "Easy",
    2: "Light",
    3: "Moderate",
    4: "Vigorous",
    5: "Intense",
  };
  return labels[intensity] || null;
}

function WorkoutRow({ session }: { session: WorkoutSession }) {
  const [isOpen, setIsOpen] = useState(false);
  const isCardio = session.workoutType === "cardio";
  const { exerciseWeight } = useUnitPreferences();
  
  const { data: sessionDetails, isLoading } = useQuery({
    queryKey: ["workout-session-details", session.id],
    queryFn: () => getWorkoutSessionDetails(session.id),
    enabled: isOpen && !isCardio,
  });

  const sets = sessionDetails?.sets || [];
  const displayName = session.workoutType.replace(/_/g, " ");

  const exerciseGroups = sets.reduce((acc, set) => {
    if (!acc[set.exerciseName]) {
      acc[set.exerciseName] = [];
    }
    acc[set.exerciseName].push(set);
    return acc;
  }, {} as Record<string, WorkoutSet[]>);

  Object.keys(exerciseGroups).forEach((exerciseName) => {
    exerciseGroups[exerciseName].sort((a, b) => a.setNumber - b.setNumber);
  });

  const intensityLabel = getIntensityLabel(session.intensity);
  const caloriesBurned = session.caloriesBurned;
  const activityName = session.activityName;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full group" data-testid={`workout-session-${session.id}`}>
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer">
          <Dumbbell className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium capitalize" data-testid="workout-type">{displayName}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(session.loggedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {session.durationMinutes && ` • ${session.durationMinutes}m`}
            </div>
          </div>
          {isCardio ? (
            caloriesBurned && (
              <div className="text-xs text-muted-foreground">
                {Math.round(caloriesBurned)} cal
              </div>
            )
          ) : (
            sets.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {sets.length} sets
              </div>
            )
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-9 space-y-1 pb-2">
          {isCardio ? (
            <>
              {activityName && (
                <div className="text-sm font-medium">{activityName}</div>
              )}
              {caloriesBurned && (
                <div className="text-xs text-muted-foreground">
                  {Math.round(caloriesBurned)} calories burned
                </div>
              )}
              {intensityLabel && (
                <div className="text-xs text-muted-foreground">
                  {intensityLabel} intensity
                </div>
              )}
              {session.notes && (
                <div className="text-xs text-muted-foreground italic">
                  "{session.notes}"
                </div>
              )}
              {!activityName && !caloriesBurned && !intensityLabel && !session.notes && (
                <div className="text-xs text-muted-foreground italic">No additional details</div>
              )}
            </>
          ) : (
            <>
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </div>
              ) : Object.keys(exerciseGroups).length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No sets logged</div>
              ) : (
                Object.entries(exerciseGroups).map(([exerciseName, exerciseSets]) => (
                  <div key={exerciseName} className="space-y-1 mb-2">
                    <div className="text-sm font-medium">{exerciseName}</div>
                    <div className="space-y-0.5">
                      {exerciseSets.map((set) => (
                        <div key={set.id} className="text-xs text-muted-foreground" data-testid={`set-${set.id}`}>
                          Set {set.setNumber}: {set.reps} reps
                          {set.weight != null && set.weight > 0 ? ` @ ${exerciseWeight.format(set.weight)}` : " (bodyweight)"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function WorkoutSection({ sessions }: WorkoutSectionProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <Card data-testid="workout-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5" />
          Workouts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => (
          <WorkoutRow key={session.id} session={session} />
        ))}
      </CardContent>
    </Card>
  );
}
