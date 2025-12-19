import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

type EquipmentOption = {
  id: string;
  name: string;
  category: string;
  display_order: number;
  is_active: boolean;
};

type Exercise = {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  equipment_tags: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  instructions: string | null;
  video_url: string | null;
  demonstration_notes: string | null;
  is_system: boolean;
};

export function ExercisesTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pageSize = 20;

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    muscle_groups: [] as string[],
    equipment_tags: [] as string[],
    difficulty_level: "intermediate" as 'beginner' | 'intermediate' | 'advanced',
    instructions: "",
    video_url: "",
    demonstration_notes: "",
    is_system: true,
  });

  const { data, isLoading } = useQuery<{ exercises: Exercise[]; total: number }>({
    queryKey: ["/api/admin/exercises", { search: searchQuery, category: categoryFilter, offset: currentPage * pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString(),
      });
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);

      const response = await apiRequest("GET", `/api/admin/exercises?${params}`);
      return response.json();
    },
  });

  const { data: equipment = [] } = useQuery<EquipmentOption[]>({
    queryKey: ["/api/admin/equipment"],
  });

  const exercises = data?.exercises || [];
  const totalExercises = data?.total || 0;
  const totalPages = Math.ceil(totalExercises / pageSize);

  const categories = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Cardio", "Full Body", "Other"];
  const muscleGroups = ["Chest", "Upper Back", "Lats", "Lower Back", "Front Delts", "Side Delts", "Rear Delts", "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Calves", "Abs", "Obliques"];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/admin/exercises", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] });
      toast({ title: "Exercise created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create exercise", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      await apiRequest("PUT", `/api/admin/exercises/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] });
      toast({ title: "Exercise updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update exercise", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/exercises/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] });
      toast({ title: "Exercise deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete exercise", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      muscle_groups: [],
      equipment_tags: [],
      difficulty_level: "intermediate",
      instructions: "",
      video_url: "",
      demonstration_notes: "",
      is_system: true,
    });
    setEditingExercise(null);
  };

  const openEditDialog = (item: Exercise) => {
    setEditingExercise(item);
    setFormData({
      name: item.name,
      category: item.category,
      muscle_groups: item.muscle_groups || [],
      equipment_tags: item.equipment_tags || [],
      difficulty_level: item.difficulty_level,
      instructions: item.instructions || "",
      video_url: item.video_url || "",
      demonstration_notes: item.demonstration_notes || "",
      is_system: item.is_system,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExercise) {
      const { is_system, ...updateData } = formData;
      updateMutation.mutate({ id: editingExercise.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleArrayItem = (array: string[], item: string) => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Exercise Library</h2>
          <p className="text-sm text-muted-foreground">{totalExercises} exercises</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-exercise">
              <Plus className="w-4 h-4 mr-2" />
              Add Exercise
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExercise ? "Edit Exercise" : "Add Exercise"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exercise-name">Name *</Label>
                  <Input
                    id="exercise-name"
                    data-testid="input-exercise-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Barbell Bench Press"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exercise-category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger id="exercise-category" data-testid="select-exercise-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Muscle Groups</Label>
                <div className="flex flex-wrap gap-2">
                  {muscleGroups.map(mg => (
                    <Badge
                      key={mg}
                      variant={formData.muscle_groups.includes(mg) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        muscle_groups: toggleArrayItem(prev.muscle_groups, mg)
                      }))}
                    >
                      {mg}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Equipment</Label>
                <div className="flex flex-wrap gap-2">
                  {equipment.filter(e => e.is_active).map(eq => (
                    <Badge
                      key={eq.id}
                      variant={formData.equipment_tags.includes(eq.name) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        equipment_tags: toggleArrayItem(prev.equipment_tags, eq.name)
                      }))}
                    >
                      {eq.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exercise-difficulty">Difficulty</Label>
                <Select
                  value={formData.difficulty_level}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, difficulty_level: v as 'beginner' | 'intermediate' | 'advanced' }))}
                >
                  <SelectTrigger id="exercise-difficulty" data-testid="select-exercise-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exercise-instructions">Instructions</Label>
                <Textarea
                  id="exercise-instructions"
                  data-testid="input-exercise-instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="Step-by-step instructions for performing the exercise..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exercise-video">Video URL</Label>
                <Input
                  id="exercise-video"
                  data-testid="input-exercise-video"
                  value={formData.video_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                  placeholder="https://youtube.com/..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="exercise-system"
                  data-testid="switch-exercise-system"
                  checked={formData.is_system}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_system: checked }))}
                />
                <Label htmlFor="exercise-system">System Exercise (available to all users)</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-exercise">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingExercise ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
            placeholder="Search exercises..."
            className="pl-9"
            data-testid="input-search-exercises"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(0); }}>
          <SelectTrigger className="w-40" data-testid="select-category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No exercises found
        </div>
      ) : (
        <div className="space-y-2">
          {exercises.map(exercise => (
            <Card key={exercise.id} data-testid={`exercise-row-${exercise.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{exercise.name}</h3>
                      <Badge variant="secondary">{exercise.category}</Badge>
                      <Badge variant="outline">{exercise.difficulty_level}</Badge>
                    </div>
                    {exercise.muscle_groups.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {exercise.muscle_groups.map(mg => (
                          <Badge key={mg} variant="outline" className="text-xs">{mg}</Badge>
                        ))}
                      </div>
                    )}
                    {exercise.equipment_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {exercise.equipment_tags.map(eq => (
                          <Badge key={eq} variant="secondary" className="text-xs">{eq}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(exercise)}
                      data-testid={`button-edit-exercise-${exercise.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this exercise?")) {
                          deleteMutation.mutate(exercise.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-exercise-${exercise.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
