import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Plus, Trash2, Loader2, ChevronUp, ChevronDown, Dumbbell, Edit3, Check, X, GripVertical } from "lucide-react";
import { 
  useProRoutine, 
  useUpdateProRoutine, 
  useAddProExercise, 
  useUpdateProExercise, 
  useDeleteProExercise,
  useReorderProExercises,
  useApproveProRoutine,
  type RoutineVersionExercise,
  type LoadDirective,
} from "@/lib/pro-routines";
import { useToast } from "@/hooks/use-toast";
import { useWeightUnits } from "@/hooks/useWeightUnits";
import AddExerciseModal from "@/components/AddExerciseModal";

interface EditingExercise {
  id: string;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  load_directive: LoadDirective;
  target_weight_value: number | null;
  special_instructions: string | null;
}

export default function ProProgrammeEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const weightUnits = useWeightUnits();
  
  const { data, isLoading, error } = useProRoutine(id);
  const updateRoutine = useUpdateProRoutine();
  const addExercise = useAddProExercise();
  const updateExercise = useUpdateProExercise();
  const deleteExercise = useDeleteProExercise();
  const reorderExercises = useReorderProExercises();
  const approveRoutine = useApproveProRoutine();
  
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDay, setAddModalDay] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<EditingExercise | null>(null);
  
  useEffect(() => {
    if (data?.routine) {
      setEditName(data.routine.name);
      setEditDescription(data.routine.description || "");
    }
  }, [data?.routine]);
  
  const handleSaveHeader = async () => {
    if (!id) return;
    try {
      await updateRoutine.mutateAsync({
        routineId: id,
        updates: {
          name: editName,
          description: editDescription || undefined,
        },
      });
      setIsEditingHeader(false);
      setHasUnsavedChanges(false);
      toast({
        title: "Changes Saved",
        description: "Programme details updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    }
  };
  
  const handleCancelHeaderEdit = () => {
    if (data?.routine) {
      setEditName(data.routine.name);
      setEditDescription(data.routine.description || "");
    }
    setIsEditingHeader(false);
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveRoutine.mutateAsync({ routineId: id });
      toast({
        title: "Routine Approved",
        description: "This routine is now active and can be assigned to clients.",
      });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve routine",
        variant: "destructive",
      });
    }
  };

  const handleOpenAddModal = (dayNumber: number) => {
    setAddModalDay(dayNumber);
    setAddModalOpen(true);
  };

  const handleAddExercise = async (exerciseData: { 
    exercise_id: string | null; 
    custom_exercise_name: string | null;
    name: string;
  }) => {
    if (!id) return;
    
    const dayExercises = data?.exercises.filter(ex => ex.day_number === addModalDay) || [];
    const maxOrder = dayExercises.length > 0 
      ? Math.max(...dayExercises.map(ex => ex.order_in_day)) 
      : 0;
    
    try {
      await addExercise.mutateAsync({
        routineId: id,
        exercise: {
          exercise_id: exerciseData.exercise_id,
          custom_exercise_name: exerciseData.custom_exercise_name,
          day_number: addModalDay,
          order_in_day: maxOrder + 1,
          sets: 3,
          reps_min: 8,
          reps_max: 12,
          rest_seconds: 90,
          load_directive: 'open',
        },
      });
      toast({
        description: `Added "${exerciseData.name}" to Day ${addModalDay}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to add exercise",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExercise = async () => {
    if (!id || !deleteConfirmId) return;
    
    try {
      await deleteExercise.mutateAsync({
        routineId: id,
        exerciseId: deleteConfirmId,
      });
      toast({
        description: "Exercise removed",
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove exercise",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleMoveExercise = async (exercise: RoutineVersionExercise, direction: 'up' | 'down') => {
    if (!id || !data) return;
    
    const dayExercises = data.exercises
      .filter(ex => ex.day_number === exercise.day_number)
      .sort((a, b) => a.order_in_day - b.order_in_day);
    
    const currentIndex = dayExercises.findIndex(ex => ex.id === exercise.id);
    if (currentIndex === -1) return;
    
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= dayExercises.length) return;
    
    const reorderedExercises = [...dayExercises];
    [reorderedExercises[currentIndex], reorderedExercises[swapIndex]] = 
      [reorderedExercises[swapIndex], reorderedExercises[currentIndex]];
    
    const updates = reorderedExercises.map((ex, idx) => ({
      id: ex.id,
      day_number: exercise.day_number,
      order_in_day: idx + 1,
    }));
    
    try {
      await reorderExercises.mutateAsync({
        routineId: id,
        exercises: updates,
      });
    } catch (error: any) {
      toast({
        title: "Failed to reorder",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleStartEditExercise = (exercise: RoutineVersionExercise) => {
    const displayWeight = exercise.target_weight_kg !== null 
      ? (exercise.entered_weight_unit === weightUnits.preferredUnit && exercise.entered_weight_value !== null
          ? exercise.entered_weight_value
          : weightUnits.fromKg(exercise.target_weight_kg))
      : null;
    
    setEditingExercise({
      id: exercise.id,
      sets: exercise.sets,
      reps_min: exercise.reps_min,
      reps_max: exercise.reps_max,
      rest_seconds: exercise.rest_seconds,
      load_directive: exercise.load_directive,
      target_weight_value: displayWeight,
      special_instructions: exercise.special_instructions,
    });
  };

  const handleSaveExercise = async () => {
    if (!id || !editingExercise) return;
    
    if (!weightUnits.isReady && editingExercise.target_weight_value !== null) {
      toast({
        title: "Please wait",
        description: "Loading your unit preferences...",
        variant: "destructive",
      });
      return;
    }
    
    let targetWeightKg: number | null = null;
    let enteredWeightValue: number | null = null;
    let enteredWeightUnit: 'kg' | 'lbs' | null = null;
    
    if (editingExercise.target_weight_value !== null && editingExercise.load_directive === 'absolute') {
      targetWeightKg = weightUnits.toKg(editingExercise.target_weight_value);
      enteredWeightValue = editingExercise.target_weight_value;
      enteredWeightUnit = weightUnits.preferredUnit;
    }
    
    try {
      await updateExercise.mutateAsync({
        routineId: id,
        exerciseId: editingExercise.id,
        updates: {
          sets: editingExercise.sets,
          reps_min: editingExercise.reps_min,
          reps_max: editingExercise.reps_max,
          rest_seconds: editingExercise.rest_seconds,
          load_directive: editingExercise.load_directive,
          target_weight_kg: targetWeightKg,
          entered_weight_value: enteredWeightValue,
          entered_weight_unit: enteredWeightUnit,
          special_instructions: editingExercise.special_instructions,
        },
      });
      setEditingExercise(null);
      toast({
        description: "Exercise updated",
      });
    } catch (error: any) {
      toast({
        title: "Failed to update exercise",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleAddDay = async () => {
    if (!id || !data) return;
    
    const existingDays = Array.from(new Set(data.exercises.map(ex => ex.day_number)));
    const newDayNumber = existingDays.length > 0 ? Math.max(...existingDays) + 1 : 1;
    
    if (newDayNumber > 7) {
      toast({
        title: "Maximum days reached",
        description: "A programme can have up to 7 training days.",
        variant: "destructive",
      });
      return;
    }
    
    setAddModalDay(newDayNumber);
    setAddModalOpen(true);
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="mb-6">
          <Skeleton className="h-6 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="mb-6">
          <Link href="/pro" className="inline-flex items-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Programme not found or you don't have access.</p>
            <Link href="/pro">
              <Button variant="outline" className="mt-4">
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { routine, exercises, activeVersion } = data;
  const isDraft = activeVersion?.status === 'draft';
  
  const exercisesByDay = exercises.reduce((acc, ex) => {
    if (!acc[ex.day_number]) acc[ex.day_number] = [];
    acc[ex.day_number].push(ex);
    return acc;
  }, {} as Record<number, typeof exercises>);
  
  const dayNumbers = Object.keys(exercisesByDay).map(Number).sort((a, b) => a - b);
  const isPending = addExercise.isPending || updateExercise.isPending || deleteExercise.isPending || reorderExercises.isPending;

  const renderExerciseRow = (exercise: RoutineVersionExercise, idx: number, dayExercises: RoutineVersionExercise[]) => {
    const isEditing = editingExercise?.id === exercise.id;
    
    if (isEditing && editingExercise) {
      return (
        <div 
          key={exercise.id}
          className="p-4 rounded-lg border bg-muted/50"
          data-testid={`exercise-edit-${exercise.id}`}
        >
          <div className="space-y-4">
            <div className="font-medium">
              {exercise.exercise?.name || exercise.custom_exercise_name || "Unknown Exercise"}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sets</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={editingExercise.sets}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    sets: parseInt(e.target.value) || 1,
                  })}
                  data-testid="input-edit-sets"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Reps</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={editingExercise.reps_min ?? ""}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    reps_min: e.target.value ? parseInt(e.target.value) : null,
                  })}
                  data-testid="input-edit-reps-min"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Reps</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={editingExercise.reps_max ?? ""}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    reps_max: e.target.value ? parseInt(e.target.value) : null,
                  })}
                  data-testid="input-edit-reps-max"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rest (sec)</Label>
                <Input
                  type="number"
                  min="0"
                  max="600"
                  value={editingExercise.rest_seconds ?? ""}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    rest_seconds: e.target.value ? parseInt(e.target.value) : null,
                  })}
                  data-testid="input-edit-rest"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Load Type</Label>
                <Select
                  value={editingExercise.load_directive}
                  onValueChange={(v) => setEditingExercise({
                    ...editingExercise,
                    load_directive: v as LoadDirective,
                    target_weight_value: v !== 'absolute' ? null : editingExercise.target_weight_value,
                  })}
                >
                  <SelectTrigger data-testid="select-load-directive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open (Client's choice)</SelectItem>
                    <SelectItem value="absolute">Target Weight</SelectItem>
                    <SelectItem value="bodyweight">Bodyweight</SelectItem>
                    <SelectItem value="assisted">Assisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingExercise.load_directive === 'absolute' && (
                <div className="space-y-1">
                  <Label className="text-xs">Target Weight ({weightUnits.unitLabel})</Label>
                  <Input
                    type="number"
                    min="0"
                    step={weightUnits.inputStep}
                    value={editingExercise.target_weight_value ?? ""}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      target_weight_value: e.target.value ? parseFloat(e.target.value) : null,
                    })}
                    data-testid="input-edit-weight"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Special Instructions</Label>
              <Textarea
                value={editingExercise.special_instructions ?? ""}
                onChange={(e) => setEditingExercise({
                  ...editingExercise,
                  special_instructions: e.target.value || null,
                })}
                placeholder="e.g., Focus on slow eccentric, use tempo 3-1-2"
                className="resize-none"
                rows={2}
                data-testid="input-edit-instructions"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveExercise}
                disabled={updateExercise.isPending}
                data-testid="button-save-exercise"
              >
                {updateExercise.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span className="ml-1">Save</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingExercise(null)}
                disabled={updateExercise.isPending}
                data-testid="button-cancel-exercise-edit"
              >
                <X className="h-4 w-4" />
                <span className="ml-1">Cancel</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        key={exercise.id}
        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
        onClick={() => handleStartEditExercise(exercise)}
        data-testid={`exercise-${exercise.id}`}
      >
        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            disabled={idx === 0 || isPending}
            onClick={() => handleMoveExercise(exercise, 'up')}
            data-testid={`button-move-up-${exercise.id}`}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            disabled={idx === dayExercises.length - 1 || isPending}
            onClick={() => handleMoveExercise(exercise, 'down')}
            data-testid={`button-move-down-${exercise.id}`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {exercise.exercise?.name || exercise.custom_exercise_name || "Unknown Exercise"}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{exercise.sets} sets</span>
            {exercise.reps_min && exercise.reps_max && (
              <span>{exercise.reps_min}-{exercise.reps_max} reps</span>
            )}
            {exercise.reps_min && !exercise.reps_max && (
              <span>{exercise.reps_min} reps</span>
            )}
            {exercise.rest_seconds && (
              <span>{exercise.rest_seconds}s rest</span>
            )}
            {exercise.load_directive !== 'open' && (
              <Badge variant="outline" className="text-xs">
                {exercise.load_directive === 'absolute' && exercise.target_weight_kg 
                  ? weightUnits.format(exercise.target_weight_kg)
                  : exercise.load_directive}
              </Badge>
            )}
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="shrink-0 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmId(exercise.id);
          }}
          disabled={isPending}
          data-testid={`button-delete-${exercise.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <Link href="/pro" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        
        <Button 
          onClick={async () => {
            if (hasUnsavedChanges && id) {
              try {
                await updateRoutine.mutateAsync({
                  routineId: id,
                  updates: {
                    name: editName,
                    description: editDescription || undefined,
                  },
                });
                toast({
                  title: "Programme Saved",
                  description: "Your changes have been saved.",
                });
              } catch (error: any) {
                toast({
                  title: "Save Failed",
                  description: error.message || "Failed to save changes",
                  variant: "destructive",
                });
                return;
              }
            }
            setLocation("/pro");
          }}
          disabled={updateRoutine.isPending}
          data-testid="button-save-programme"
        >
          {updateRoutine.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {hasUnsavedChanges ? "Save & Exit" : "Done"}
            </>
          )}
        </Button>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          {isEditingHeader ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Programme Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Programme name"
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Brief description..."
                  className="resize-none"
                  rows={2}
                  data-testid="input-edit-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveHeader}
                  disabled={updateRoutine.isPending || !editName.trim()}
                  data-testid="button-save-header"
                >
                  {updateRoutine.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span className="ml-1">Save</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelHeaderEdit}
                  disabled={updateRoutine.isPending}
                  data-testid="button-cancel-header"
                >
                  <X className="h-4 w-4" />
                  <span className="ml-1">Cancel</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle data-testid="text-programme-name">{routine.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditingHeader(true)}
                    data-testid="button-edit-header"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
                {routine.description && (
                  <CardDescription>{routine.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {isDraft && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Draft
                  </Badge>
                )}
                {routine.sessions_per_week && (
                  <Badge variant="secondary">
                    {routine.sessions_per_week} days/week
                  </Badge>
                )}
                {routine.duration_weeks && (
                  <Badge variant="outline">
                    {routine.duration_weeks} weeks
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        {isDraft && (
          <CardContent className="pt-0 pb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">This routine is a draft</p>
                <p className="text-amber-600 dark:text-amber-400">Approve it to make it available for client assignments.</p>
              </div>
              <Button
                onClick={handleApprove}
                disabled={approveRoutine.isPending}
                className="shrink-0"
                data-testid="button-approve-routine"
              >
                {approveRoutine.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
      
      <div className="space-y-4">
        {dayNumbers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No exercises added yet</p>
              <p className="text-sm">
                This programme is empty. Add exercises to build out your training plan.
              </p>
              <Button 
                className="mt-4" 
                onClick={() => handleOpenAddModal(1)}
                data-testid="button-add-first-exercise"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </CardContent>
          </Card>
        ) : (
          dayNumbers.map((dayNum) => {
            const dayExercises = exercisesByDay[dayNum].sort((a, b) => a.order_in_day - b.order_in_day);
            
            return (
              <Card key={dayNum}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-lg">
                      Day {dayNum}
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleOpenAddModal(dayNum)}
                      disabled={isPending}
                      data-testid={`button-add-exercise-day-${dayNum}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dayExercises.map((exercise, idx) => 
                      renderExerciseRow(exercise, idx, dayExercises)
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        
        {dayNumbers.length > 0 && dayNumbers.length < 7 && (
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleAddDay}
            disabled={isPending}
            data-testid="button-add-day"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Training Day
          </Button>
        )}
      </div>

      <AddExerciseModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAddExercise={handleAddExercise}
        dayNumber={addModalDay}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this exercise from the programme?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteExercise}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteExercise.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
