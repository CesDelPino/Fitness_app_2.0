import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, ChevronUp, ChevronDown, Archive } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  createWorkoutRoutine, 
  createRoutineExercise,
  updateWorkoutRoutine,
  replaceRoutineExercises,
  archiveWorkoutRoutine,
  getRoutineWithExercises,
  type WorkoutType,
  type RoutineExercise,
} from "@/lib/supabase-data";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Routine name required"),
  type: z.enum(["strength_traditional", "strength_circuit", "cardio", "other"]),
  exercises: z.array(
    z.object({
      name: z.string().min(1, "Exercise name required"),
      targetSets: z.number().int().min(1).max(10),
      targetReps: z.number().int().min(1).max(100),
    })
  ).min(1, "Add at least one exercise"),
});

type FormData = z.infer<typeof formSchema>;

interface RoutineModalProps {
  open: boolean;
  onClose: () => void;
  routineId?: string | null;
}

export default function RoutineModal({ open, onClose, routineId }: RoutineModalProps) {
  const { toast } = useToast();
  const isEditMode = !!routineId;
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "strength_traditional" as const,
      exercises: [{ name: "", targetSets: 3, targetReps: 10 }],
    },
  });

  const { fields, append, remove, swap } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  const { data: routineDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["routine-with-exercises", routineId],
    queryFn: () => routineId ? getRoutineWithExercises(routineId) : null,
    enabled: isEditMode && open && !!routineId,
  });

  useEffect(() => {
    if (routineDetails?.routine && isEditMode) {
      form.reset({
        name: routineDetails.routine.name,
        type: routineDetails.routine.type as "strength_traditional" | "strength_circuit" | "cardio" | "other",
        exercises: routineDetails.exercises.map(ex => ({
          name: ex.exerciseName,
          targetSets: ex.targetSets || 3,
          targetReps: ex.targetReps || 10,
        })),
      });
    }
  }, [routineDetails, isEditMode, form]);

  useEffect(() => {
    if (!open) {
      form.reset({
        name: "",
        type: "strength_traditional" as const,
        exercises: [{ name: "", targetSets: 3, targetReps: 10 }],
      });
    }
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const routine = await createWorkoutRoutine({
        name: data.name,
        type: data.type as WorkoutType,
      });

      for (let i = 0; i < data.exercises.length; i++) {
        const exercise = data.exercises[i];
        await createRoutineExercise({
          routineId: routine.id,
          exerciseName: exercise.name,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
          orderIndex: i,
        });
      }

      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
      toast({ description: "Routine created successfully" });
      onClose();
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to create routine" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!routineId) throw new Error("No routine ID");
      
      await updateWorkoutRoutine(routineId, {
        name: data.name,
        type: data.type as WorkoutType,
      });

      await replaceRoutineExercises(routineId, data.exercises.map((ex, index) => ({
        exerciseName: ex.name,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        orderIndex: index,
      })));

      return { id: routineId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
      queryClient.invalidateQueries({ queryKey: ["routine-with-exercises", routineId] });
      toast({ description: "Routine updated successfully" });
      onClose();
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to update routine" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!routineId) throw new Error("No routine ID");
      await archiveWorkoutRoutine(routineId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
      queryClient.invalidateQueries({ queryKey: ["routine-with-exercises", routineId] });
      toast({ description: "Routine archived successfully" });
      setShowArchiveConfirm(false);
      onClose();
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to archive routine" });
    },
  });

  const addExercise = () => {
    append({ name: "", targetSets: 3, targetReps: 10 });
  };

  const removeExercise = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const moveExercise = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < fields.length) {
      swap(index, newIndex);
    }
  };

  const onSubmit = (data: FormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || archiveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-routine-modal-title">
            {isEditMode ? "Edit Routine" : "Create Workout Routine"}
          </DialogTitle>
        </DialogHeader>

        {isEditMode && isLoadingDetails ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Routine Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Push Day, Full Body"
                        data-testid="input-routine-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Exercises</FormLabel>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addExercise}
                    data-testid="button-add-exercise"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moveExercise(index, "up")}
                            disabled={index === 0}
                            data-testid={`button-move-up-${index}`}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moveExercise(index, "down")}
                            disabled={index === fields.length - 1}
                            data-testid={`button-move-down-${index}`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.name`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Exercise name"
                                  data-testid={`input-exercise-name-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeExercise(index)}
                            data-testid={`button-remove-exercise-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex gap-2 ml-8">
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.targetSets`}
                          render={({ field: { value, onChange, ...fieldProps } }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs">Sets</FormLabel>
                              <FormControl>
                                <Input
                                  {...fieldProps}
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={value}
                                  onChange={(e) => onChange(parseInt(e.target.value) || 1)}
                                  data-testid={`input-sets-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.targetReps`}
                          render={({ field: { value, onChange, ...fieldProps } }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs">Reps</FormLabel>
                              <FormControl>
                                <Input
                                  {...fieldProps}
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={value}
                                  onChange={(e) => onChange(parseInt(e.target.value) || 1)}
                                  data-testid={`input-reps-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  data-testid="button-cancel-routine"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isPending}
                  data-testid="button-save-routine"
                >
                  {isPending ? "Saving..." : isEditMode ? "Save Changes" : "Create Routine"}
                </Button>
              </div>

              {isEditMode && !isLoadingDetails && (
                <div className="pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowArchiveConfirm(true)}
                    disabled={isPending}
                    data-testid="button-archive-routine"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Routine
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )}
      </DialogContent>

      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-archive-confirm-title">Archive Routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide "{routineDetails?.routine?.name || 'this routine'}" from your routine list. 
              Your workout history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={archiveMutation.isPending}
              data-testid="button-cancel-archive"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
