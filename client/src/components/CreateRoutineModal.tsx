import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { createWorkoutRoutine, createRoutineExercise, type WorkoutType } from "@/lib/supabase-data";
import { z } from "zod";
import { nanoid } from "nanoid";

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

interface CreateRoutineModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateRoutineModal({ open, onClose }: CreateRoutineModalProps) {
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Array<{ id: string; name: string; sets: number; reps: number }>>([
    { id: nanoid(), name: "", sets: 3, reps: 10 },
  ]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "strength_traditional" as const,
      exercises: [{ name: "", targetSets: 3, targetReps: 10 }],
    },
  });

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
      form.reset();
      setExercises([{ id: nanoid(), name: "", sets: 3, reps: 10 }]);
    },
    onError: (error) => {
      console.error("Failed to create routine:", error);
      toast({ variant: "destructive", description: "Failed to create routine" });
    },
  });

  const addExercise = () => {
    setExercises([...exercises, { id: nanoid(), name: "", sets: 3, reps: 10 }]);
    const current = form.getValues("exercises");
    form.setValue("exercises", [...current, { name: "", targetSets: 3, targetReps: 10 }]);
  };

  const removeExercise = (index: number) => {
    const updated = exercises.filter((_, i) => i !== index);
    setExercises(updated);
    const current = form.getValues("exercises");
    form.setValue("exercises", current.filter((_, i) => i !== index));
  };

  const onSubmit = (data: FormData) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Workout Routine</DialogTitle>
        </DialogHeader>

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

              {exercises.map((exercise, index) => (
                <Card key={exercise.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
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
                      {exercises.length > 1 && (
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

                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name={`exercises.${index}.targetSets`}
                        render={({ field: { value, ...fieldProps } }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Sets</FormLabel>
                            <FormControl>
                              <Input
                                {...fieldProps}
                                type="number"
                                min="1"
                                max="10"
                                value={value}
                                onChange={(e) => fieldProps.onChange(parseInt(e.target.value) || 1)}
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
                        render={({ field: { value, ...fieldProps } }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Reps</FormLabel>
                            <FormControl>
                              <Input
                                {...fieldProps}
                                type="number"
                                min="1"
                                max="100"
                                value={value}
                                onChange={(e) => fieldProps.onChange(parseInt(e.target.value) || 1)}
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
                disabled={createMutation.isPending}
                data-testid="button-save-routine"
              >
                {createMutation.isPending ? "Creating..." : "Create Routine"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
