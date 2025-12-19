import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import WeightChart from "@/components/WeightChart";
import CalorieAdherenceChart from "@/components/CalorieAdherenceChart";
import FastingHoursChart from "@/components/FastingHoursChart";
import BMIGauge from "@/components/BMIGauge";
import MoreSheet from "@/components/MoreSheet";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fetchJson } from "@/lib/queryClient";
import { Loader2, Clock, CheckCircle2, Dumbbell, Trophy, HelpCircle, ChevronDown } from "lucide-react";
import type { WeighIn as WeighInType } from "@shared/schema";
import { calculatePediatricBMI, calculateAgeInYears, shouldUsePediatricBMI } from "@shared/pediatricBmi";
import { 
  getWeighIns, 
  getFoodLogs, 
  getUserProfile, 
  getFasts, 
  getFastingAnalytics,
  getWorkoutSessionsWithSets,
  type UserProfile,
  type Fast,
  type FastingAnalytics as FastingAnalyticsType,
  type WorkoutSession,
  type WorkoutSet,
  type WorkoutSessionWithSets,
} from "@/lib/supabase-data";

function getIntensityLabel(intensity: number | null | undefined): string | null {
  if (intensity == null) return null;
  const labels: Record<number, string> = {
    1: "Easy",
    2: "Light",
    3: "Moderate",
    4: "Vigorous",
    5: "Intense",
  };
  return labels[intensity] || null;
}

