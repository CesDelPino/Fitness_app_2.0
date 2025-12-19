import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, Plus, Trash2, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { type WeightUnit, getWeightInputStep, lbsToKg, kgToLbs, smartRoundForDisplay } from "@shared/units";
import { format } from "date-fns";
import { nanoid } from "nanoid";
import { 
  createWorkoutSession, 
  createWorkoutSets,
  getRoutineWithExercises,
  updateRoutineLastUsed,
  type RoutineExercise,
} from "@/lib/supabase-data";
import ExerciseHistory from "./ExerciseHistory";
import type { ProgrammeSession } from "@/lib/client-programmes";

interface SetLog {
  id: string;
  reps: number;
  weight?: number;
  completed: boolean;
}

interface ExerciseLog {
  id: string;
  name: string;
  exerciseId?: string | null;
  sets: SetLog[];
}

interface ActiveWorkoutSessionProps {
  routineId?: string;
  routineName?: string;
  assignmentId?: string;
  assignedSession?: ProgrammeSession;
  onFinish: () => void;
  onCancel: () => void;
}

export default function ActiveWorkoutSession({ 
  routineId, 
  routineName,
  assignmentId,
  assignedSession,
  onFinish, 
  onCancel 
}: ActiveWorkoutSessionProps) {
  const { toast } = useToast();
  const { exerciseWeight } = useUnitPreferences();
  
  // Session-level unit override (ephemeral - not persisted)
  const [sessionUnit, setSessionUnit] = useState<WeightUnit | null>(null);
  const activeUnit = sessionUnit ?? exerciseWeight.unit;
  const inputStep = getWeightInputStep(activeUnit);
  
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);

  const { data: routineData } = useQuery({
    queryKey: ["routine-with-exercises", routineId],
    queryFn: () => routineId ? getRoutineWithExercises(routineId) : null,
    enabled: !!routineId && !assignedSession,
  });
  
  const routineExercises = routineData?.exercises;

  useEffect(() => {
    if (assignedSession && assignedSession.exercises && assignedSession.exercises.length > 0 && exercises.length === 0) {
      const initialExercises = assignedSession.exercises.map((ex) => {
        const targetReps = ex.reps_min || ex.reps_max || 10;
        return {
          id: nanoid(),
          name: ex.exercise_name,
          exerciseId: ex.exercise_id,
          sets: Array.from({ length: ex.sets || 3 }, () => ({
            id: nanoid(),
            reps: targetReps,
            weight: undefined,
            completed: false,
          })),
        };
      });
      setExercises(initialExercises);
    }
  }, [assignedSession, exercises.length]);

  useEffect(() => {
    if (routineExercises && routineExercises.length > 0 && exercises.length === 0 && !assignedSession) {
      const initialExercises = routineExercises.map((ex) => ({
        id: nanoid(),
        name: ex.exerciseName,
        sets: Array.from({ length: ex.targetSets || 3 }, () => ({
          id: nanoid(),
          reps: ex.targetReps || 10,
          weight: undefined,
          completed: false,
        })),
      }));
      setExercises(initialExercises);
    }
  }, [routineExercises, exercises.length, assignedSession]);

  useEffect(() => {
    if (!routineId && !assignedSession && exercises.length === 0) {
      setShowAddExercise(true);
    }
  }, [routineId, assignedSession, exercises.length]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log("Saving workout with exercises:", exercises);
      const workoutDate = format(new Date(), "yyyy-MM-dd");
      
      // Create workout session
      const session = await createWorkoutSession({
        workoutType: 'strength_traditional',
        routineId: routineId || undefined,
        routineName: routineName,
      });
      console.log("Session created:", session);

      // Collect all completed sets (weights are already stored in kg)
      const setsToCreate = exercises.flatMap(exercise => 
        exercise.sets
          .map((set, i) => ({ set, index: i }))
          .filter(({ set }) => set.completed)
          .map(({ set, index }) => ({
            sessionId: session.id,
            exerciseName: exercise.name,
            exerciseId: exercise.exerciseId || undefined,
            setNumber: index + 1,
            reps: set.reps,
            weight: set.weight, // Already in kg
          }))
      );
      
      // Create all sets in one batch
      if (setsToCreate.length > 0) {
        await createWorkoutSets(setsToCreate);
      }
      
      // Update routine last used
      if (routineId) {
        await updateRoutineLastUsed(routineId);
      }

      return { session, workoutDate };
    },
    onSuccess: (data) => {
      console.log("Workout saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["workout-sessions", data.workoutDate] });
      queryClient.invalidateQueries({ queryKey: ["workout-sessions-history"] });
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
      toast({ description: "Workout saved successfully!" });
      onFinish();
    },
    onError: (error) => {
      console.error("Failed to save workout:", error);
      toast({ variant: "destructive", description: "Failed to save workout" });
    },
  });

  const addExercise = () => {
    if (!newExerciseName.trim()) return;
    
    const newExercise: ExerciseLog = {
      id: nanoid(),
      name: newExerciseName.trim(),
      sets: Array.from({ length: 3 }, () => ({
        id: nanoid(),
        reps: 10,
        weight: undefined,
        completed: false,
      })),
    };
    
    setExercises([...exercises, newExercise]);
    setNewExerciseName("");
    setShowAddExercise(false);
    setCurrentExerciseIndex(exercises.length);
  };

  const addSet = (exerciseIndex: number) => {
    const updated = [...exercises];
    const lastSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];
    updated[exerciseIndex].sets.push({
      id: nanoid(),
      reps: lastSet?.reps || 10,
      weight: lastSet?.weight,
      completed: false,
    });
    setExercises(updated);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets = updated[exerciseIndex].sets.filter((_, i) => i !== setIndex);
    setExercises(updated);
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex].completed = !updated[exerciseIndex].sets[setIndex].completed;
    setExercises(updated);
  };

  // Convert input weight to kg for internal storage
  const inputToKg = (value: number | undefined): number | undefined => {
    if (value === undefined) return undefined;
    return activeUnit === 'lbs' ? lbsToKg(value) : value;
  };

  // Convert stored kg weight to display unit
  const kgToDisplay = (valueKg: number | undefined): number | undefined => {
    if (valueKg === undefined) return undefined;
    const displayValue = activeUnit === 'lbs' ? kgToLbs(valueKg) : valueKg;
    return smartRoundForDisplay(displayValue, activeUnit);
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: number | undefined) => {
    const updated = [...exercises];
    if (field === 'reps') {
      updated[exerciseIndex].sets[setIndex].reps = value || 0;
    } else {
      // Convert input to kg for storage
      updated[exerciseIndex].sets[setIndex].weight = inputToKg(value);
    }
    setExercises(updated);
  };

  const currentExercise = exercises[currentExerciseIndex];
  const hasCompletedSets = exercises.some(ex => ex.sets.some(set => set.completed));

  return (
    <div className="pb-20 px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Active Workout</h1>
          {routineName && <p className="text-sm text-muted-foreground">{routineName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden" data-testid="unit-toggle">
            <Button
              variant={activeUnit === 'kg' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-8 px-3"
              onClick={() => setSessionUnit('kg')}
              data-testid="button-unit-kg"
            >
              kg
            </Button>
            <Button
              variant={activeUnit === 'lbs' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-8 px-3"
              onClick={() => setSessionUnit('lbs')}
              data-testid="button-unit-lbs"
            >
              lbs
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            data-testid="button-cancel-workout"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {exercises.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground mb-4">
              Add your first exercise to begin
            </p>
            <div className="space-y-2">
              <Input
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                placeholder="Exercise name (e.g., Bench Press)"
                data-testid="input-first-exercise-name"
                onKeyDown={(e) => e.key === "Enter" && addExercise()}
              />
              <Button
                className="w-full"
                onClick={addExercise}
                disabled={!newExerciseName.trim()}
                data-testid="button-add-first-exercise"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Exercise
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {exercises.map((exercise, index) => (
              <Button
                key={exercise.id}
                variant={currentExerciseIndex === index ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentExerciseIndex(index)}
                data-testid={`button-exercise-${index}`}
                className="whitespace-nowrap"
              >
                {exercise.name}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddExercise(true)}
              data-testid="button-add-exercise-tab"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {showAddExercise && (
            <Card className="mb-4">
              <CardContent className="p-4 space-y-2">
                <Input
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  placeholder="New exercise name"
                  data-testid="input-new-exercise-name"
                  onKeyDown={(e) => e.key === "Enter" && addExercise()}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={addExercise}
                    disabled={!newExerciseName.trim()}
                    data-testid="button-confirm-add-exercise"
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAddExercise(false);
                      setNewExerciseName("");
                    }}
                    data-testid="button-cancel-add-exercise"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentExercise && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{currentExercise.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ExerciseHistory exerciseName={currentExercise.name} exerciseId={currentExercise.exerciseId} />
                {currentExercise.sets.map((set, setIndex) => (
                  <div key={set.id}>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={set.completed ? "default" : "outline"}
                        size="icon"
                        onClick={() => toggleSetComplete(currentExerciseIndex, setIndex)}
                        data-testid={`button-toggle-set-${setIndex}`}
                      >
                        {set.completed && <Check className="w-4 h-4" />}
                        {!set.completed && <span className="text-xs">{setIndex + 1}</span>}
                      </Button>

                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Reps</Label>
                          <Input
                            type="number"
                            value={set.reps}
                            onChange={(e) => updateSet(currentExerciseIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                            data-testid={`input-reps-${setIndex}`}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Weight ({activeUnit})</Label>
                          <Input
                            type="number"
                            step={inputStep}
                            value={kgToDisplay(set.weight) ?? ""}
                            onChange={(e) => updateSet(currentExerciseIndex, setIndex, 'weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="Optional"
                            data-testid={`input-weight-${setIndex}`}
                          />
                        </div>
                      </div>

                      {currentExercise.sets.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSet(currentExerciseIndex, setIndex)}
                          data-testid={`button-remove-set-${setIndex}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {setIndex < currentExercise.sets.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => addSet(currentExerciseIndex)}
                  data-testid="button-add-set"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Set
                </Button>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full mt-6"
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={!hasCompletedSets || saveMutation.isPending}
            data-testid="button-finish-workout"
          >
            {saveMutation.isPending ? "Saving..." : "Finish Workout"}
          </Button>
        </>
      )}
    </div>
  );
}
