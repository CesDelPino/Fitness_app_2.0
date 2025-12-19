import { useState, useMemo } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Apple, Dumbbell, Scale, TrendingUp, TrendingDown, Plus, User, Calendar, ClipboardList, Pause, Play, CheckCircle, XCircle, FileText, Clock, AlertCircle, Ruler, Cake, Users, Camera, Utensils, ChevronDown, ChevronUp, Target, Droplets, CalendarCheck } from "lucide-react";
import { MessageButton } from "@/components/messages/MessageButton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Profile, Relationship, FoodLog, WorkoutSession, WeighIn, ProfessionalRoleType, MealType } from "@shared/supabase-types";
import AssignProgrammeModal from "@/components/AssignProgrammeModal";
import { SetNutritionTargetsModal } from "@/components/SetNutritionTargetsModal";
import { useClientAssignments, useUpdateProAssignment, useCancelProAssignment, type RoutineAssignment } from "@/lib/pro-routines";
import { useProCheckInAssignments, useProCheckInSubmissions, useProCheckInSubmission, type WeeklyMetrics, type CheckInSubmission } from "@/lib/pro-checkins";
import BMIGauge from "@/components/BMIGauge";
import { formatHeightDual, formatWeightDual, calculateAge } from "@shared/units";
import { ProPermissionsCard } from "@/components/ProPermissionsCard";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { shouldUsePediatricBMI, calculatePediatricBMI } from "@shared/pediatricBmi";
import { useProClientPermissions } from "@/lib/permissions";
import type { ProgressPhotoPose } from "@shared/supabase-types";
import { apiRequest } from "@/lib/queryClient";
import { useProClientWater, useProClientWaterHistory } from "@/lib/pro-water";
import { formatVolumeShort, getVolumeUnitFromSystem } from "@shared/units";
import { Progress } from "@/components/ui/progress";

interface ProgressPhotoWithUrl {
  id: string;
  user_id: string;
  photo_path: string;
  pose: ProgressPhotoPose;
  is_flexed: boolean;
  captured_at: string;
  notes: string | null;
  created_at: string;
  signedUrl: string | null;
}

