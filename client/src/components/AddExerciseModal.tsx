import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
}

interface AddExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onAddExercise: (exercise: { 
    exercise_id: string | null; 
    custom_exercise_name: string | null; 
    name: string;
  }) => void;
  dayNumber: number;
}

export default function AddExerciseModal({ 
  open, 
  onClose, 
  onAddExercise,
  dayNumber 
}: AddExerciseModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['/api/exercises'],
    enabled: open,
  });

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscle_groups?.some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectExercise = (exercise: Exercise) => {
    onAddExercise({
      exercise_id: exercise.id,
      custom_exercise_name: null,
      name: exercise.name,
    });
    handleClose();
  };

  const handleAddCustom = () => {
    if (customName.trim()) {
      onAddExercise({
        exercise_id: null,
        custom_exercise_name: customName.trim(),
        name: customName.trim(),
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setCustomName("");
    setShowCustomInput(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Exercise to Day {dayNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-exercises"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
              <div className="space-y-2 pr-4">
                {filteredExercises.length === 0 && searchQuery && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="mb-2">No exercises found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomName(searchQuery);
                        setShowCustomInput(true);
                      }}
                    >
                      Add "{searchQuery}" as custom exercise
                    </Button>
                  </div>
                )}
                {filteredExercises.map((exercise) => (
                  <Card 
                    key={exercise.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleSelectExercise(exercise)}
                    data-testid={`exercise-option-${exercise.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{exercise.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {exercise.category && (
                              <Badge variant="secondary" className="text-xs">
                                {exercise.category}
                              </Badge>
                            )}
                            {exercise.muscle_groups?.slice(0, 2).map((mg, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {mg}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {showCustomInput ? (
            <div className="space-y-3 pt-2 border-t">
              <Label>Custom Exercise Name</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter exercise name"
                data-testid="input-custom-exercise-name"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddCustom}
                  disabled={!customName.trim()}
                  className="flex-1"
                  data-testid="button-add-custom-exercise"
                >
                  Add Custom Exercise
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCustomInput(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowCustomInput(true)}
              className="w-full"
              data-testid="button-show-custom-input"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Exercise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