export default function Analytics() {
  const [weightRange, setWeightRange] = useState<"7" | "30" | "90">("7");
  
  const { data: user } = useQuery<UserProfile | null>({
    queryKey: ["user-profile"],
    queryFn: () => getUserProfile(),
  });

  const { data: weighIns = [], isLoading: weighInsLoading } = useQuery<WeighInType[]>({
    queryKey: ["weigh-ins"],
    queryFn: () => getWeighIns(90),
  });

  const { data: foodLogsData = [], isLoading: logsLoading } = useQuery({
    queryKey: ["food-logs-history"],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const result = await getFoodLogs(startDate, endDate);
      return result ?? [];
    },
  });

  const { data: fastingAnalytics, isLoading: fastingAnalyticsLoading } = useQuery<FastingAnalyticsType>({
    queryKey: ["fasting-analytics"],
    queryFn: () => getFastingAnalytics(),
  });

  const { data: fastHistory = [], isLoading: fastHistoryLoading } = useQuery<Fast[]>({
    queryKey: ["fasts-history"],
    queryFn: () => getFasts(30),
  });

  const { data: workoutSessions = [], isLoading: workoutSessionsLoading } = useQuery<WorkoutSessionWithSets[]>({
    queryKey: ["workout-sessions-history"],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      return getWorkoutSessionsWithSets(startDate, endDate, 100);
    },
  });

  const isMetric = user?.preferredUnitSystem === "metric";
  const showBmiTape = user?.showBmiTape ?? true;
  
  const weightData = weighIns
    .slice()
    .reverse()
    .map((wi: any) => ({
      dateObj: new Date(wi.date),
      date: new Date(wi.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      weight: isMetric 
        ? parseFloat(wi.weightKg.toFixed(1))
        : parseFloat((wi.weightKg * 2.20462).toFixed(1)),
    }));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const calorieData = last7Days.map((date) => {
    const dateStr = date.toISOString().split("T")[0];
    const dayLogs = foodLogsData.filter((log: any) => {
      const logDate = log.timestamp instanceof Date 
        ? log.timestamp.toISOString().split("T")[0]
        : String(log.timestamp).split("T")[0];
      return logDate === dateStr;
    });
    const eaten = dayLogs.reduce((sum: number, log: any) => sum + log.calories, 0);

    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      eaten,
      target: user?.dailyCalorieTarget || 2100,
    };
  });

  const avgCalories = Math.round(
    calorieData.reduce((sum, d) => sum + d.eaten, 0) / calorieData.length
  );

  const rangeNumber = Number(weightRange);
  
  const calculateWeightChange = () => {
    if (weightData.length < 2) return 0;
    
    const mostRecent = weightData[weightData.length - 1];
    const targetDate = new Date(mostRecent.dateObj);
    targetDate.setDate(targetDate.getDate() - rangeNumber);
    
    let comparisonEntry = weightData[0];
    for (let i = weightData.length - 2; i >= 0; i--) {
      if (weightData[i].dateObj <= targetDate) {
        comparisonEntry = weightData[i];
        break;
      }
    }
    
    return mostRecent.weight - comparisonEntry.weight;
  };
  
  const weightChange = calculateWeightChange();

  // Calculate BMI
  const currentWeightKg = user?.currentWeightKg || 0;
  const heightCm = user?.heightCm || 0;
  const heightM = heightCm / 100;
  const bmi = heightM > 0 ? currentWeightKg / (heightM * heightM) : 0;

  // User demographics
  const userBirthdate = user?.birthdate;
  const userGender = user?.gender; // "M" or "F"
  const userAge = userBirthdate ? calculateAgeInYears(userBirthdate) : null;
  
  // Determine BMI display mode
  // Age 2-18: Pediatric percentile mode
  // Age 19+: Adult BMI mode
  // Under 2: BMI text only (no gauge)
  const usePediatricMode = userBirthdate ? shouldUsePediatricBMI(userBirthdate) : false;
  const isUnder2 = userAge !== null && userAge < 2;
  
  // Calculate pediatric BMI percentile for youth users
  const pediatricBMIResult = useMemo(() => {
    if (!usePediatricMode || !userBirthdate) {
      return null;
    }
    // calculatePediatricBMI now validates gender, height, and weight internally
    return calculatePediatricBMI(currentWeightKg, heightCm, userBirthdate, userGender);
  }, [usePediatricMode, userBirthdate, currentWeightKg, heightCm, userGender]);

  // CDC chart links based on gender
  const cdcChartLink = userGender === "M" 
    ? "https://www.cdc.gov/growthcharts/data/set1clinical/cj41c023.pdf"
    : "https://www.cdc.gov/growthcharts/data/set1clinical/cj41c024.pdf";

  const getBMIColor = (bmi: number) => {
    if (bmi >= 40) return "text-red-700 dark:text-red-500";
    if (bmi >= 35) return "text-red-600 dark:text-red-400";
    if (bmi >= 30) return "text-orange-600 dark:text-orange-400";
    if (bmi >= 25) return "text-amber-600 dark:text-amber-500";
    if (bmi >= 18.5) return "text-chart-1";
    return "text-blue-500";
  };

  const getBMIBorderColor = (bmi: number) => {
    if (bmi >= 40) return "border-red-700 dark:border-red-500";
    if (bmi >= 35) return "border-red-600 dark:border-red-400";
    if (bmi >= 30) return "border-orange-600 dark:border-orange-400";
    if (bmi >= 25) return "border-amber-600 dark:border-amber-500";
    if (bmi >= 18.5) return "border-chart-1";
    return "border-blue-500";
  };

  const getBMILabel = (bmi: number) => {
    if (bmi >= 40) return "Class 3 Obesity";
    if (bmi >= 35) return "Class 2 Obesity";
    if (bmi >= 30) return "Class 1 Obesity";
    if (bmi >= 25) return "Overweight";
    if (bmi >= 18.5) return "Healthy Weight";
    if (bmi > 0) return "Underweight";
    return "";
  };

  // Pediatric BMI color helpers based on category
  const getPediatricColor = (category: string) => {
    switch (category) {
      case "Obese": return "text-red-600 dark:text-red-400";
      case "Overweight": return "text-yellow-600 dark:text-yellow-500";
      case "Healthy Weight": return "text-chart-1";
      case "Underweight": return "text-blue-500";
      default: return "text-foreground";
    }
  };

  const getPediatricBorderColor = (category: string) => {
    switch (category) {
      case "Obese": return "border-red-600 dark:border-red-400";
      case "Overweight": return "border-yellow-600 dark:border-yellow-500";
      case "Healthy Weight": return "border-chart-1";
      case "Underweight": return "border-blue-500";
      default: return "border-border";
    }
  };

  // Determine if we should show pediatric percentile mode (valid result with supported age)
  const showPediatricPercentile = usePediatricMode && pediatricBMIResult !== null && pediatricBMIResult.isSupportedAge;
  
  // Determine if we should show the "unsupported age" message
  const showUnsupportedAgeMessage = isUnder2 || (usePediatricMode && (pediatricBMIResult === null || !pediatricBMIResult.isSupportedAge));
  
  // Compute BMI card border color
  const bmiCardBorderColor = showPediatricPercentile 
    ? getPediatricBorderColor(pediatricBMIResult!.category) 
    : showUnsupportedAgeMessage 
      ? "border-border" 
      : getBMIBorderColor(bmi);

  const fastingChartData = Array.isArray(fastHistory)
    ? fastHistory
        .filter((fast: any) => fast.status === "ended" && fast.actualEndTime)
        .slice(0, 14)
        .reverse()
        .map((fast: any) => {
          const startTime = new Date(fast.startTime);
          const actualEndTime = new Date(fast.actualEndTime);
          const hours = (actualEndTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          return {
            date: startTime.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            hours,
          };
        })
    : [];

  // Workout analytics calculations
  const last7DaysWorkouts = workoutSessions.filter((session) => {
    const sessionDate = new Date(session.loggedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return sessionDate >= sevenDaysAgo;
  });

  const totalSets = workoutSessions.reduce((sum, session) => sum + (session.sets?.length || 0), 0);
  const totalReps = workoutSessions.reduce((sum, session) => {
    return sum + (session.sets?.reduce((s, set) => s + set.reps, 0) || 0);
  }, 0);

  const exerciseFrequency = workoutSessions
    .flatMap((session) => session.sets || [])
    .reduce((acc, set) => {
      acc[set.exerciseName] = (acc[set.exerciseName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topExercises = Object.entries(exerciseFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const isLoading = weighInsLoading || logsLoading || fastingAnalyticsLoading || fastHistoryLoading || workoutSessionsLoading;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <MoreSheet />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="nutrition" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3" data-testid="tabs-analytics">
              <TabsTrigger value="nutrition" data-testid="tab-nutrition">Nutrition</TabsTrigger>
              <TabsTrigger value="fasting" data-testid="tab-fasting">Fasting</TabsTrigger>
              <TabsTrigger value="workouts" data-testid="tab-workouts">Workouts</TabsTrigger>
            </TabsList>

            <TabsContent value="nutrition" className="space-y-6">
              {bmi > 0 && (
                <Card className={`p-6 border-2 ${bmiCardBorderColor} relative`}>
                  <a
                    href="https://www.cdc.gov/bmi/about/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-bmi-info"
                    aria-label="Learn more about BMI from CDC"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </a>
                  
                  {showPediatricPercentile && pediatricBMIResult ? (
                    // Youth BMI display (age 2-18) with percentile
                    <div data-testid="bmi-youth-section">
                      <div className="text-center mb-4">
                        <div className="text-sm text-muted-foreground mb-2">Body Mass Index (BMI)</div>
                        <div className={`text-6xl font-bold tabular-nums mb-1 ${getPediatricColor(pediatricBMIResult.category)}`} data-testid="text-bmi">
                          {pediatricBMIResult.bmi.toFixed(1)}
                        </div>
                        <div className={`text-2xl font-semibold mb-1 ${getPediatricColor(pediatricBMIResult.category)}`} data-testid="text-bmi-percentile">
                          {pediatricBMIResult.percentile.toFixed(0)}th percentile
                        </div>
                        <div className={`text-lg font-medium ${getPediatricColor(pediatricBMIResult.category)}`} data-testid="text-bmi-category">
                          {pediatricBMIResult.category}
                        </div>
                      </div>
                      
                      {showBmiTape && currentWeightKg > 0 && heightCm > 0 && (
                        <div className="mb-4">
                          <BMIGauge
                            currentWeightKg={currentWeightKg}
                            heightCm={heightCm}
                            isMetric={isMetric}
                            mode="pediatric"
                            percentile={pediatricBMIResult.percentile}
                          />
                        </div>
                      )}
                      
                      {(userGender === "M" || userGender === "F") && (
                        <a
                          href={cdcChartLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full mb-4 px-4 py-3 bg-muted text-foreground rounded-md text-center font-medium hover-elevate text-sm"
                          data-testid="link-cdc-chart"
                        >
                          View CDC Growth Chart ({userGender === "M" ? "Boys" : "Girls"})
                        </a>
                      )}
                    </div>
                  ) : isUnder2 ? (
                    // Under age 2: BMI text only with pediatrician guidance
                    <div data-testid="bmi-under2-section">
                      <div className="text-center mb-4">
                        <div className="text-sm text-muted-foreground mb-2">Body Mass Index (BMI)</div>
                        <div className="text-6xl font-bold tabular-nums mb-2 text-foreground" data-testid="text-bmi">
                          {bmi.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground text-center">
                        BMI percentiles are not available for children under age 2. Please consult your pediatrician for growth assessment.
                      </div>
                    </div>
                  ) : showUnsupportedAgeMessage ? (
                    // Ages 2-18 but missing data: BMI text with settings link
                    <div data-testid="bmi-missing-data-section">
                      <div className="text-center mb-4">
                        <div className="text-sm text-muted-foreground mb-2">Body Mass Index (BMI)</div>
                        <div className="text-6xl font-bold tabular-nums mb-2 text-foreground" data-testid="text-bmi">
                          {bmi.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground text-center mb-4">
                        BMI percentile could not be calculated. Please ensure your height, weight, and gender are set in your profile.
                      </div>
                      <a
                        href="/settings"
                        className="block w-full px-4 py-3 bg-primary text-primary-foreground rounded-md text-center font-medium hover-elevate text-sm"
                        data-testid="link-update-profile"
                      >
                        Update Profile Settings
                      </a>
                    </div>
                  ) : (
                    // Adult BMI display (age 20 and older)
                    <>
                      <div className="text-center mb-4">
                        <div className="text-sm text-muted-foreground mb-2">Body Mass Index (BMI)</div>
                        <div className={`text-6xl font-bold tabular-nums mb-2 ${getBMIColor(bmi)}`} data-testid="text-bmi">
                          {bmi.toFixed(1)}
                        </div>
                        <div className={`text-lg font-semibold ${getBMIColor(bmi)}`} data-testid="text-bmi-category">
                          {getBMILabel(bmi)}
                        </div>
                      </div>
                      {showBmiTape && currentWeightKg > 0 && heightCm > 0 && (
                        <BMIGauge
                          currentWeightKg={currentWeightKg}
                          heightCm={heightCm}
                          isMetric={isMetric}
                        />
                      )}
                    </>
                  )}
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-sm text-muted-foreground mb-1">7-Day Avg</div>
                  <div className="text-4xl font-bold tabular-nums" data-testid="text-avg-calories">
                    {avgCalories}
                  </div>
                  <div className="text-xs text-muted-foreground">cal/day</div>
                </Card>

                <Card className="p-4 text-center">
                  <div className="text-sm text-muted-foreground mb-1">Weight Change</div>
                  <div
                    className={`text-4xl font-bold tabular-nums ${
                      weightChange < 0 ? "text-chart-1" : "text-destructive"
                    }`}
                    data-testid="text-weight-change"
                  >
                    {weightChange > 0 ? "+" : ""}
                    {weightChange.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">{isMetric ? "kg" : "lbs"} ({weightRange} days)</div>
                </Card>
              </div>

              {weightData.length > 0 && (
                <WeightChart 
                  data={weightData} 
                  unit={isMetric ? "kg" : "lbs"} 
                  range={weightRange}
                  onRangeChange={setWeightRange}
                />
              )}
              <CalorieAdherenceChart data={calorieData} />
            </TabsContent>

            <TabsContent value="fasting" className="space-y-6">
              {fastingAnalytics && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 text-center">
                      <div className="text-sm text-muted-foreground mb-1">Total Fasts</div>
                      <div className="text-4xl font-bold tabular-nums" data-testid="text-total-fasts">
                        {fastingAnalytics.totalFasts}
                      </div>
                    </Card>

                    <Card className="p-4 text-center">
                      <div className="text-sm text-muted-foreground mb-1">Total Hours</div>
                      <div className="text-4xl font-bold tabular-nums text-chart-1" data-testid="text-total-hours">
                        {fastingAnalytics.totalFastingHours.toFixed(0)}h
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6">
                    <h3 className="text-sm font-medium mb-4">Fasting Stats</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Avg Duration</div>
                        <div className="text-2xl font-semibold tabular-nums" data-testid="text-avg-duration">
                          {fastingAnalytics.avgActualDurationHours.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Longest Fast</div>
                        <div className="text-2xl font-semibold tabular-nums flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-chart-1" />
                          {fastingAnalytics.longestFastHours.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Avg Planned</div>
                        <div className="text-2xl font-semibold tabular-nums">
                          {fastingAnalytics.avgPlannedDurationHours.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Avg vs Planned</div>
                        <div className="text-2xl font-semibold tabular-nums flex items-center gap-2">
                          {fastingAnalytics.avgPlannedDurationHours > 0 ? (
                            <>
                              {fastingAnalytics.avgActualDurationHours >= fastingAnalytics.avgPlannedDurationHours ? (
                                <CheckCircle2 className="w-5 h-5 text-chart-1" />
                              ) : (
                                <Clock className="w-5 h-5 text-muted-foreground" />
                              )}
                              {((fastingAnalytics.avgActualDurationHours / fastingAnalytics.avgPlannedDurationHours) * 100).toFixed(0)}%
                            </>
                          ) : (
                            <>-</>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {fastingChartData.length > 0 && (
                    <FastingHoursChart data={fastingChartData} />
                  )}
                </>
              )}

              {fastHistory.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-sm font-medium mb-4">Fasting History</h3>
                  <div className="space-y-4">
                    {fastHistory.slice(0, 10).map((fast: any) => {
                      const startTime = new Date(fast.startTime);
                      const endTime = new Date(fast.endTime);
                      const actualEndTime = fast.actualEndTime ? new Date(fast.actualEndTime) : null;
                      
                      const plannedDurationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                      const actualDurationHours = actualEndTime 
                        ? (actualEndTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
                        : 0;

                      return (
                        <div key={fast.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50" data-testid={`fast-${fast.id}`}>
                          <div className="flex-shrink-0">
                            {fast.status === "ended" && (
                              <CheckCircle2 className="w-5 h-5 text-chart-1" />
                            )}
                            {fast.status === "active" && (
                              <Clock className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {startTime.toLocaleDateString("en-US", { 
                                month: "short", 
                                day: "numeric",
                                year: "numeric"
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fast.status === "ended" && `${actualDurationHours.toFixed(1)}h / ${plannedDurationHours.toFixed(1)}h planned`}
                              {fast.status === "active" && `${plannedDurationHours.toFixed(1)}h planned`}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {fast.status === "ended" ? `${actualDurationHours.toFixed(1)}h` : "In progress"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {fastHistory.length === 0 && (
                <Card className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Fasting Data Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Start your first fast to see analytics here
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="workouts" className="space-y-6">
              {workoutSessions.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 text-center">
                      <div className="text-sm text-muted-foreground mb-1">Last 7 Days</div>
                      <div className="text-4xl font-bold tabular-nums text-chart-1" data-testid="text-last-7-days">
                        {last7DaysWorkouts.length}
                      </div>
                      <div className="text-xs text-muted-foreground">workouts</div>
                    </Card>

                    <Card className="p-4 text-center">
                      <div className="text-sm text-muted-foreground mb-1">Total Volume</div>
                      <div className="text-4xl font-bold tabular-nums" data-testid="text-total-sets">
                        {totalSets}
                      </div>
                      <div className="text-xs text-muted-foreground">sets (30d)</div>
                    </Card>
                  </div>

                  {topExercises.length > 0 && (
                    <Card className="p-6">
                      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        Top Exercises (30 Days)
                      </h3>
                      <div className="space-y-3">
                        {topExercises.map(([exercise, count]) => (
                          <div key={exercise} className="flex items-center gap-3" data-testid={`exercise-${exercise}`}>
                            <Dumbbell className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{exercise}</div>
                            </div>
                            <div className="text-sm font-semibold tabular-nums">{count} sets</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card className="p-6">
                    <h3 className="text-sm font-medium mb-4">Recent Workouts</h3>
                    <div className="space-y-2">
                      {workoutSessions.slice(0, 10).map((session) => {
                        const isCardio = session.workoutType === "cardio";
                        const exerciseGroups = session.sets?.reduce((acc, set) => {
                          if (!acc[set.exerciseName]) {
                            acc[set.exerciseName] = [];
                          }
                          acc[set.exerciseName].push(set);
                          return acc;
                        }, {} as Record<string, WorkoutSet[]>) || {};

                        const displayName = session.workoutType.replace(/_/g, " ");
                        const intensityLabel = getIntensityLabel((session as any).intensity);
                        const caloriesBurned = (session as any).caloriesBurned;
                        const activityName = (session as any).activityName;

                        return (
                          <Collapsible key={session.id}>
                            <CollapsibleTrigger className="w-full group" data-testid={`workout-${session.id}`}>
                              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer">
                                <Dumbbell className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="text-sm font-medium capitalize">{displayName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(session.loggedAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                    {session.durationMinutes && ` • ${session.durationMinutes}m`}
                                  </div>
                                </div>
                                {isCardio ? (
                                  caloriesBurned && (
                                    <div className="text-xs text-muted-foreground">
                                      {Math.round(caloriesBurned)} cal
                                    </div>
                                  )
                                ) : (
                                  session.sets && session.sets.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {session.sets.length} sets
                                    </div>
                                  )
                                )}
                                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 ml-9 space-y-1 pb-2">
                                {isCardio ? (
                                  <>
                                    {activityName && (
                                      <div className="text-sm font-medium">{activityName}</div>
                                    )}
                                    {caloriesBurned && (
                                      <div className="text-xs text-muted-foreground">
                                        {Math.round(caloriesBurned)} calories burned
                                      </div>
                                    )}
                                    {intensityLabel && (
                                      <div className="text-xs text-muted-foreground">
                                        {intensityLabel} intensity
                                      </div>
                                    )}
                                    {session.notes && (
                                      <div className="text-xs text-muted-foreground italic">
                                        "{session.notes}"
                                      </div>
                                    )}
                                    {!activityName && !caloriesBurned && !intensityLabel && !session.notes && (
                                      <div className="text-xs text-muted-foreground italic">No additional details</div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {Object.keys(exerciseGroups).length === 0 ? (
                                      <div className="text-xs text-muted-foreground italic">No sets logged</div>
                                    ) : (
                                      Object.entries(exerciseGroups).map(([exerciseName, sets]) => (
                                        <div key={exerciseName} className="space-y-1 mb-2">
                                          <div className="text-sm font-medium">{exerciseName}</div>
                                          <div className="space-y-0.5">
                                            {sets
                                              .sort((a, b) => a.setNumber - b.setNumber)
                                              .map((set) => (
                                                <div
                                                  key={set.id}
                                                  className="text-xs text-muted-foreground pl-3"
                                                  data-testid={`set-${set.id}`}
                                                >
                                                  Set {set.setNumber}: {set.reps} reps
                                                  {set.weight !== null ? ` @ ${set.weight}kg` : " (bodyweight)"}
                                                </div>
                                              ))}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="p-12 text-center">
                  <Dumbbell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Workout Data Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Start tracking workouts to see analytics here
                  </p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />
    </div>
  );
}