function AssignmentCard({ 
  assignment,
  onUpdateStatus,
  onCancel,
  isUpdating,
  isCancelling,
}: { 
  assignment: RoutineAssignment;
  onUpdateStatus: (id: string, status: 'active' | 'paused' | 'completed') => void;
  onCancel: (id: string) => void;
  isUpdating: boolean;
  isCancelling: boolean;
}) {
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  const routineName = assignment.routine_version?.blueprint?.name || "Unknown Programme";
  const sessionsPerWeek = assignment.routine_version?.blueprint?.sessions_per_week;

  return (
    <div 
      className="p-4 border rounded-lg space-y-3"
      data-testid={`card-assignment-${assignment.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
            <p className="font-medium" data-testid={`text-assignment-name-${assignment.id}`}>
              {routineName}
            </p>
          </div>
          {assignment.notes && (
            <p className="text-sm text-muted-foreground">
              {assignment.notes}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {assignment.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Start: {format(new Date(assignment.start_date), "MMM d, yyyy")}
              </span>
            )}
            {assignment.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                End: {format(new Date(assignment.end_date), "MMM d, yyyy")}
              </span>
            )}
            <span>
              Assigned: {format(new Date(assignment.created_at), "MMM d, yyyy")}
            </span>
          </div>
        </div>
        <Badge className={statusColors[assignment.status] || statusColors.cancelled}>
          {assignment.status}
        </Badge>
      </div>
      
      {assignment.status !== 'cancelled' && assignment.status !== 'completed' && (
        <div className="flex flex-wrap gap-2">
          {assignment.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateStatus(assignment.id, 'paused')}
              disabled={isUpdating}
              data-testid={`button-pause-${assignment.id}`}
            >
              <Pause className="w-3 h-3 mr-1" />
              Pause
            </Button>
          )}
          {assignment.status === 'paused' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateStatus(assignment.id, 'active')}
              disabled={isUpdating}
              data-testid={`button-resume-${assignment.id}`}
            >
              <Play className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(assignment.id, 'completed')}
            disabled={isUpdating}
            data-testid={`button-complete-${assignment.id}`}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(assignment.id)}
            disabled={isCancelling}
            className="text-destructive hover:text-destructive"
            data-testid={`button-cancel-${assignment.id}`}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

const logFoodFormSchema = z.object({
  foodName: z.string().min(1, "Food name is required"),
  servingDescription: z.string().min(1, "Serving description is required"),
  servings: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Servings must be a positive number" }
  ),
  calories: z.string().refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) >= 0,
    { message: "Calories must be a non-negative number" }
  ),
  protein: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    { message: "Protein must be a non-negative number" }
  ),
  carbs: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    { message: "Carbs must be a non-negative number" }
  ),
  fat: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    { message: "Fat must be a non-negative number" }
  ),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

type LogFoodFormValues = z.infer<typeof logFoodFormSchema>;

const rolePermissions: Record<ProfessionalRoleType, { food: boolean; workouts: boolean; weight: boolean; programmes: boolean }> = {
  nutritionist: { food: true, workouts: false, weight: true, programmes: false },
  trainer: { food: false, workouts: true, weight: true, programmes: true },
  coach: { food: true, workouts: true, weight: true, programmes: true },
};

export default function ProClientView() {
  const { clientId } = useParams<{ clientId: string }>();
  const { user, professionalProfile } = useSupabaseAuth();
  const { toast } = useToast();
  const { exerciseWeight } = useUnitPreferences();
  const [showLogFoodModal, setShowLogFoodModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNutritionTargetsModal, setShowNutritionTargetsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [nutritionPeriod, setNutritionPeriod] = useState<7 | 14 | 30>(7);
  const [showNutritionDetails, setShowNutritionDetails] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [expandedCheckInId, setExpandedCheckInId] = useState<string | null>(null);

  const form = useForm<LogFoodFormValues>({
    resolver: zodResolver(logFoodFormSchema),
    defaultValues: {
      foodName: "",
      servingDescription: "1 serving",
      servings: "1",
      calories: "0",
      protein: "0",
      carbs: "0",
      fat: "0",
      mealType: "snack",
    },
  });

  const { data: relationship, isLoading: relationshipLoading } = useQuery({
    queryKey: ["pro-relationship", user?.id, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_client_relationships")
        .select("*")
        .eq("professional_id", user!.id)
        .eq("client_id", clientId)
        .eq("status", "active")
        .single();
      
      if (error) throw error;
      return data as Relationship;
    },
    enabled: !!user && !!clientId,
  });

  const { data: clientProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["pro-client-profile", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", clientId)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!clientId,
  });

  const permissions = relationship ? rolePermissions[relationship.role_type] : null;

  const defaultTab = permissions?.programmes ? "programmes" 
    : permissions?.food ? "food" 
    : permissions?.workouts ? "workouts" 
    : permissions?.weight ? "weight" 
    : "programmes";
  
  const currentTab = activeTab || defaultTab;

  const { data: foodLogs, refetch: refetchFoodLogs } = useQuery({
    queryKey: ["pro-client-food", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_logs")
        .select("*, logged_by:profiles!food_logs_logged_by_user_id_fkey(display_name)")
        .eq("user_id", clientId)
        .order("logged_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as (FoodLog & { logged_by: { display_name: string } | null })[];
    },
    enabled: !!clientId && !!permissions?.food,
  });

  const { data: workouts } = useQuery({
    queryKey: ["pro-client-workouts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*, logged_by:profiles!workout_sessions_logged_by_user_id_fkey(display_name)")
        .eq("user_id", clientId)
        .order("logged_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as (WorkoutSession & { logged_by: { display_name: string } | null })[];
    },
    enabled: !!clientId && !!permissions?.workouts,
  });

  // Fetch workout sets for recent sessions
  const recentSessionIds = useMemo(() => {
    return workouts?.slice(0, 5).map(w => w.id) || [];
  }, [workouts]);

  const { data: workoutSets } = useQuery({
    queryKey: ["pro-client-workout-sets", clientId, recentSessionIds],
    queryFn: async () => {
      if (recentSessionIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("workout_sets")
        .select("*")
        .in("session_id", recentSessionIds)
        .order("set_number", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!permissions?.workouts && recentSessionIds.length > 0,
  });

  // Group sets by session and exercise
  const workoutsWithSets = useMemo(() => {
    if (!workouts || !workoutSets) return workouts || [];
    
    return workouts.slice(0, 5).map(session => {
      const sessionSets = workoutSets.filter(s => s.session_id === session.id);
      
      // Group sets by exercise name
      const exerciseMap = new Map<string, typeof workoutSets>();
      sessionSets.forEach(set => {
        if (!exerciseMap.has(set.exercise_name)) {
          exerciseMap.set(set.exercise_name, []);
        }
        exerciseMap.get(set.exercise_name)!.push(set);
      });

      return {
        ...session,
        exerciseSummary: Array.from(exerciseMap.entries()).map(([name, sets]) => ({
          name,
          sets: sets.sort((a, b) => a.set_number - b.set_number),
          totalSets: sets.length,
          bestWeight: Math.max(...sets.map(s => s.weight || 0)),
          totalReps: sets.reduce((sum, s) => sum + s.reps, 0),
        })),
      };
    });
  }, [workouts, workoutSets]);

  const { data: weighIns } = useQuery({
    queryKey: ["pro-client-weight", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_ins")
        .select("*")
        .eq("user_id", clientId)
        .order("logged_at", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as WeighIn[];
    },
    enabled: !!clientId && !!permissions?.weight,
  });

  const { data: clientPermissions } = useProClientPermissions(clientId);
  const hasPhotosPermission = clientPermissions?.granted_permissions?.includes('view_progress_photos') ?? false;
  const hasNutritionTargetsPermission = clientPermissions?.granted_permissions?.includes('set_nutrition_targets') ?? false;

  const { data: progressPhotos, isLoading: photosLoading } = useQuery<ProgressPhotoWithUrl[]>({
    queryKey: ["/api/pro/clients", clientId, "progress-photos"],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/clients/${clientId}/progress-photos?limit=6`);
      return res.json();
    },
    enabled: !!clientId && hasPhotosPermission,
  });

  type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number; count: number };
  const { data: todayNutrition, isLoading: nutritionLoading } = useQuery<NutritionTotals>({
    queryKey: ["/api/pro/clients", clientId, "nutrition", "today"],
    enabled: !!clientId && !!permissions?.food,
  });

  // Water intake data for client (gated by view_nutrition permission)
  const hasNutritionPermission = clientPermissions?.granted_permissions?.includes('view_nutrition') ?? false;
  const { data: clientWater, isLoading: waterLoading } = useProClientWater(
    hasNutritionPermission ? clientId : undefined
  );
  const { data: waterHistory } = useProClientWaterHistory(
    hasNutritionPermission ? clientId : undefined,
    7
  );
  
  // Get client's preferred unit system for water display
  const clientVolumeUnit = getVolumeUnitFromSystem(clientProfile?.preferred_unit_system || "metric");

  // Fetch food logs for selected period and calculate averages
  const { data: periodFoodLogs } = useQuery({
    queryKey: ["pro-client-food-period", clientId, nutritionPeriod],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - nutritionPeriod);
      startDate.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("food_logs")
        .select("id, logged_at, calories, protein, carbs, fat, food_name, meal_type")
        .eq("user_id", clientId)
        .gte("logged_at", startDate.toISOString())
        .order("logged_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!permissions?.food,
  });

  // Calculate nutrition averages for the period
  const nutritionAverages = useMemo(() => {
    if (!periodFoodLogs || periodFoodLogs.length === 0) {
      return null;
    }

    // Group logs by day
    const logsByDay = new Map<string, typeof periodFoodLogs>();
    periodFoodLogs.forEach(log => {
      const dayKey = format(new Date(log.logged_at), "yyyy-MM-dd");
      if (!logsByDay.has(dayKey)) {
        logsByDay.set(dayKey, []);
      }
      logsByDay.get(dayKey)!.push(log);
    });

    const daysWithData = logsByDay.size;
    const totalCalories = periodFoodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
    const totalProtein = periodFoodLogs.reduce((sum, log) => sum + (log.protein || 0), 0);
    const totalCarbs = periodFoodLogs.reduce((sum, log) => sum + (log.carbs || 0), 0);
    const totalFat = periodFoodLogs.reduce((sum, log) => sum + (log.fat || 0), 0);

    return {
      daysWithData,
      totalEntries: periodFoodLogs.length,
      avgCalories: Math.round(totalCalories / daysWithData),
      avgProtein: Math.round(totalProtein / daysWithData),
      avgCarbs: Math.round(totalCarbs / daysWithData),
      avgFat: Math.round(totalFat / daysWithData),
      dailyBreakdown: Array.from(logsByDay.entries()).map(([date, logs]) => ({
        date,
        calories: logs.reduce((sum, l) => sum + (l.calories || 0), 0),
        protein: logs.reduce((sum, l) => sum + (l.protein || 0), 0),
        carbs: logs.reduce((sum, l) => sum + (l.carbs || 0), 0),
        fat: logs.reduce((sum, l) => sum + (l.fat || 0), 0),
        entries: logs.length,
      })).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [periodFoodLogs]);

  const { data: assignments, isLoading: assignmentsLoading } = useClientAssignments(
    permissions?.programmes ? clientId : undefined
  );

  const { data: allCheckInAssignments } = useProCheckInAssignments();
  const clientCheckInAssignment = allCheckInAssignments?.find(
    (a) => a.client_id === clientId && a.is_active
  );

  const { data: clientCheckInSubmissions } = useProCheckInSubmissions({
    clientId: clientId,
    limit: 5,
  });

  const latestSubmission = clientCheckInSubmissions?.[0];
  const pendingSubmissions = clientCheckInSubmissions?.filter(
    (s) => s.status === 'scheduled' || s.status === 'in_progress'
  );
  const submittedCheckIns = clientCheckInSubmissions?.filter(
    (s) => s.status === 'submitted'
  ) || [];

  // Fetch details for expanded check-in
  const { data: expandedCheckInDetails, isLoading: expandedDetailsLoading } = useProCheckInSubmission(expandedCheckInId || undefined);

  const updateAssignmentMutation = useUpdateProAssignment();
  const cancelAssignmentMutation = useCancelProAssignment();

  const handleUpdateAssignmentStatus = async (assignmentId: string, status: 'active' | 'paused' | 'completed') => {
    try {
      await updateAssignmentMutation.mutateAsync({
        assignmentId,
        clientId,
        updates: { status },
      });
      toast({
        title: "Assignment Updated",
        description: `Programme status changed to ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update the assignment.",
        variant: "destructive",
      });
    }
  };

  const handleCancelAssignment = async (assignmentId: string) => {
    try {
      await cancelAssignmentMutation.mutateAsync({ assignmentId, clientId });
      toast({
        title: "Assignment Cancelled",
        description: "The programme assignment has been cancelled.",
      });
    } catch (error: any) {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Could not cancel the assignment.",
        variant: "destructive",
      });
    }
  };

  const logFoodMutation = useMutation({
    mutationFn: async (data: LogFoodFormValues) => {
      const { error } = await supabase
        .from("food_logs")
        .insert({
          user_id: clientId,
          logged_by_user_id: user!.id,
          food_name: data.foodName,
          serving_description: data.servingDescription,
          servings: parseFloat(data.servings),
          calories: parseInt(data.calories),
          protein: parseFloat(data.protein),
          carbs: parseFloat(data.carbs),
          fat: parseFloat(data.fat),
          meal_type: data.mealType,
          logged_at: new Date().toISOString(),
        } as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Food Logged",
        description: `Successfully logged food for ${clientProfile?.display_name || "client"}.`,
      });
      setShowLogFoodModal(false);
      form.reset();
      refetchFoodLogs();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log food",
        variant: "destructive",
      });
    },
  });

  const handleLogFood = (data: LogFoodFormValues) => {
    logFoodMutation.mutate(data);
  };

  const isLoading = relationshipLoading || profileLoading;

  // All hooks must be called before any conditional returns
  const latestWeight = weighIns?.[0];
  const previousWeight = weighIns?.[1];
  const weightChange = latestWeight && previousWeight 
    ? latestWeight.weight_kg - previousWeight.weight_kg 
    : null;

  // Calculate BMI and determine if pediatric mode should be used
  const clientAge = clientProfile?.birthdate ? calculateAge(clientProfile.birthdate) : null;
  const usePediatricMode = clientProfile?.birthdate ? shouldUsePediatricBMI(clientProfile.birthdate) : false;
  const isUnder2 = clientAge !== null && clientAge < 2;
  
  // Calculate BMI value
  const bmiValue = useMemo(() => {
    if (!latestWeight?.weight_kg || !clientProfile?.height_cm) return null;
    const heightM = clientProfile.height_cm / 100;
    return latestWeight.weight_kg / (heightM * heightM);
  }, [latestWeight?.weight_kg, clientProfile?.height_cm]);

  // Calculate pediatric BMI percentile for youth clients
  const pediatricBMIResult = useMemo(() => {
    if (!usePediatricMode || !clientProfile?.birthdate || !latestWeight?.weight_kg || !clientProfile?.height_cm) {
      return null;
    }
    return calculatePediatricBMI(
      latestWeight.weight_kg,
      clientProfile.height_cm,
      clientProfile.birthdate,
      clientProfile.gender
    );
  }, [usePediatricMode, clientProfile?.birthdate, latestWeight?.weight_kg, clientProfile?.height_cm, clientProfile?.gender]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!relationship) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              You don't have an active relationship with this client.
            </p>
            <Link href="/pro">
              <Button className="mt-4">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get BMI category color
  const getBMICategoryColor = (category: string) => {
    switch (category) {
      case "Underweight": return "text-blue-600 dark:text-blue-400";
      case "Healthy Weight": return "text-green-600 dark:text-green-400";
      case "Overweight": return "text-yellow-600 dark:text-yellow-400";
      case "Obese":
      case "Class 1 Obesity":
      case "Class 2 Obesity":
      case "Class 3 Obesity":
        return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  // Get adult BMI category
  const getAdultBMICategory = (bmi: number) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Healthy Weight";
    if (bmi < 30) return "Overweight";
    if (bmi < 35) return "Class 1 Obesity";
    if (bmi < 40) return "Class 2 Obesity";
    return "Class 3 Obesity";
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <Link href="/pro" className="inline-flex items-center text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle data-testid="text-client-name">
                {clientProfile?.display_name || "Client"}
              </CardTitle>
              <CardDescription>
                Your {relationship.role_type} client since{" "}
                {relationship.accepted_at 
                  ? format(new Date(relationship.accepted_at), "MMMM d, yyyy")
                  : "recently"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <MessageButton 
                userId={clientId!}
                userName={clientProfile?.display_name || undefined}
              />
              <Badge>{relationship.role_type}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* BMI Section - Large number + gauge */}
          {permissions?.weight && bmiValue !== null && clientProfile?.height_cm ? (
            <div className="space-y-3">
              {/* Large BMI Number */}
              <div className="text-center">
                <p className="text-4xl font-bold" data-testid="text-bmi-value">
                  {bmiValue.toFixed(1)}
                </p>
                {usePediatricMode && pediatricBMIResult?.isSupportedAge ? (
                  <p className={`text-sm font-medium ${getBMICategoryColor(pediatricBMIResult.category)}`} data-testid="text-bmi-category">
                    {pediatricBMIResult.percentile.toFixed(0)}th percentile - {pediatricBMIResult.category}
                  </p>
                ) : !isUnder2 ? (
                  <p className={`text-sm font-medium ${getBMICategoryColor(getAdultBMICategory(bmiValue))}`} data-testid="text-bmi-category">
                    {getAdultBMICategory(bmiValue)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-bmi-category">
                    BMI (under 2 years)
                  </p>
                )}
              </div>
              
              {/* BMI Gauge - age appropriate */}
              {!isUnder2 && (
                <div className="flex justify-center">
                  {usePediatricMode && pediatricBMIResult?.isSupportedAge ? (
                    <BMIGauge
                      currentWeightKg={latestWeight!.weight_kg}
                      heightCm={clientProfile.height_cm}
                      isMetric={true}
                      mode="pediatric"
                      percentile={pediatricBMIResult.percentile}
                    />
                  ) : (
                    <BMIGauge
                      currentWeightKg={latestWeight!.weight_kg}
                      heightCm={clientProfile.height_cm}
                      isMetric={true}
                      mode="adult"
                    />
                  )}
                </div>
              )}
            </div>
          ) : permissions?.weight && !clientProfile?.height_cm ? (
            <div className="text-center p-4 bg-muted/50 rounded-lg border border-dashed">
              <Scale className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Height not set - BMI unavailable</p>
            </div>
          ) : permissions?.weight && !latestWeight ? (
            <div className="text-center p-4 bg-muted/50 rounded-lg border border-dashed">
              <Scale className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No weigh-ins recorded</p>
            </div>
          ) : null}

          {/* Compact Vitals Row */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground border-t pt-4" data-testid="vitals-row">
            {clientProfile?.height_cm && (
              <div className="flex items-center gap-1.5" data-testid="vital-height">
                <Ruler className="w-4 h-4" />
                <span>{formatHeightDual(clientProfile.height_cm).imperial}</span>
                <span className="text-xs">({formatHeightDual(clientProfile.height_cm).metric})</span>
              </div>
            )}
            
            {clientProfile?.birthdate && (
              <div className="flex items-center gap-1.5" data-testid="vital-age">
                <Cake className="w-4 h-4" />
                <span>{clientAge} years</span>
              </div>
            )}
            
            {clientProfile?.gender && (
              <div className="flex items-center gap-1.5" data-testid="vital-sex">
                {clientProfile.gender === 'M' ? (
                  <span className="text-blue-500 font-medium" title="Male">♂</span>
                ) : clientProfile.gender === 'F' ? (
                  <span className="text-pink-500 font-medium" title="Female">♀</span>
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="sr-only">{clientProfile.gender === 'M' ? 'Male' : 'Female'}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weight History Card */}
      {permissions?.weight && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Weight History
              </div>
              {weighIns && weighIns.length > 4 && (
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("weight")} data-testid="button-weight-see-all">
                  See All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weighIns && weighIns.length > 0 ? (
              <div className="space-y-2">
                {weighIns.slice(0, 4).map((weighIn, index) => {
                  const prevWeighIn = weighIns[index + 1];
                  const change = prevWeighIn ? weighIn.weight_kg - prevWeighIn.weight_kg : null;
                  const isFirst = index === 0;
                  
                  return (
                    <div 
                      key={weighIn.id}
                      className={`flex items-center justify-between py-2 ${index > 0 ? 'border-t' : ''}`}
                      data-testid={`weighin-row-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground w-24">
                          {format(new Date(weighIn.logged_at), "MMM d, yyyy")}
                        </div>
                        <div className="font-medium">
                          {formatWeightDual(weighIn.weight_kg).imperial}
                          <span className="text-sm text-muted-foreground ml-1">
                            ({formatWeightDual(weighIn.weight_kg).metric})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isFirst && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                        {change !== null && change !== 0 && (
                          <div className={`flex items-center gap-1 text-sm ${change > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                            {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{change > 0 ? '+' : ''}{change.toFixed(1)} kg</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Scale className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No weigh-ins recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {permissions?.food && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                Nutrition
              </div>
              <div className="flex items-center gap-2">
                {/* Set Targets Button */}
                {hasNutritionTargetsPermission && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNutritionTargetsModal(true)}
                    data-testid="button-set-nutrition-targets"
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Set Targets
                  </Button>
                )}
                {/* Period Selector */}
                <div className="flex gap-1" data-testid="nutrition-period-selector">
                  {[7, 14, 30].map((days) => (
                    <Button
                      key={days}
                      variant={nutritionPeriod === days ? "default" : "outline"}
                      size="sm"
                      className="text-xs px-2"
                      onClick={() => setNutritionPeriod(days as 7 | 14 | 30)}
                      data-testid={`button-nutrition-${days}d`}
                    >
                      {days}d
                    </Button>
                  ))}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Today's Summary */}
            {todayNutrition && todayNutrition.count > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Today</span>
                  <span className="text-xs text-muted-foreground">{todayNutrition.count} {todayNutrition.count === 1 ? 'entry' : 'entries'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold" data-testid="text-today-calories">
                    {todayNutrition.calories.toLocaleString()} kcal
                  </span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-blue-600 dark:text-blue-400" data-testid="text-today-protein">P: {Math.round(todayNutrition.protein)}g</span>
                    <span className="text-amber-600 dark:text-amber-400" data-testid="text-today-carbs">C: {Math.round(todayNutrition.carbs)}g</span>
                    <span className="text-rose-600 dark:text-rose-400" data-testid="text-today-fat">F: {Math.round(todayNutrition.fat)}g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Period Averages */}
            {nutritionAverages ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Daily average over {nutritionAverages.daysWithData} {nutritionAverages.daysWithData === 1 ? 'day' : 'days'}</span>
                  <span>{nutritionAverages.totalEntries} total entries</span>
                </div>
                
                <div className="text-center">
                  <p className="text-4xl font-bold" data-testid="text-avg-calories">
                    {nutritionAverages.avgCalories.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">avg kcal/day</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400" data-testid="text-avg-protein">
                      {nutritionAverages.avgProtein}g
                    </p>
                    <p className="text-xs text-muted-foreground">Protein</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                    <p className="text-lg font-semibold text-amber-600 dark:text-amber-400" data-testid="text-avg-carbs">
                      {nutritionAverages.avgCarbs}g
                    </p>
                    <p className="text-xs text-muted-foreground">Carbs</p>
                  </div>
                  <div className="text-center p-3 bg-rose-50 dark:bg-rose-950 rounded-lg">
                    <p className="text-lg font-semibold text-rose-600 dark:text-rose-400" data-testid="text-avg-fat">
                      {nutritionAverages.avgFat}g
                    </p>
                    <p className="text-xs text-muted-foreground">Fat</p>
                  </div>
                </div>

                {/* Expandable Daily Breakdown */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNutritionDetails(!showNutritionDetails)}
                    className="w-full flex items-center justify-center gap-2 text-muted-foreground"
                    data-testid="button-nutrition-details"
                  >
                    {showNutritionDetails ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide daily breakdown
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show daily breakdown
                      </>
                    )}
                  </Button>
                  
                  {showNutritionDetails && (
                    <div className="mt-3 space-y-2" data-testid="nutrition-daily-breakdown">
                      {nutritionAverages.dailyBreakdown.slice(0, 7).map((day) => (
                        <div 
                          key={day.date}
                          className="flex items-center justify-between py-2 border-b last:border-b-0 text-sm"
                        >
                          <span className="text-muted-foreground w-20">
                            {format(new Date(day.date), "EEE, MMM d")}
                          </span>
                          <span className="font-medium">{day.calories.toLocaleString()} kcal</span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="text-blue-600 dark:text-blue-400">P:{day.protein}g</span>
                            <span className="text-amber-600 dark:text-amber-400">C:{day.carbs}g</span>
                            <span className="text-rose-600 dark:text-rose-400">F:{day.fat}g</span>
                          </div>
                        </div>
                      ))}
                      {nutritionAverages.dailyBreakdown.length > 7 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{nutritionAverages.dailyBreakdown.length - 7} more days
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : !todayNutrition || todayNutrition.count === 0 ? (
              <div className="text-center py-6">
                <Apple className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No food logged in the last {nutritionPeriod} days</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Hydration Card - gated by view_nutrition permission */}
      {hasNutritionPermission && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className="w-5 h-5 text-blue-500" />
              Hydration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {waterLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : clientWater ? (
              (() => {
                const todayPct = clientWater.target_ml > 0 
                  ? Math.min(Math.round((clientWater.total_ml / clientWater.target_ml) * 100), 100) 
                  : 0;
                return (
              <div className="space-y-4">
                {/* Today's Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Today</span>
                    <span className="text-sm font-medium" data-testid="text-water-progress">
                      {formatVolumeShort(clientWater.total_ml, clientVolumeUnit)} / {formatVolumeShort(clientWater.target_ml, clientVolumeUnit)}
                    </span>
                  </div>
                  <Progress 
                    value={todayPct} 
                    className="h-2"
                    data-testid="progress-water"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{todayPct}% of daily goal</span>
                    {clientWater.total_ml >= clientWater.target_ml && clientWater.target_ml > 0 && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Goal reached
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 7-Day History */}
                {waterHistory && waterHistory.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Last 7 Days</p>
                    <div className="space-y-1.5">
                      {waterHistory.slice(0, 7).map((day) => {
                        const percentage = day.target_ml > 0 
                          ? Math.min(Math.round((day.total_ml / day.target_ml) * 100), 100) 
                          : 0;
                        const isToday = day.date === format(new Date(), "yyyy-MM-dd");
                        
                        return (
                          <div 
                            key={day.date}
                            className={`flex items-center gap-3 text-sm ${isToday ? 'font-medium' : ''}`}
                            data-testid={`water-history-${day.date}`}
                          >
                            <span className="w-16 text-muted-foreground">
                              {isToday ? 'Today' : format(new Date(day.date), "EEE")}
                            </span>
                            <div className="flex-1">
                              <Progress 
                                value={Math.min(percentage, 100)} 
                                className="h-1.5"
                              />
                            </div>
                            <span className={`w-14 text-right ${percentage >= 100 ? 'text-green-600' : ''}`}>
                              {formatVolumeShort(day.total_ml, clientVolumeUnit)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
                );
              })()
            ) : (
              <div className="text-center py-6">
                <Droplets className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No water intake logged yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Workouts Card */}
      {permissions?.workouts && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                Recent Workouts
              </div>
              {workouts && workouts.length > 5 && (
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("workouts")} data-testid="button-workouts-see-all">
                  See All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workoutsWithSets && workoutsWithSets.length > 0 ? (
              <div className="space-y-4">
                {workoutsWithSets.map((workout: any, index: number) => (
                  <div 
                    key={workout.id}
                    className={`space-y-2 ${index > 0 ? 'pt-4 border-t' : ''}`}
                    data-testid={`workout-row-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{workout.name || workout.routine_name || 'Workout'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(workout.logged_at), "EEE, MMM d")}
                          {workout.duration_minutes && ` • ${workout.duration_minutes} min`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {workout.workout_type}
                      </Badge>
                    </div>
                    
                    {/* Exercise Details */}
                    {workout.exerciseSummary && workout.exerciseSummary.length > 0 ? (
                      <div className="pl-3 border-l-2 border-muted space-y-1.5">
                        {workout.exerciseSummary.slice(0, 4).map((exercise: any, exIndex: number) => (
                          <div key={exIndex} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate max-w-[150px]">{exercise.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">
                                {exercise.totalSets}×{Math.round(exercise.totalReps / exercise.totalSets)}
                              </span>
                              {exercise.bestWeight > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  @ {exerciseWeight.format(exercise.bestWeight)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {workout.exerciseSummary.length > 4 && (
                          <p className="text-xs text-muted-foreground">
                            +{workout.exerciseSummary.length - 4} more exercises
                          </p>
                        )}
                      </div>
                    ) : workout.exercises ? (
                      <div className="pl-3 border-l-2 border-muted text-sm text-muted-foreground">
                        {typeof workout.exercises === 'string' 
                          ? workout.exercises 
                          : Array.isArray(workout.exercises) 
                            ? `${(workout.exercises as any[]).length} exercises`
                            : 'Workout logged'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Dumbbell className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No workouts logged yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ProPermissionsCard 
        clientId={clientId!} 
        clientName={clientProfile?.display_name || undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-client-checkins">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarCheck className="w-5 h-5" />
                Check-Ins
              </CardTitle>
              {pendingSubmissions && pendingSubmissions.length > 0 && (
                <Badge 
                  variant={
                    pendingSubmissions[0].status === 'in_progress' 
                      ? 'secondary' 
                      : new Date() > new Date(pendingSubmissions[0].due_at)
                        ? 'destructive'
                        : 'outline'
                  }
                  data-testid="badge-checkin-status"
                >
                  {pendingSubmissions[0].status === 'in_progress' 
                    ? 'In Progress' 
                    : new Date() > new Date(pendingSubmissions[0].due_at)
                      ? 'Overdue'
                      : 'Scheduled'}
                </Badge>
              )}
            </div>
            {clientCheckInAssignment && (
              <CardDescription>
                {clientCheckInAssignment.template?.name || 'Check-in'} · {clientCheckInAssignment.cadence}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!clientCheckInAssignment ? (
              <div className="text-center py-4">
                <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">No check-in assigned</p>
                <Link href="/pro/check-ins/templates">
                  <Button variant="outline" size="sm" data-testid="button-assign-checkin-grid">
                    <Plus className="w-4 h-4 mr-1" />
                    Assign
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Next Due */}
                {pendingSubmissions && pendingSubmissions.length > 0 && (
                  <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Next Due</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(pendingSubmissions[0].due_at), "EEE, MMM d")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Missed Warning */}
                {clientCheckInSubmissions?.some(s => s.status === 'missed') && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-xs text-red-600 dark:text-red-400">Missed check-in</p>
                  </div>
                )}

                {/* Submitted Check-ins List */}
                {submittedCheckIns.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Submissions</p>
                    {submittedCheckIns.map((submission) => {
                      const isExpanded = expandedCheckInId === submission.id;
                      const metrics = submission.metrics_snapshot;
                      
                      return (
                        <div 
                          key={submission.id}
                          className="border rounded-lg overflow-hidden"
                          data-testid={`checkin-submission-${submission.id}`}
                        >
                          {/* Submission Header - Clickable */}
                          <div
                            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                            onClick={() => setExpandedCheckInId(isExpanded ? null : submission.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setExpandedCheckInId(isExpanded ? null : submission.id)}
                            data-testid={`button-expand-checkin-${submission.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                              <div>
                                <p className="text-sm font-medium">
                                  Week of {format(new Date(submission.week_start), "MMM d")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Submitted {submission.submitted_at 
                                    ? format(new Date(submission.submitted_at), "MMM d")
                                    : 'Unknown'}
                                </p>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t p-3 bg-muted/30 space-y-4">
                              {/* Loading State */}
                              {expandedDetailsLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                  <span className="ml-2 text-sm text-muted-foreground">Loading details...</span>
                                </div>
                              )}

                              {/* Metrics Summary */}
                              {metrics && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly Metrics</p>
                                    {/* Data Reliability Badge */}
                                    <Badge 
                                      variant={metrics.reliability === 'high' ? 'default' : metrics.reliability === 'medium' ? 'secondary' : 'outline'}
                                      className="text-xs"
                                    >
                                      {metrics.reliability} reliability
                                    </Badge>
                                  </div>
                                  
                                  {/* Weight */}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                      <Scale className="w-4 h-4 text-muted-foreground" />
                                      Weight
                                    </span>
                                    <span className="font-medium">
                                      {metrics.weight.current_kg !== null 
                                        ? `${metrics.weight.current_kg.toFixed(1)} kg`
                                        : '—'}
                                      {metrics.weight.delta_kg !== null && metrics.weight.delta_kg !== 0 && (
                                        <span className={`ml-1 text-xs ${metrics.weight.delta_kg > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                          ({metrics.weight.delta_kg > 0 ? '+' : ''}{metrics.weight.delta_kg.toFixed(1)})
                                        </span>
                                      )}
                                    </span>
                                  </div>

                                  {/* Training */}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                      <Dumbbell className="w-4 h-4 text-muted-foreground" />
                                      Training
                                    </span>
                                    <span className="font-medium">
                                      {metrics.training.sessions_completed}/{metrics.training.sessions_assigned} sessions
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        ({metrics.training.adherence_percent}%)
                                      </span>
                                    </span>
                                  </div>

                                  {/* Nutrition */}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                      <Utensils className="w-4 h-4 text-muted-foreground" />
                                      Nutrition
                                    </span>
                                    <span className="font-medium">
                                      {metrics.nutrition.avg_calories !== null 
                                        ? `${Math.round(metrics.nutrition.avg_calories)} kcal/day`
                                        : '—'}
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        ({metrics.nutrition.days_logged} days logged)
                                      </span>
                                    </span>
                                  </div>

                                  {/* Fasting */}
                                  {metrics.fasting.fasts_completed > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                        Fasting
                                      </span>
                                      <span className="font-medium">
                                        {metrics.fasting.fasts_completed} fasts
                                        {metrics.fasting.avg_duration_hours !== null && (
                                          <span className="ml-1 text-xs text-muted-foreground">
                                            (avg {metrics.fasting.avg_duration_hours.toFixed(1)}h)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}

                                  {/* Cardio */}
                                  {metrics.cardio.total_minutes > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                        Cardio
                                      </span>
                                      <span className="font-medium">
                                        {metrics.cardio.total_minutes} min
                                      </span>
                                    </div>
                                  )}

                                  {/* Missing Data Warning */}
                                  {metrics.missing_data && metrics.missing_data.length > 0 && (
                                    <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs">
                                      <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                                      <span className="text-amber-700 dark:text-amber-300">
                                        Missing: {metrics.missing_data.join(', ')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* AI Analysis Summary */}
                              {!expandedDetailsLoading && expandedCheckInDetails?.analysis && expandedCheckInDetails.analysis.status === 'completed' && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Analysis</p>
                                  
                                  {/* Summary */}
                                  {expandedCheckInDetails.analysis.summary && (
                                    <p className="text-sm">{expandedCheckInDetails.analysis.summary}</p>
                                  )}

                                  {/* Wins */}
                                  {expandedCheckInDetails.analysis.wins && expandedCheckInDetails.analysis.wins.length > 0 && (
                                    <div className="space-y-1">
                                      {expandedCheckInDetails.analysis.wins.map((win, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
                                          <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                          <span>{win}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Flags */}
                                  {expandedCheckInDetails.analysis.flags && expandedCheckInDetails.analysis.flags.length > 0 && (
                                    <div className="space-y-1">
                                      {expandedCheckInDetails.analysis.flags.slice(0, 2).map((flag, i) => (
                                        <div 
                                          key={i} 
                                          className={`flex items-start gap-2 text-sm ${
                                            flag.severity === 'high' ? 'text-red-600 dark:text-red-400' : 
                                            flag.severity === 'medium' ? 'text-amber-600 dark:text-amber-400' : 
                                            'text-muted-foreground'
                                          }`}
                                        >
                                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                          <span>{flag.issue}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Client Answers */}
                              {!expandedDetailsLoading && expandedCheckInDetails?.answers && expandedCheckInDetails.answers.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Responses</p>
                                  {expandedCheckInDetails.questions.map((question) => {
                                    const answer = expandedCheckInDetails.answers.find(a => a.question_id === question.id);
                                    if (!answer?.answer_value) return null;
                                    return (
                                      <div key={question.id} className="text-sm">
                                        <p className="text-muted-foreground">{question.question_text}</p>
                                        <p className="font-medium mt-0.5">{answer.answer_value}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Client Notes */}
                              {submission.client_notes && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Notes</p>
                                  <p className="text-sm">{submission.client_notes}</p>
                                </div>
                              )}

                              {/* View Full Button */}
                              <Link href={`/pro/check-ins/submissions/${submission.id}`}>
                                <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-full-${submission.id}`}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  View Full Report
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : !pendingSubmissions?.length && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No submissions yet
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={!hasPhotosPermission ? "opacity-60" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="w-5 h-5" />
              Progress Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasPhotosPermission ? (
              <div className="text-center py-6">
                <Camera className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-muted-foreground">Permission Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Request access to view progress photos
                </p>
              </div>
            ) : photosLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : progressPhotos && progressPhotos.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {progressPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate"
                      data-testid={`pro-photo-${photo.id}`}
                      onClick={() => setSelectedPhotoId(photo.id)}
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={`${photo.pose}${photo.is_flexed ? " (Flexed)" : ""}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-[10px] text-white/90 capitalize">
                          {photo.pose}{photo.is_flexed ? " (F)" : ""}
                        </p>
                        <p className="text-[9px] text-white/70">
                          {format(new Date(photo.captured_at), "MMM d")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Camera className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-muted-foreground">No Photos Yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Client hasn't uploaded any progress photos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs 
        value={currentTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${[permissions?.programmes, permissions?.food, permissions?.workouts, permissions?.weight].filter(Boolean).length}, 1fr)` }}>
          {permissions?.programmes && (
            <TabsTrigger value="programmes" data-testid="tab-programmes">
              <ClipboardList className="w-4 h-4 mr-2" />
              Programmes
            </TabsTrigger>
          )}
          {permissions?.food && (
            <TabsTrigger value="food" data-testid="tab-food">
              <Apple className="w-4 h-4 mr-2" />
              Food Logs
            </TabsTrigger>
          )}
          {permissions?.workouts && (
            <TabsTrigger value="workouts" data-testid="tab-workouts">
              <Dumbbell className="w-4 h-4 mr-2" />
              Workouts
            </TabsTrigger>
          )}
          {permissions?.weight && (
            <TabsTrigger value="weight" data-testid="tab-weight">
              <Scale className="w-4 h-4 mr-2" />
              Weight
            </TabsTrigger>
          )}
        </TabsList>

        {permissions?.programmes && (
          <TabsContent value="programmes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Assigned Programmes</CardTitle>
                <Button 
                  onClick={() => setShowAssignModal(true)}
                  data-testid="button-assign-programme"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Programme
                </Button>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !assignments?.length ? (
                  <div className="text-center py-8">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      No programmes assigned yet.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => setShowAssignModal(true)}
                      data-testid="button-assign-first-programme"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Assign First Programme
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onUpdateStatus={handleUpdateAssignmentStatus}
                        onCancel={handleCancelAssignment}
                        isUpdating={updateAssignmentMutation.isPending}
                        isCancelling={cancelAssignmentMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {permissions?.food && (
          <TabsContent value="food">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Recent Food Logs</CardTitle>
                <Button 
                  onClick={() => setShowLogFoodModal(true)}
                  data-testid="button-log-food-for-client"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Food
                </Button>
              </CardHeader>
              <CardContent>
                {!foodLogs?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    No food logs recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {foodLogs.map((log) => {
                      const loggedByPro = log.logged_by_user_id !== log.user_id;
                      return (
                        <div 
                          key={log.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`card-food-${log.id}`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{log.food_name}</p>
                              {loggedByPro && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {log.logged_by?.display_name || "Pro"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {log.serving_description} • {log.servings} serving{log.servings !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{log.calories} cal</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(log.logged_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {permissions?.workouts && (
          <TabsContent value="workouts">
            <Card>
              <CardHeader>
                <CardTitle>Recent Workouts</CardTitle>
              </CardHeader>
              <CardContent>
                {!workouts?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    No workouts recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {workouts.map((workout) => {
                      const loggedByPro = workout.logged_by_user_id !== workout.user_id;
                      return (
                        <div 
                          key={workout.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`card-workout-${workout.id}`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{workout.name}</p>
                              {loggedByPro && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {workout.logged_by?.display_name || "Pro"}
                                </Badge>
                              )}
                            </div>
                            {workout.duration_minutes && (
                              <p className="text-sm text-muted-foreground">
                                {workout.duration_minutes} minutes
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(workout.logged_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {permissions?.weight && (
          <TabsContent value="weight">
            <Card>
              <CardHeader>
                <CardTitle>Weight History</CardTitle>
              </CardHeader>
              <CardContent>
                {!weighIns?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    No weigh-ins recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {weighIns.map((weighIn, index) => {
                      const prevWeight = weighIns[index + 1]?.weight_kg;
                      const change = prevWeight ? weighIn.weight_kg - prevWeight : null;
                      
                      return (
                        <div 
                          key={weighIn.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`card-weighin-${weighIn.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Scale className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{weighIn.weight_kg.toFixed(1)} kg</p>
                              {weighIn.notes && (
                                <p className="text-sm text-muted-foreground">{weighIn.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {change !== null && (
                              <div className="flex items-center gap-1">
                                {change > 0 ? (
                                  <TrendingUp className="w-4 h-4 text-red-500" />
                                ) : change < 0 ? (
                                  <TrendingDown className="w-4 h-4 text-green-500" />
                                ) : null}
                                <span className={`text-sm ${
                                  change > 0 ? "text-red-500" : change < 0 ? "text-green-500" : ""
                                }`}>
                                  {change > 0 ? "+" : ""}{change.toFixed(1)}
                                </span>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(weighIn.logged_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showLogFoodModal} onOpenChange={setShowLogFoodModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Food for {clientProfile?.display_name || "Client"}</DialogTitle>
            <DialogDescription>
              This entry will be attributed to you as the professional who logged it.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogFood)} className="space-y-4">
              <FormField
                control={form.control}
                name="foodName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Grilled Chicken Breast"
                        data-testid="input-pro-food-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="servingDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serving Size</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 1 medium"
                          data-testid="input-pro-serving-desc"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="servings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servings</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="1"
                          data-testid="input-pro-servings"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="mealType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-pro-meal-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                        <SelectItem value="snack">Snack</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="calories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calories</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          data-testid="input-pro-calories"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="protein"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protein (g)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          data-testid="input-pro-protein"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="carbs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carbs (g)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          data-testid="input-pro-carbs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fat (g)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          data-testid="input-pro-fat"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLogFoodModal(false)}
                  data-testid="button-cancel-log-food"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={logFoodMutation.isPending}
                  data-testid="button-submit-log-food"
                >
                  {logFoodMutation.isPending ? "Logging..." : "Log Food"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AssignProgrammeModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        clientId={clientId || ""}
        clientName={clientProfile?.display_name || undefined}
      />

      <SetNutritionTargetsModal
        open={showNutritionTargetsModal}
        onClose={() => setShowNutritionTargetsModal(false)}
        clientId={clientId || ""}
        clientName={clientProfile?.display_name || "Client"}
      />

      <Dialog open={!!selectedPhotoId} onOpenChange={(open) => !open && setSelectedPhotoId(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Progress Photo</DialogTitle>
            <DialogDescription>Full-size progress photo view</DialogDescription>
          </DialogHeader>
          {(() => {
            const selectedPhoto = progressPhotos?.find(p => p.id === selectedPhotoId);
            if (!selectedPhoto) return null;
            return (
              <>
                <div className="relative bg-black flex items-center justify-center min-h-[60vh] max-h-[80vh]">
                  {selectedPhoto.signedUrl ? (
                    <img
                      src={selectedPhoto.signedUrl}
                      alt={`${selectedPhoto.pose}${selectedPhoto.is_flexed ? " (Flexed)" : ""}`}
                      className="max-w-full max-h-[80vh] object-contain"
                      data-testid="lightbox-image"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <Camera className="w-16 h-16 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="p-4 bg-background">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">
                        {selectedPhoto.pose} {selectedPhoto.is_flexed ? "(Flexed)" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedPhoto.captured_at), "MMMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedPhotoId(null)}
                      data-testid="button-close-lightbox"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
