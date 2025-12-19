import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { insertWorkoutSessionSchema } from "@shared/schema";
import { 
  getCardioActivities, 
  createWorkoutSession,
  getUserCustomActivities,
  createUserCustomActivity,
  type CardioActivity,
  type UserCustomActivity,
} from "@/lib/supabase-data";
import { z } from "zod";
import { format } from "date-fns";
import { Check, ChevronsUpDown, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertWorkoutSessionSchema.omit({ userId: true }).extend({
  activityName: z.string().min(1, "Activity is required"),
  intensity: z.number().int().min(1).max(5).default(3),
  caloriesBurned: z.number().int().nonnegative().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface QuickLogModalProps {
  open: boolean;
  onClose: () => void;
}

const INTENSITY_LABELS = [
  { value: 1, label: "Easy", multiplier: 0.7 },
  { value: 2, label: "Light", multiplier: 0.85 },
  { value: 3, label: "Moderate", multiplier: 1.0 },
  { value: 4, label: "Vigorous", multiplier: 1.15 },
  { value: 5, label: "Intense", multiplier: 1.3 },
];

export default function QuickLogModal({ open, onClose }: QuickLogModalProps) {
  const { toast } = useToast();
  const { profile } = useSupabaseAuth();
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [selectedMET, setSelectedMET] = useState<number | null>(null);
  const [isEstimatingMET, setIsEstimatingMET] = useState(false);
  const [manualCaloriesOverride, setManualCaloriesOverride] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workoutType: "cardio",
      date: format(new Date(), "yyyy-MM-dd"),
      durationMinutes: 30,
      activityName: "",
      intensity: 3,
      caloriesBurned: undefined,
      notes: undefined,
    },
  });

  const watchedDuration = form.watch("durationMinutes");
  const watchedIntensity = form.watch("intensity");
  const watchedActivityName = form.watch("activityName");

  // Fetch standard cardio activities from Supabase
  const { data: cardioData } = useQuery<{
    activities: CardioActivity[];
    grouped: Record<string, CardioActivity[]>;
  }>({
    queryKey: ["supabase", "cardio-activities"],
    queryFn: getCardioActivities,
    enabled: open,
  });

  // Fetch user's custom activities from Supabase
  const { data: customActivities } = useQuery<UserCustomActivity[]>({
    queryKey: ["user-custom-activities"],
    queryFn: getUserCustomActivities,
    enabled: open,
  });

  // Calculate calories based on MET formula
  const calculateCalories = (met: number, durationMinutes: number, intensity: number) => {
    const weightKg = profile?.current_weight_kg || 70;
    const intensityMultiplier = INTENSITY_LABELS.find(i => i.value === intensity)?.multiplier || 1.0;
    const durationHours = durationMinutes / 60;
    return Math.round(met * weightKg * durationHours * intensityMultiplier);
  };

  // Update calories when MET, duration, or intensity changes
  useEffect(() => {
    if (selectedMET && !manualCaloriesOverride) {
      const calculatedCalories = calculateCalories(
        selectedMET,
        watchedDuration || 30,
        watchedIntensity || 3
      );
      form.setValue("caloriesBurned", calculatedCalories);
    }
  }, [selectedMET, watchedDuration, watchedIntensity, manualCaloriesOverride, form, profile]);

  // Find MET when activity name changes
  useEffect(() => {
    if (!watchedActivityName) {
      setSelectedMET(null);
      return;
    }

    // Check if it's a standard activity
    const standardActivity = cardioData?.activities.find(
      a => a.name.toLowerCase() === watchedActivityName.toLowerCase()
    );
    if (standardActivity) {
      setSelectedMET(standardActivity.baseMET);
      return;
    }

    // Check if it's a custom activity
    const customActivity = customActivities?.find(
      a => a.activityName.toLowerCase() === watchedActivityName.toLowerCase()
    );
    if (customActivity) {
      setSelectedMET(customActivity.estimatedMET);
      return;
    }

    // It's a new custom activity - MET will be estimated on submit if needed
    setSelectedMET(null);
  }, [watchedActivityName, cardioData, customActivities]);

  // Filter activities based on search
  const filteredActivities = useMemo(() => {
    const searchLower = searchValue.toLowerCase();
    const grouped: Record<string, CardioActivity[]> = {};
    
    if (cardioData?.activities) {
      cardioData.activities.forEach(activity => {
        if (activity.name.toLowerCase().includes(searchLower)) {
          if (!grouped[activity.category]) {
            grouped[activity.category] = [];
          }
          grouped[activity.category].push(activity);
        }
      });
    }
    
    return grouped;
  }, [cardioData, searchValue]);

  const filteredCustomActivities = useMemo(() => {
    const searchLower = searchValue.toLowerCase();
    return customActivities?.filter(
      a => a.activityName.toLowerCase().includes(searchLower)
    ) || [];
  }, [customActivities, searchValue]);

  const estimateMET = async (activityName: string) => {
    try {
      setIsEstimatingMET(true);
      const res = await apiRequest("POST", "/api/estimate-activity-met", { activityName });
      const data = await res.json();
      return data.estimatedMET as number;
    } catch (error) {
      console.error("Failed to estimate MET:", error);
      return 5.0; // Default MET for moderate activity
    } finally {
      setIsEstimatingMET(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // If no MET selected and it's a custom activity, estimate it first
      let finalCalories = data.caloriesBurned;
      let estimatedMET: number | null = null;
      if (!selectedMET && data.activityName && !manualCaloriesOverride) {
        estimatedMET = await estimateMET(data.activityName);
        finalCalories = calculateCalories(
          estimatedMET,
          data.durationMinutes || 30,
          data.intensity || 3
        );
        
        // Save custom activity to Supabase for future use
        try {
          await createUserCustomActivity({
            activityName: data.activityName,
            estimatedMet: estimatedMET,
          });
        } catch (e) {
          // Ignore duplicate errors
          console.log('Custom activity may already exist');
        }
      }

      const session = await createWorkoutSession({
        workoutType: 'cardio',
        durationMinutes: data.durationMinutes,
        activityName: data.activityName,
        intensity: data.intensity,
        caloriesBurned: finalCalories,
        notes: data.notes,
        loggedAt: data.date, // Support backdating
      });
      
      return { session, date: data.date };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workout-sessions", data.date] });
      queryClient.invalidateQueries({ queryKey: ["workout-sessions-history"] });
      queryClient.invalidateQueries({ queryKey: ["user-custom-activities"] });
      toast({ description: "Workout logged successfully" });
      handleClose();
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to log workout" });
    },
  });

  const handleClose = () => {
    form.reset();
    setSelectedMET(null);
    setSearchValue("");
    setManualCaloriesOverride(false);
    onClose();
  };

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const selectActivity = (activityName: string, met: number) => {
    form.setValue("activityName", activityName);
    setSelectedMET(met);
    setSearchValue("");
    setActivityOpen(false);
    setManualCaloriesOverride(false);
  };

  const selectCustomInput = () => {
    if (searchValue.trim()) {
      form.setValue("activityName", searchValue.trim());
      setSelectedMET(null);
      setActivityOpen(false);
      setManualCaloriesOverride(false);
    }
  };

  const intensityLabel = INTENSITY_LABELS.find(i => i.value === watchedIntensity)?.label || "Moderate";
  const currentCalories = form.watch("caloriesBurned");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Cardio Workout</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="activityName"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Activity</FormLabel>
                  <Popover open={activityOpen} onOpenChange={setActivityOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={activityOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-activity-select"
                        >
                          {field.value || "Select or type an activity..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search activities..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                          data-testid="input-activity-search"
                        />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>
                            {searchValue.trim() ? (
                              <button
                                type="button"
                                className="w-full p-2 text-left hover:bg-accent cursor-pointer"
                                onClick={selectCustomInput}
                                data-testid="button-custom-activity"
                              >
                                Use "{searchValue}" as custom activity
                              </button>
                            ) : (
                              "No activities found."
                            )}
                          </CommandEmpty>

                          {filteredCustomActivities.length > 0 && (
                            <CommandGroup heading="Your Recent Activities">
                              {filteredCustomActivities.map((activity) => (
                                <CommandItem
                                  key={activity.id}
                                  value={activity.activityName}
                                  onSelect={() => selectActivity(activity.activityName, activity.estimatedMET)}
                                  data-testid={`activity-custom-${activity.id}`}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === activity.activityName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {activity.activityName}
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    MET {activity.estimatedMET.toFixed(1)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}

                          {Object.entries(filteredActivities).map(([category, activities]) => (
                            <CommandGroup key={category} heading={category}>
                              {activities.map((activity) => (
                                <CommandItem
                                  key={activity.id}
                                  value={activity.name}
                                  onSelect={() => selectActivity(activity.name, activity.baseMET)}
                                  data-testid={`activity-${activity.id}`}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === activity.name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {activity.name}
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    MET {activity.baseMET.toFixed(1)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      value={field.value || ""}
                      onChange={(e) => {
                        field.onChange(parseInt(e.target.value) || 1);
                        setManualCaloriesOverride(false);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      data-testid="input-duration"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="intensity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Intensity: <span className="font-semibold text-primary">{intensityLabel}</span>
                  </FormLabel>
                  <FormControl>
                    <div className="px-1 pt-2">
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[field.value || 3]}
                        onValueChange={(values) => {
                          field.onChange(values[0]);
                          setManualCaloriesOverride(false);
                        }}
                        className="w-full"
                        data-testid="slider-intensity"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Easy</span>
                        <span>Light</span>
                        <span>Moderate</span>
                        <span>Vigorous</span>
                        <span>Intense</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caloriesBurned"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Calories Burned
                    {!manualCaloriesOverride && selectedMET && (
                      <span className="text-xs text-muted-foreground font-normal">(auto-calculated)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        field.onChange(isNaN(value) ? undefined : value);
                        setManualCaloriesOverride(true);
                      }}
                      placeholder={isEstimatingMET ? "Estimating..." : "Enter calories"}
                      data-testid="input-calories"
                    />
                  </FormControl>
                  {!selectedMET && watchedActivityName && !manualCaloriesOverride && (
                    <p className="text-xs text-muted-foreground">
                      Calories will be estimated when you save
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="How did it feel?"
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                data-testid="button-cancel-log"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending || isEstimatingMET}
                data-testid="button-save-log"
              >
                {createMutation.isPending || isEstimatingMET ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEstimatingMET ? "Estimating..." : "Logging..."}
                  </>
                ) : (
                  <>
                    <Flame className="mr-2 h-4 w-4" />
                    Log Workout
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
