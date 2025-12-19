import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2, Search, ClipboardList, MoreHorizontal, Eye, Copy, Archive, UserCircle, Target, Dumbbell, Calendar, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";

type GoalType = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
};

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

type RoutineBlueprint = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  owner_type: 'platform' | 'professional' | 'client';
  creation_method: 'manual' | 'template' | 'ai_assisted';
  goal_type_id: string | null;
  equipment_profile: string[] | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  is_template: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type RoutineVersion = {
  id: string;
  blueprint_id: string;
  version_number: number;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
};

type RoutineVersionExercise = {
  id: string;
  version_id: string;
  exercise_id: string | null;
  custom_exercise_name: string | null;
  day_number: number;
  order_in_day: number;
  sets: number;
  reps_min: number;
  reps_max: number | null;
  rest_seconds: number;
  notes: string | null;
};

type SupabaseUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isPremium: boolean;
  createdAt: string;
};

interface BuilderExercise {
  id: string;
  exercise_id: string;
  day_number: number;
  order_in_day: number;
  sets: number;
  reps_min: number;
  reps_max: number | null;
  rest_seconds: number;
  notes: string;
}

interface BuilderState {
  name: string;
  description: string;
  goal_type_id: string;
  sessions_per_week: number;
  duration_weeks: number | null;
  equipment_profile: string[];
  exercises: BuilderExercise[];
}

const initialBuilderState: BuilderState = {
  name: "",
  description: "",
  goal_type_id: "",
  sessions_per_week: 3,
  duration_weeks: null,
  equipment_profile: [],
  exercises: [],
};

