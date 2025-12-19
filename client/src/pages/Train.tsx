import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Dumbbell, User, Target, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { getWorkoutRoutines, type WorkoutRoutine } from "@/lib/supabase-data";
import { useClientAssignedRoutines, type ProgrammeSession, type SessionExercise } from "@/lib/client-programmes";
import RoutineModal from "@/components/RoutineModal";
import QuickLogModal from "@/components/QuickLogModal";
import ActiveWorkoutSession from "@/components/ActiveWorkoutSession";
import Footer from "@/components/Footer";
import MoreSheet from "@/components/MoreSheet";
import { MyProCard } from "@/components/programmes/MyProCard";
import { PendingProgrammes } from "@/components/programmes/PendingProgrammes";

function formatReps(repsMin: number | null, repsMax: number | null): string {
  if (repsMin === null && repsMax === null) return '-';
  if (repsMin === repsMax || repsMax === null) return `${repsMin}`;
  if (repsMin === null) return `${repsMax}`;
  return `${repsMin}-${repsMax}`;
}

export default function Train() {
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [activeWorkout, setActiveWorkout] = useState<{ 
    routineId?: string; 
    routineName?: string;
    assignmentId?: string;
    assignedSession?: ProgrammeSession;
  } | null>(null);

  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const { data: routines = [] } = useQuery<WorkoutRoutine[]>({
    queryKey: ["workout-routines"],
    queryFn: () => getWorkoutRoutines(),
  });

  const { data: assignedRoutines = [], isLoading: assignedLoading } = useClientAssignedRoutines();

  const openCreateModal = () => {
    setEditingRoutineId(null);
    setRoutineModalOpen(true);
  };

  const openEditModal = (routineId: string) => {
    setEditingRoutineId(routineId);
    setRoutineModalOpen(true);
  };

  const closeRoutineModal = () => {
    setRoutineModalOpen(false);
    setEditingRoutineId(null);
  };

  if (activeWorkout) {
    return (
      <ActiveWorkoutSession
        routineId={activeWorkout.routineId}
        routineName={activeWorkout.routineName}
        assignmentId={activeWorkout.assignmentId}
        assignedSession={activeWorkout.assignedSession}
        onFinish={() => setActiveWorkout(null)}
        onCancel={() => setActiveWorkout(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Train</h1>
          <MoreSheet />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <MyProCard />
      
      <PendingProgrammes />

      <div className="flex gap-2">
        <Button 
          onClick={openCreateModal}
          data-testid="button-create-routine" 
          className="flex-1"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Routine
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowQuickLog(true)}
          data-testid="button-quick-log" 
          className="flex-1"
        >
          Log Cardio
        </Button>
      </div>

      {assignedRoutines.length > 0 && (
        <div className="space-y-4" data-testid="assigned-routines-section">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">My Programme</h2>
            <Badge variant="secondary" className="text-xs">
              <User className="w-3 h-3 mr-1" />
              From Trainer
            </Badge>
          </div>
          {assignedRoutines.map((assigned) => (
            <Card key={assigned.assignment.id} className="border-primary/20" data-testid={`card-assigned-programme-${assigned.assignment.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base" data-testid={`text-programme-name-${assigned.assignment.id}`}>
                      {assigned.programme.name}
                    </CardTitle>
                    {assigned.programme.description && (
                      <CardDescription className="text-xs mt-1">
                        {assigned.programme.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {assigned.programme.goal && (
                      <Badge variant="outline" className="text-xs">
                        <Target className="w-3 h-3 mr-1" />
                        {assigned.programme.goal}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {assigned.programme.sessions_per_week && (
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {assigned.programme.sessions_per_week} sessions/week
                    {assigned.programme.duration_weeks && ` • ${assigned.programme.duration_weeks} weeks`}
                  </p>
                )}
                <div className="space-y-3">
                  {assigned.sessions.map((session) => {
                    const sessionKey = `${assigned.assignment.id}-${session.day_number}`;
                    const isExpanded = expandedSessions.has(sessionKey);
                    const exerciseCount = session.exercises?.length || 0;
                    
                    return (
                      <Card 
                        key={sessionKey}
                        className="border"
                        data-testid={`session-${sessionKey}`}
                      >
                        <Collapsible open={isExpanded} onOpenChange={() => toggleSessionExpanded(sessionKey)}>
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-sm font-medium text-primary">{session.day_number}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{session.focus || `Day ${session.day_number}`}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                              </CollapsibleTrigger>
                              <Button 
                                size="sm"
                                className="ml-3"
                                onClick={() => setActiveWorkout({ 
                                  assignmentId: assigned.assignment.id,
                                  routineName: `${assigned.programme.name} - ${session.focus || `Day ${session.day_number}`}`,
                                  assignedSession: session,
                                })}
                                data-testid={`button-start-session-${sessionKey}`}
                              >
                                Start
                              </Button>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 border-t">
                              <div className="space-y-2 mt-2">
                                {session.exercises && session.exercises.length > 0 ? (
                                  session.exercises.map((exercise, exIdx) => (
                                    <div 
                                      key={exIdx}
                                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                                      data-testid={`exercise-${sessionKey}-${exIdx}`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {exercise.exercise_name}
                                        </p>
                                        {exercise.notes && (
                                          <p className="text-xs text-muted-foreground truncate">
                                            {exercise.notes}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 ml-2 shrink-0">
                                        <Badge variant="secondary" className="text-xs">
                                          {exercise.sets} × {formatReps(exercise.reps_min, exercise.reps_max)}
                                        </Badge>
                                        {exercise.rest_seconds && (
                                          <span className="text-xs text-muted-foreground">
                                            {exercise.rest_seconds}s rest
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground italic py-2">
                                    No exercises defined
                                  </p>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {assignedLoading && (
        <div className="space-y-2" data-testid="loading-assigned-routines">
          <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
        </div>
      )}

      {routines.length === 0 && assignedRoutines.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Dumbbell className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Routines Yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first workout routine to get started
            </p>
            <Button 
              onClick={openCreateModal}
              data-testid="button-create-first-routine"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Routine
            </Button>
          </CardContent>
        </Card>
      )}

      {routines.length > 0 && (
        <div className="space-y-4" data-testid="personal-routines-section">
          <h2 className="text-lg font-semibold">My Routines</h2>
          {routines.map((routine) => (
            <Card key={routine.id} className="hover-elevate">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span data-testid={`text-routine-name-${routine.id}`}>{routine.name}</span>
                  <Dumbbell className="w-5 h-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {routine.lastUsedAt
                      ? `Last: ${format(new Date(routine.lastUsedAt), "MMM d")}`
                      : "Never used"}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => setActiveWorkout({ routineId: routine.id, routineName: routine.name })}
                      data-testid={`button-start-${routine.id}`}
                    >
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(routine.id)}
                      data-testid={`button-edit-${routine.id}`}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoutineModal 
        open={routineModalOpen} 
        onClose={closeRoutineModal}
        routineId={editingRoutineId}
      />
      <QuickLogModal 
        open={showQuickLog} 
        onClose={() => setShowQuickLog(false)} 
      />
      </main>
      <Footer />
    </div>
  );
}