export function RoutinesTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [creationMethodFilter, setCreationMethodFilter] = useState<string>("all");
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [viewingRoutine, setViewingRoutine] = useState<RoutineBlueprint | null>(null);
  const [routineExercises, setRoutineExercises] = useState<RoutineVersionExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderState, setBuilderState] = useState<BuilderState>(initialBuilderState);
  const [selectedDayForExercise, setSelectedDayForExercise] = useState(1);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [aiBuilderStep, setAiBuilderStep] = useState(1);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiEquipment, setAiEquipment] = useState<string[]>([]);
  const [aiGoalId, setAiGoalId] = useState("");
  const [aiSessionsPerWeek, setAiSessionsPerWeek] = useState(3);
  const [aiDurationWeeks, setAiDurationWeeks] = useState<number | null>(null);
  const [aiGeneratedRoutine, setAiGeneratedRoutine] = useState<RoutineBlueprint | null>(null);
  const [aiGeneratedExercises, setAiGeneratedExercises] = useState<RoutineVersionExercise[]>([]);

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningRoutine, setAssigningRoutine] = useState<RoutineBlueprint | null>(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignEndDate, setAssignEndDate] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  const { data: routines = [], isLoading, refetch } = useQuery<RoutineBlueprint[]>({
    queryKey: ["/api/admin/routines"],
  });

  const { data: goals = [] } = useQuery<GoalType[]>({
    queryKey: ["/api/admin/goals"],
  });

  const { data: equipment = [] } = useQuery<EquipmentOption[]>({
    queryKey: ["/api/admin/equipment"],
  });

  const { data: exercisesData, isLoading: exercisesLoading } = useQuery<{ exercises: Exercise[]; total: number }>({
    queryKey: ["/api/admin/exercises", { limit: 500 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/exercises?limit=500");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery<SupabaseUser[]>({
    queryKey: ["/api/admin/supabase-users"],
    staleTime: 5 * 60 * 1000,
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/routines/${id}/clone`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routines"] });
      toast({ title: "Routine cloned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to clone routine", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/routines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routines"] });
      toast({ title: "Routine archived successfully" });
    },
    onError: () => {
      toast({ title: "Failed to archive routine", variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { routineId: string; clientId: string; startDate?: string; endDate?: string; notes?: string }) => {
      const versionsResponse = await apiRequest("GET", `/api/admin/routines/${data.routineId}/versions`);
      const versions: RoutineVersion[] = await versionsResponse.json();
      const activeVersion = versions.find((v: RoutineVersion) => v.status === 'active') || versions[0];
      if (!activeVersion) throw new Error("No version found for this routine");

      await apiRequest("POST", "/api/admin/assignments", {
        routine_version_id: activeVersion.id,
        client_id: data.clientId,
        status: 'active',
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Programme assigned successfully" });
      closeAssignDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to assign programme", variant: "destructive" });
    },
  });

  const openAssignDialog = (routine: RoutineBlueprint) => {
    setAssigningRoutine(routine);
    setAssignClientId("");
    setAssignStartDate("");
    setAssignEndDate("");
    setAssignNotes("");
    setShowAssignDialog(true);
  };

  const closeAssignDialog = () => {
    setShowAssignDialog(false);
    setAssigningRoutine(null);
    setAssignClientId("");
    setAssignStartDate("");
    setAssignEndDate("");
    setAssignNotes("");
  };

  const createRoutineMutation = useMutation({
    mutationFn: async (state: BuilderState) => {
      const blueprintResponse = await apiRequest("POST", "/api/admin/routines", {
        name: state.name,
        description: state.description || null,
        owner_type: "platform",
        creation_method: "manual",
        goal_type_id: state.goal_type_id || null,
        equipment_profile: state.equipment_profile.length > 0 ? state.equipment_profile : null,
        duration_weeks: state.duration_weeks,
        sessions_per_week: state.sessions_per_week,
        is_template: true,
      });
      const blueprint: { blueprint: { id: string }; version: { id: string } } = await blueprintResponse.json();
      
      if (state.exercises.length > 0) {
        const exercisesPayload = state.exercises.map(ex => ({
          exercise_id: ex.exercise_id,
          day_number: ex.day_number,
          order_in_day: ex.order_in_day,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes || null,
        }));
        try {
          await apiRequest("PUT", `/api/admin/routines/${blueprint.blueprint.id}/exercises`, exercisesPayload);
          await apiRequest("PUT", `/api/admin/routines/${blueprint.blueprint.id}/versions/${blueprint.version.id}/activate`);
        } catch (error) {
          console.error("Failed to add exercises or activate version, but blueprint created:", blueprint.blueprint.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routines"] });
      toast({ title: "Routine created successfully" });
      closeBuilder();
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to create routine", variant: "destructive" });
    },
  });

  const closeBuilder = () => {
    setShowBuilder(false);
    setBuilderStep(1);
    setBuilderState(initialBuilderState);
    setSelectedDayForExercise(1);
    setExerciseSearchQuery("");
  };

  const closeAIBuilder = () => {
    setShowAIBuilder(false);
    setAiBuilderStep(1);
    setAiPrompt("");
    setAiEquipment([]);
    setAiGoalId("");
    setAiSessionsPerWeek(3);
    setAiDurationWeeks(null);
    setAiGeneratedRoutine(null);
    setAiGeneratedExercises([]);
  };

  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/routines/ai-generate", {
        prompt_text: aiPrompt,
        equipment_selected: aiEquipment,
        goal_type_id: aiGoalId || null,
        sessions_per_week: aiSessionsPerWeek,
        duration_weeks: aiDurationWeeks,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      setAiGeneratedRoutine(data.blueprint);
      if (data.blueprint?.id) {
        try {
          const exercisesResponse = await apiRequest("GET", `/api/admin/routines/${data.blueprint.id}/exercises`);
          const exercises = await exercisesResponse.json();
          setAiGeneratedExercises(Array.isArray(exercises) ? exercises : []);
        } catch (error) {
          console.error("Failed to fetch generated exercises:", error);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/routines"] });
      await refetch();
      setAiBuilderStep(3);
      toast({ title: "Routine generated successfully! Review and edit as needed." });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "AI generation failed", variant: "destructive" });
    },
  });

  const activateAIRoutineMutation = useMutation({
    mutationFn: async () => {
      if (!aiGeneratedRoutine) throw new Error("No routine to activate");
      
      const exercisesPayload = aiGeneratedExercises.map(ex => ({
        exercise_id: ex.exercise_id,
        custom_exercise_name: ex.custom_exercise_name || null,
        day_number: ex.day_number,
        order_in_day: ex.order_in_day,
        sets: ex.sets,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes || null,
      }));
      
      try {
        await apiRequest("PUT", `/api/admin/routines/${aiGeneratedRoutine.id}/exercises`, exercisesPayload);
      } catch (error) {
        console.error("Failed to save modified exercises");
      }
      
      const versionsResponse = await apiRequest("GET", `/api/admin/routines/${aiGeneratedRoutine.id}/versions`);
      const versions = await versionsResponse.json();
      const latestVersion = versions[0];
      if (!latestVersion) throw new Error("No version found");
      
      await apiRequest("PUT", `/api/admin/routines/${aiGeneratedRoutine.id}/versions/${latestVersion.id}/activate`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/routines"] });
      await refetch();
      toast({ title: "Routine saved and added to library" });
      closeAIBuilder();
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to activate routine", variant: "destructive" });
    },
  });

  const addExerciseToBuilder = (exercise: Exercise) => {
    const dayExercises = builderState.exercises.filter(ex => ex.day_number === selectedDayForExercise);
    const newExercise: BuilderExercise = {
      id: `temp-${Date.now()}-${Math.random()}`,
      exercise_id: exercise.id,
      day_number: selectedDayForExercise,
      order_in_day: dayExercises.length + 1,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      rest_seconds: 90,
      notes: "",
    };
    setBuilderState(prev => ({ ...prev, exercises: [...prev.exercises, newExercise] }));
  };

  const removeExerciseFromBuilder = (exerciseId: string) => {
    setBuilderState(prev => {
      const filtered = prev.exercises.filter(ex => ex.id !== exerciseId);
      const reordered = filtered.map((ex) => {
        const sameDay = filtered.filter(e => e.day_number === ex.day_number);
        const orderInDay = sameDay.findIndex(e => e.id === ex.id) + 1;
        return { ...ex, order_in_day: orderInDay };
      });
      return { ...prev, exercises: reordered };
    });
  };

  const updateExerciseInBuilder = (exerciseId: string, updates: Partial<BuilderExercise>) => {
    setBuilderState(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => ex.id === exerciseId ? { ...ex, ...updates } : ex),
    }));
  };

  const getBuilderExerciseName = (exerciseId: string) => {
    if (exercisesData?.exercises) {
      const found = exercisesData.exercises.find(e => e.id === exerciseId);
      return found?.name || "Unknown";
    }
    return "Loading...";
  };

  const uniqueDays = Array.from(new Set(builderState.exercises.map(ex => ex.day_number))).sort((a, b) => a - b);
  const maxDay = uniqueDays.length > 0 ? Math.max(...uniqueDays) : 0;

  const filteredBuilderExercises = exercisesData?.exercises?.filter(ex => {
    if (!exerciseSearchQuery) return true;
    return ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
           ex.category?.toLowerCase().includes(exerciseSearchQuery.toLowerCase());
  }) || [];

  const groupedEquipment = equipment.reduce<Record<string, EquipmentOption[]>>((acc, eq) => {
    const category = eq.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(eq);
    return acc;
  }, {});

  const loadRoutineDetails = async (routine: RoutineBlueprint) => {
    setViewingRoutine(routine);
    setRoutineExercises([]);
    setLoadingExercises(true);
    try {
      const response = await fetch(`/api/admin/routines/${routine.id}/exercises`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRoutineExercises(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to load routine exercises:", response.status);
        setRoutineExercises([]);
      }
    } catch (error) {
      console.error("Failed to load routine exercises:", error);
      setRoutineExercises([]);
    }
    setLoadingExercises(false);
  };

  const getGoalName = (goalId: string | null) => {
    if (!goalId) return "Not specified";
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || "Unknown";
  };

  const getEquipmentNames = (equipmentIds: string[] | null) => {
    if (!equipmentIds || equipmentIds.length === 0) return "No equipment specified";
    return equipmentIds.map(id => {
      const eq = equipment.find(e => e.id === id);
      return eq?.name || id;
    }).join(", ");
  };

  const getExerciseName = (ex: RoutineVersionExercise) => {
    if (ex.custom_exercise_name) return ex.custom_exercise_name;
    if (ex.exercise_id) {
      if (exercisesLoading) return "Loading...";
      if (exercisesData?.exercises) {
        const found = exercisesData.exercises.find((e: Exercise) => e.id === ex.exercise_id);
        return found?.name || `Exercise (${ex.exercise_id.slice(0, 8)}...)`;
      }
      return `Exercise (${ex.exercise_id.slice(0, 8)}...)`;
    }
    return "Custom exercise";
  };

  const filteredRoutines = routines.filter(routine => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!routine.name.toLowerCase().includes(q) && 
          !routine.description?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (creationMethodFilter !== "all" && routine.creation_method !== creationMethodFilter) {
      return false;
    }
    if (goalFilter !== "all" && routine.goal_type_id !== goalFilter) {
      return false;
    }
    return true;
  });

  const groupedExercises = routineExercises.reduce((acc, ex) => {
    if (!acc[ex.day_number]) acc[ex.day_number] = [];
    acc[ex.day_number].push(ex);
    return acc;
  }, {} as Record<number, RoutineVersionExercise[]>);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">System Routines</h2>
          <p className="text-sm text-muted-foreground">{routines.length} routines in library</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBuilder(true)} data-testid="button-create-routine-manual">
            <Plus className="w-4 h-4 mr-2" />
            Manual
          </Button>
          <Button onClick={() => setShowAIBuilder(true)} data-testid="button-create-routine-ai">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Generate
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search routines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-routines"
          />
        </div>
        <Select value={creationMethodFilter} onValueChange={setCreationMethodFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-method">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="ai_assisted">AI Assisted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={goalFilter} onValueChange={setGoalFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-goal">
            <SelectValue placeholder="Goal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Goals</SelectItem>
            {goals.map(goal => (
              <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredRoutines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || creationMethodFilter !== "all" || goalFilter !== "all"
                ? "No routines match your filters"
                : "No system routines yet. Create your first routine using Manual or AI Generate."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoutines.map(routine => (
            <Card key={routine.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{routine.name}</CardTitle>
                    {routine.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {routine.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-routine-actions-${routine.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => loadRoutineDetails(routine)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAssignDialog(routine)}>
                        <UserCircle className="w-4 h-4 mr-2" />
                        Assign to Client
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => cloneMutation.mutate(routine.id)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => archiveMutation.mutate(routine.id)} className="text-destructive">
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Goal:</span>
                    <span>{getGoalName(routine.goal_type_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sessions:</span>
                    <span>{routine.sessions_per_week || "-"}/week</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {routine.creation_method === 'ai_assisted' ? 'AI' : routine.creation_method}
                    </Badge>
                    {routine.duration_weeks && (
                      <Badge variant="outline" className="text-xs">
                        {routine.duration_weeks} weeks
                      </Badge>
                    )}
                    {routine.is_template && (
                      <Badge variant="outline" className="text-xs">Template</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewingRoutine} onOpenChange={(open) => !open && setViewingRoutine(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingRoutine?.name}</DialogTitle>
          </DialogHeader>
          {viewingRoutine && (
            <div className="space-y-6">
              {viewingRoutine.description && (
                <p className="text-muted-foreground">{viewingRoutine.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Goal:</span>
                  <span className="ml-2">{getGoalName(viewingRoutine.goal_type_id)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sessions/Week:</span>
                  <span className="ml-2">{viewingRoutine.sessions_per_week || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-2">{viewingRoutine.duration_weeks ? `${viewingRoutine.duration_weeks} weeks` : "Ongoing"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Method:</span>
                  <span className="ml-2 capitalize">{viewingRoutine.creation_method.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Exercises</h4>
                {loadingExercises ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : Object.keys(groupedExercises).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No exercises in this routine.</p>
                ) : (
                  Object.entries(groupedExercises)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([dayNum, dayExercises]) => (
                      <div key={dayNum} className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">Day {dayNum}</h5>
                        <div className="pl-4 space-y-1">
                          {dayExercises.sort((a, b) => a.order_in_day - b.order_in_day).map(ex => (
                            <div key={ex.id} className="flex justify-between text-sm">
                              <span>{getExerciseName(ex)}</span>
                              <span className="text-muted-foreground">
                                {ex.sets} x {ex.reps_min}{ex.reps_max ? `-${ex.reps_max}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => openAssignDialog(viewingRoutine)}>
                  <UserCircle className="w-4 h-4 mr-2" />
                  Assign to Client
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBuilder} onOpenChange={(open) => !open && closeBuilder()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Routine - Step {builderStep} of 4</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    builderStep === step
                      ? "bg-primary text-primary-foreground"
                      : builderStep > step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-8 h-0.5 ${builderStep > step ? "bg-primary/50" : "bg-muted"}`} />
                )}
              </div>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {builderStep === 1 && "Basic Info"}
              {builderStep === 2 && "Equipment"}
              {builderStep === 3 && "Exercises"}
              {builderStep === 4 && "Review"}
            </span>
          </div>

          {builderStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Routine Name *</label>
                <Input
                  value={builderState.name}
                  onChange={(e) => setBuilderState(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Full Body Strength Program"
                  data-testid="input-routine-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={builderState.description}
                  onChange={(e) => setBuilderState(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the routine's focus, target audience, etc."
                  data-testid="input-routine-description"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal Type</label>
                <Select
                  value={builderState.goal_type_id}
                  onValueChange={(v) => setBuilderState(prev => ({ ...prev, goal_type_id: v }))}
                >
                  <SelectTrigger data-testid="select-routine-goal">
                    <SelectValue placeholder="Select a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map(goal => (
                      <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sessions per Week</label>
                  <Input
                    type="number"
                    min="1"
                    max="7"
                    value={builderState.sessions_per_week}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, sessions_per_week: parseInt(e.target.value) || 3 }))}
                    data-testid="input-routine-sessions"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (weeks)</label>
                  <Input
                    type="number"
                    min="1"
                    max="52"
                    value={builderState.duration_weeks || ""}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, duration_weeks: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="Leave empty for ongoing"
                    data-testid="input-routine-duration"
                  />
                </div>
              </div>
            </div>
          )}

          {builderStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select the equipment available for this routine:</p>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(groupedEquipment).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-sm font-medium capitalize">{category.replace('_', ' ')}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
                      {items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(eq => (
                        <label key={eq.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={builderState.equipment_profile.includes(eq.id)}
                            onCheckedChange={(checked) => {
                              setBuilderState(prev => ({
                                ...prev,
                                equipment_profile: checked
                                  ? [...prev.equipment_profile, eq.id]
                                  : prev.equipment_profile.filter(id => id !== eq.id)
                              }));
                            }}
                            data-testid={`checkbox-equipment-${eq.id}`}
                          />
                          {eq.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {builderState.equipment_profile.length} items selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBuilderState(prev => ({ ...prev, equipment_profile: equipment.map(e => e.id) }))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBuilderState(prev => ({ ...prev, equipment_profile: [] }))}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {builderStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Day:</span>
                  <Select
                    value={selectedDayForExercise.toString()}
                    onValueChange={(value) => setSelectedDayForExercise(parseInt(value))}
                  >
                    <SelectTrigger className="w-20" data-testid="select-exercise-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: Math.max(builderState.sessions_per_week, maxDay + 1, 1) }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>Day {day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Search exercises..."
                    value={exerciseSearchQuery}
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    data-testid="input-search-exercise"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 h-80">
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-sm font-medium border-b">
                    Exercise Library
                  </div>
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-1">
                      {exercisesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      ) : filteredBuilderExercises.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No exercises found
                        </p>
                      ) : (
                        filteredBuilderExercises.slice(0, 50).map(exercise => (
                          <div
                            key={exercise.id}
                            className="flex items-center justify-between p-2 hover-elevate rounded cursor-pointer"
                            onClick={() => addExerciseToBuilder(exercise)}
                            data-testid={`button-add-exercise-${exercise.id}`}
                          >
                            <div>
                              <p className="text-sm font-medium">{exercise.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{exercise.category}</p>
                            </div>
                            <Plus className="w-4 h-4" />
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-sm font-medium border-b">
                    Day {selectedDayForExercise} Exercises ({builderState.exercises.filter(ex => ex.day_number === selectedDayForExercise).length})
                  </div>
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-2">
                      {builderState.exercises
                        .filter(ex => ex.day_number === selectedDayForExercise)
                        .sort((a, b) => a.order_in_day - b.order_in_day)
                        .map((ex, idx) => (
                          <div key={ex.id} className="border rounded p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{idx + 1}. {getBuilderExerciseName(ex.exercise_id)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeExerciseFromBuilder(ex.id)}
                                data-testid={`button-remove-exercise-${ex.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Sets</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={ex.sets}
                                  onChange={(e) => updateExerciseInBuilder(ex.id, { sets: parseInt(e.target.value) || 1 })}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Min Reps</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={ex.reps_min}
                                  onChange={(e) => updateExerciseInBuilder(ex.id, { reps_min: parseInt(e.target.value) || 1 })}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Max Reps</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={ex.reps_max || ""}
                                  onChange={(e) => updateExerciseInBuilder(ex.id, { reps_max: e.target.value ? parseInt(e.target.value) : null })}
                                  className="h-7 text-xs"
                                  placeholder="-"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Rest (s)</label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={ex.rest_seconds}
                                  onChange={(e) => updateExerciseInBuilder(ex.id, { rest_seconds: parseInt(e.target.value) || 0 })}
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      {builderState.exercises.filter(ex => ex.day_number === selectedDayForExercise).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Click exercises to add them to Day {selectedDayForExercise}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Total: {builderState.exercises.length} exercises across {uniqueDays.length} days
                </p>
              </div>
            </div>
          )}

          {builderStep === 4 && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{builderState.name || "Untitled Routine"}</CardTitle>
                  {builderState.description && (
                    <CardDescription>{builderState.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Goal:</span>
                      <span className="ml-2">{getGoalName(builderState.goal_type_id)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sessions/Week:</span>
                      <span className="ml-2">{builderState.sessions_per_week}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2">{builderState.duration_weeks ? `${builderState.duration_weeks} weeks` : "Ongoing"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Equipment:</span>
                      <span className="ml-2">{builderState.equipment_profile.length} items</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Exercises by Day</h4>
                    {uniqueDays.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No exercises added</p>
                    ) : (
                      <div className="space-y-3">
                        {uniqueDays.map(dayNum => (
                          <div key={dayNum}>
                            <h5 className="text-sm font-medium text-muted-foreground">Day {dayNum}</h5>
                            <div className="pl-4 space-y-1">
                              {builderState.exercises
                                .filter(ex => ex.day_number === dayNum)
                                .sort((a, b) => a.order_in_day - b.order_in_day)
                                .map(ex => (
                                  <div key={ex.id} className="flex justify-between text-sm">
                                    <span>{getBuilderExerciseName(ex.exercise_id)}</span>
                                    <span className="text-muted-foreground">
                                      {ex.sets} x {ex.reps_min}{ex.reps_max ? `-${ex.reps_max}` : ''}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => builderStep > 1 ? setBuilderStep(prev => prev - 1) : closeBuilder()}
              data-testid="button-builder-back"
            >
              {builderStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button
              onClick={() => {
                if (builderStep < 4) {
                  if (builderStep === 1 && !builderState.name.trim()) {
                    toast({ title: "Please enter a routine name", variant: "destructive" });
                    return;
                  }
                  setBuilderStep(prev => prev + 1);
                } else {
                  createRoutineMutation.mutate(builderState);
                }
              }}
              disabled={createRoutineMutation.isPending}
              data-testid="button-builder-next"
            >
              {createRoutineMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {builderStep === 4 ? "Create Routine" : "Next"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAIBuilder} onOpenChange={(open) => !open && closeAIBuilder()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Routine Generator
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    aiBuilderStep === step
                      ? "bg-primary text-primary-foreground"
                      : aiBuilderStep > step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-0.5 ${aiBuilderStep > step ? "bg-primary/50" : "bg-muted"}`} />
                )}
              </div>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {aiBuilderStep === 1 && "Configure"}
              {aiBuilderStep === 2 && "Generating..."}
              {aiBuilderStep === 3 && "Review"}
            </span>
          </div>

          {aiBuilderStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Describe the routine you want *</label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A 4-day upper/lower split focusing on compound movements for intermediate lifters looking to build strength and muscle mass"
                  className="min-h-24"
                  data-testid="input-ai-prompt"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Goal Type</label>
                  <Select value={aiGoalId} onValueChange={setAiGoalId}>
                    <SelectTrigger data-testid="select-ai-goal">
                      <SelectValue placeholder="Select goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {goals.map(goal => (
                        <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sessions per Week</label>
                  <Input
                    type="number"
                    min="1"
                    max="7"
                    value={aiSessionsPerWeek}
                    onChange={(e) => setAiSessionsPerWeek(parseInt(e.target.value) || 3)}
                    data-testid="input-ai-sessions"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (weeks, optional)</label>
                <Input
                  type="number"
                  min="1"
                  max="52"
                  value={aiDurationWeeks || ""}
                  onChange={(e) => setAiDurationWeeks(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Leave empty for ongoing program"
                  data-testid="input-ai-duration"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Available Equipment</label>
                <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-4">
                    {Object.entries(groupedEquipment).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="text-sm font-medium capitalize">{category.replace('_', ' ')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
                          {items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(eq => (
                            <label key={eq.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={aiEquipment.includes(eq.id)}
                                onCheckedChange={(checked) => {
                                  setAiEquipment(prev => 
                                    checked ? [...prev, eq.id] : prev.filter(id => id !== eq.id)
                                  );
                                }}
                                data-testid={`checkbox-ai-equipment-${eq.id}`}
                              />
                              {eq.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {aiEquipment.length} items selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAiEquipment(equipment.map(e => e.id))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAiEquipment([])}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {aiBuilderStep === 2 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-medium">Generating your routine...</h3>
              <p className="text-sm text-muted-foreground mt-2">
                AI is creating a customized workout plan based on your requirements.
              </p>
            </div>
          )}

          {aiBuilderStep === 3 && aiGeneratedRoutine && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{aiGeneratedRoutine.name}</CardTitle>
                  {aiGeneratedRoutine.description && (
                    <CardDescription>{aiGeneratedRoutine.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Goal:</span>
                      <span className="ml-2">{getGoalName(aiGeneratedRoutine.goal_type_id)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sessions/Week:</span>
                      <span className="ml-2">{aiGeneratedRoutine.sessions_per_week || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2">
                        {aiGeneratedRoutine.duration_weeks ? `${aiGeneratedRoutine.duration_weeks} weeks` : "Ongoing"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Equipment:</span>
                      <span className="ml-2">{aiEquipment.length} items</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Review & Edit Exercises</h4>
                      <span className="text-sm text-muted-foreground">{aiGeneratedExercises.length} exercises</span>
                    </div>
                    {aiGeneratedExercises.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No exercises generated.</p>
                    ) : (
                      <ScrollArea className="h-64">
                        <div className="space-y-4 pr-4">
                          {Object.entries(
                            aiGeneratedExercises.reduce<Record<number, RoutineVersionExercise[]>>((acc, ex) => {
                              const day = ex.day_number;
                              if (!acc[day]) acc[day] = [];
                              acc[day].push(ex);
                              return acc;
                            }, {})
                          ).sort(([a], [b]) => Number(a) - Number(b)).map(([dayNum, dayExercises]) => (
                            <div key={dayNum} className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">Day {dayNum}</h5>
                              <div className="space-y-2">
                                {dayExercises.sort((a, b) => a.order_in_day - b.order_in_day).map(ex => (
                                  <div key={ex.id} className="border rounded p-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">{getExerciseName(ex)}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          setAiGeneratedExercises(prev => prev.filter(e => e.id !== ex.id));
                                        }}
                                        data-testid={`button-remove-ai-exercise-${ex.id}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                      <div>
                                        <label className="text-xs text-muted-foreground">Sets</label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={ex.sets}
                                          onChange={(e) => {
                                            const newSets = parseInt(e.target.value) || 1;
                                            setAiGeneratedExercises(prev => 
                                              prev.map(item => item.id === ex.id ? { ...item, sets: newSets } : item)
                                            );
                                          }}
                                          className="h-7 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">Min Reps</label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={ex.reps_min || ""}
                                          onChange={(e) => {
                                            const newRepsMin = e.target.value ? parseInt(e.target.value) : null;
                                            setAiGeneratedExercises(prev => 
                                              prev.map(item => item.id === ex.id ? { ...item, reps_min: newRepsMin as number } : item)
                                            );
                                          }}
                                          className="h-7 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">Max Reps</label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={ex.reps_max || ""}
                                          onChange={(e) => {
                                            const newRepsMax = e.target.value ? parseInt(e.target.value) : null;
                                            setAiGeneratedExercises(prev => 
                                              prev.map(item => item.id === ex.id ? { ...item, reps_max: newRepsMax } : item)
                                            );
                                          }}
                                          className="h-7 text-xs"
                                          placeholder="-"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">Rest (s)</label>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={ex.rest_seconds || ""}
                                          onChange={(e) => {
                                            const newRest = e.target.value ? parseInt(e.target.value) : null;
                                            setAiGeneratedExercises(prev => 
                                              prev.map(item => item.id === ex.id ? { ...item, rest_seconds: newRest as number } : item)
                                            );
                                          }}
                                          className="h-7 text-xs"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <p className="text-sm text-muted-foreground">
                Modify the exercises above as needed, then click "Add to Library" to save or "Start Over" to regenerate.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (aiBuilderStep === 3) {
                  setAiBuilderStep(1);
                  setAiGeneratedRoutine(null);
                  setAiGeneratedExercises([]);
                } else {
                  closeAIBuilder();
                }
              }}
              disabled={aiBuilderStep === 2}
              data-testid="button-ai-builder-back"
            >
              {aiBuilderStep === 3 ? "Start Over" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                if (aiBuilderStep === 1) {
                  if (!aiPrompt.trim()) {
                    toast({ title: "Please describe the routine you want", variant: "destructive" });
                    return;
                  }
                  setAiBuilderStep(2);
                  aiGenerateMutation.mutate();
                } else if (aiBuilderStep === 3) {
                  activateAIRoutineMutation.mutate();
                }
              }}
              disabled={aiBuilderStep === 2 || aiGenerateMutation.isPending || activateAIRoutineMutation.isPending}
              data-testid="button-ai-builder-generate"
            >
              {(aiGenerateMutation.isPending || activateAIRoutineMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {aiBuilderStep === 1 ? "Generate" : aiBuilderStep === 3 ? "Add to Library" : "Generating..."}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignDialog} onOpenChange={(open) => !open && closeAssignDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Assign Programme to Client
            </DialogTitle>
          </DialogHeader>

          {assigningRoutine && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{assigningRoutine.name}</p>
                {assigningRoutine.description && (
                  <p className="text-sm text-muted-foreground mt-1">{assigningRoutine.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Select Client *</Label>
                <Select value={assignClientId} onValueChange={setAssignClientId}>
                  <SelectTrigger data-testid="select-assign-client">
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.displayName || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground">No users available. Create users in the Users tab first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    data-testid="input-assign-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={assignEndDate}
                    onChange={(e) => setAssignEndDate(e.target.value)}
                    data-testid="input-assign-end-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Any special instructions or notes for this assignment..."
                  className="min-h-20"
                  data-testid="input-assign-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={closeAssignDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!assignClientId) {
                      toast({ title: "Please select a client", variant: "destructive" });
                      return;
                    }
                    assignMutation.mutate({
                      routineId: assigningRoutine.id,
                      clientId: assignClientId,
                      startDate: assignStartDate || undefined,
                      endDate: assignEndDate || undefined,
                      notes: assignNotes || undefined,
                    });
                  }}
                  disabled={assignMutation.isPending}
                  data-testid="button-confirm-assign"
                >
                  {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Assign Programme
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
