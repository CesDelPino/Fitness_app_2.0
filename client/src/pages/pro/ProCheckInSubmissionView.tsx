import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Dumbbell, Utensils, Activity, Clock, AlertCircle, Sparkles, Loader2, AlertTriangle, CheckCircle2, Star, ChevronDown, ChevronUp, Scale, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useProCheckInSubmission, useAnalyzeCheckIn, useSubmissionDetails, type WeeklyMetrics, type SubmissionRawDetails } from "@/lib/pro-checkins";
import { useToast } from "@/hooks/use-toast";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";

function MetricCard({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: typeof Dumbbell;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function WeightMetric({ weight }: { weight: WeeklyMetrics['weight'] }) {
  const trendIcon = weight.trend_4_week === 'gaining' 
    ? TrendingUp 
    : weight.trend_4_week === 'losing' 
      ? TrendingDown 
      : Minus;

  const TrendIcon = trendIcon;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">
          {weight.current_kg?.toFixed(1) || "—"}
        </span>
        <span className="text-muted-foreground">kg</span>
        {weight.delta_kg !== null && (
          <Badge 
            variant={weight.delta_kg > 0 ? "secondary" : weight.delta_kg < 0 ? "outline" : "default"}
            className="ml-2"
          >
            {weight.delta_kg > 0 ? "+" : ""}{weight.delta_kg.toFixed(1)} kg
          </Badge>
        )}
      </div>
      {weight.trend_4_week && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <TrendIcon className="h-4 w-4" />
          <span className="capitalize">{weight.trend_4_week} trend (4 weeks)</span>
        </div>
      )}
    </div>
  );
}

function TrainingMetric({ training }: { training: WeeklyMetrics['training'] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{training.sessions_completed}</span>
        <span className="text-muted-foreground">/ {training.sessions_assigned} sessions</span>
      </div>
      <Progress value={training.adherence_percent} className="h-2" />
      <p className="text-sm text-muted-foreground">
        {training.adherence_percent}% adherence
      </p>
    </div>
  );
}

function NutritionMetric({ nutrition }: { nutrition: WeeklyMetrics['nutrition'] }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Avg Calories</p>
          <p className="text-lg font-semibold">
            {nutrition.avg_calories?.toLocaleString() || "—"}
            {nutrition.target_calories && (
              <span className="text-sm text-muted-foreground ml-1">
                / {nutrition.target_calories.toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Avg Protein</p>
          <p className="text-lg font-semibold">
            {nutrition.avg_protein_g || "—"}g
            {nutrition.target_protein_g && (
              <span className="text-sm text-muted-foreground ml-1">
                / {nutrition.target_protein_g}g
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {nutrition.days_logged} days logged this week
      </p>
    </div>
  );
}

function CardioMetric({ cardio }: { cardio: WeeklyMetrics['cardio'] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{cardio.total_minutes}</span>
        <span className="text-muted-foreground">minutes</span>
      </div>
      {cardio.activities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardio.activities.map((activity) => (
            <Badge key={activity} variant="outline" className="text-xs">
              {activity}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function FastingMetric({ fasting }: { fasting: WeeklyMetrics['fasting'] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{fasting.fasts_completed}</span>
        <span className="text-muted-foreground">fasts completed</span>
      </div>
      {fasting.avg_duration_hours !== null && (
        <p className="text-sm text-muted-foreground">
          Avg duration: {fasting.avg_duration_hours}h
        </p>
      )}
    </div>
  );
}

function RawDetailsPanel({ details, isLoading }: { details: SubmissionRawDetails | undefined; isLoading: boolean }) {
  const { exerciseWeight, cardioDistance } = useUnitPreferences();
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!details) {
    return <p className="text-muted-foreground text-center py-4">No detailed data available</p>;
  }

  const { weighIns, foodLogs, workoutSessions, cardioActivities, fasts } = details;

  const groupedFoodLogs = foodLogs.reduce((acc, log) => {
    const day = format(new Date(log.logged_at), "EEEE, MMM d");
    if (!acc[day]) acc[day] = [];
    acc[day].push(log);
    return acc;
  }, {} as Record<string, typeof foodLogs>);

  return (
    <div className="space-y-6">
      {weighIns.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Weight Entries</h4>
          </div>
          <div className="space-y-2">
            {weighIns.map((weigh) => (
              <div key={weigh.id} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">
                  {format(new Date(weigh.recorded_at), "EEEE, MMM d 'at' h:mm a")}
                </span>
                <span className="font-medium">{weigh.weight_kg.toFixed(1)} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(groupedFoodLogs).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Utensils className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Food Log</h4>
          </div>
          <div className="space-y-4">
            {Object.entries(groupedFoodLogs).map(([day, logs]) => {
              const dayTotals = logs.reduce(
                (sum, log) => ({
                  calories: sum.calories + (log.calories || 0),
                  protein: sum.protein + (log.protein || 0),
                }),
                { calories: 0, protein: 0 }
              );

              return (
                <div key={day} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-2 bg-muted">
                    <span className="font-medium text-sm">{day}</span>
                    <div className="text-xs text-muted-foreground">
                      {dayTotals.calories} cal · {dayTotals.protein}g protein
                    </div>
                  </div>
                  <div className="divide-y">
                    {logs.map((log) => (
                      <div key={log.id} className="p-2 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{log.food_name}</span>
                          {log.meal_type && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {log.meal_type}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {log.calories && `${log.calories} cal`}
                          {log.protein && ` · ${log.protein}g P`}
                          {log.carbs && ` · ${log.carbs}g C`}
                          {log.fat && ` · ${log.fat}g F`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {workoutSessions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Workout Sessions</h4>
          </div>
          <div className="space-y-3">
            {workoutSessions.map((session) => (
              <div key={session.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-2 bg-muted">
                  <span className="font-medium text-sm">
                    {format(new Date(session.started_at), "EEEE, MMM d 'at' h:mm a")}
                  </span>
                  <Badge variant={session.completed_at ? "default" : "secondary"}>
                    {session.completed_at ? "Completed" : "Incomplete"}
                  </Badge>
                </div>
                {session.exercises.length > 0 && (
                  <div className="p-2 space-y-2">
                    {session.exercises.map((exercise, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{exercise.exercise_name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {exercise.sets.map((set, setIdx) => (
                            <Badge key={setIdx} variant="outline" className="text-xs">
                              {set.reps && `${set.reps} reps`}
                              {set.weight_kg && ` @ ${exerciseWeight.format(set.weight_kg)}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {session.notes && (
                  <div className="p-2 border-t text-sm text-muted-foreground">
                    Notes: {session.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cardioActivities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Cardio Activities</h4>
          </div>
          <div className="space-y-2">
            {cardioActivities.map((cardio) => (
              <div key={cardio.id} className="flex items-center justify-between p-2 bg-muted rounded">
                <div>
                  <span className="font-medium text-sm">{cardio.activity_type}</span>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(cardio.started_at), "EEEE, MMM d")}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {cardio.duration_minutes && <div>{cardio.duration_minutes} min</div>}
                  {cardio.distance_km && <div className="text-muted-foreground">{cardioDistance.format(cardio.distance_km)}</div>}
                  {cardio.calories_burned && <div className="text-muted-foreground">{cardio.calories_burned} cal</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fasts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Fasting Sessions</h4>
          </div>
          <div className="space-y-2">
            {fasts.map((fast) => {
              const startDate = new Date(fast.started_at);
              const endDate = fast.ended_at ? new Date(fast.ended_at) : null;
              const durationHours = endDate 
                ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10
                : null;

              return (
                <div key={fast.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-sm">
                      {format(startDate, "EEEE, MMM d 'at' h:mm a")}
                    </p>
                    {fast.target_hours && (
                      <p className="text-xs text-muted-foreground">Target: {fast.target_hours}h</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant={fast.status === "ended" ? "default" : "secondary"}>
                      {fast.status === "ended" 
                        ? durationHours 
                          ? `${durationHours}h` 
                          : "Completed"
                        : fast.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {weighIns.length === 0 && 
       Object.keys(groupedFoodLogs).length === 0 && 
       workoutSessions.length === 0 && 
       cardioActivities.length === 0 && 
       fasts.length === 0 && (
        <p className="text-muted-foreground text-center py-4">
          No detailed data recorded for this week
        </p>
      )}
    </div>
  );
}

export default function ProCheckInSubmissionView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, error } = useProCheckInSubmission(params.id);
  const analyzeMutation = useAnalyzeCheckIn();
  const { data: rawDetails, isLoading: detailsLoading } = useSubmissionDetails(params.id, showDetails);

  const handleAnalyze = async () => {
    if (!params.id) return;
    
    try {
      await analyzeMutation.mutateAsync(params.id);
      toast({
        title: "Analysis complete",
        description: "AI insights have been generated for this check-in.",
      });
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Could not analyze check-in.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Submission not found</h2>
          <p className="text-muted-foreground mb-4">
            This check-in submission may have been deleted or you don't have access.
          </p>
          <Button onClick={() => navigate("/pro")} data-testid="button-go-back">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { submission, questions, answers, analysis } = data;
  const metrics = submission.metrics_snapshot;
  const clientName = submission.client?.display_name || submission.client?.email || "Client";

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto pb-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/pro")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{clientName}'s Check-In</h1>
          <p className="text-muted-foreground text-sm">
            Week of {format(new Date(submission.week_start), "MMMM d, yyyy")}
          </p>
        </div>
        <Badge variant={submission.status === 'submitted' ? 'default' : 'secondary'}>
          {submission.status === 'submitted' 
            ? `Submitted ${submission.submitted_at ? format(new Date(submission.submitted_at), "MMM d") : ''}` 
            : submission.status}
        </Badge>
      </div>

      {metrics && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Weekly Metrics</CardTitle>
                <Badge 
                  variant={
                    metrics.reliability === 'high' 
                      ? 'default' 
                      : metrics.reliability === 'medium' 
                        ? 'secondary' 
                        : 'outline'
                  }
                >
                  {metrics.reliability} reliability
                </Badge>
              </div>
              {metrics.missing_data?.length > 0 && (
                <CardDescription className="text-amber-600">
                  Missing: {metrics.missing_data?.join(', ')}
                </CardDescription>
              )}
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard title="Weight" icon={TrendingUp}>
              <WeightMetric weight={metrics.weight} />
            </MetricCard>

            <MetricCard title="Training" icon={Dumbbell}>
              <TrainingMetric training={metrics.training} />
            </MetricCard>

            <MetricCard title="Nutrition" icon={Utensils}>
              <NutritionMetric nutrition={metrics.nutrition} />
            </MetricCard>

            <MetricCard title="Cardio" icon={Activity}>
              <CardioMetric cardio={metrics.cardio} />
            </MetricCard>

            <MetricCard title="Fasting" icon={Clock}>
              <FastingMetric fasting={metrics.fasting} />
            </MetricCard>
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">View Detailed Data</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-toggle-details">
                      {showDetails ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription className="text-left">
                    {showDetails 
                      ? "Click to collapse detailed breakdown" 
                      : "Click to see individual food entries, workouts, and more"}
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <RawDetailsPanel details={rawDetails} isLoading={detailsLoading} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {submission.status === 'submitted' && !analysis && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI Analysis Available</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              Get AI-powered insights on this check-in including risk assessment, wins, and suggested responses.
            </p>
            <Button 
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {analysis && analysis.status === 'completed' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>AI Analysis</CardTitle>
              </div>
              {analysis.risk_score !== null && (
                <Badge 
                  variant={
                    analysis.risk_score > 7 
                      ? 'destructive' 
                      : analysis.risk_score > 4 
                        ? 'secondary' 
                        : 'default'
                  }
                >
                  Risk: {analysis.risk_score}/10
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.summary && (
              <div>
                <h4 className="font-medium mb-1">Summary</h4>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </div>
            )}

            {analysis.wins && analysis.wins.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">Wins</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {analysis.wins.map((win, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Star className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                      <span>{win}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.flags && analysis.flags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h4 className="font-medium">Areas of Concern</h4>
                </div>
                <div className="space-y-2">
                  {analysis.flags.map((flag, i) => (
                    <div key={i} className="p-2 bg-muted rounded text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={flag.severity === 'high' ? 'destructive' : flag.severity === 'medium' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {flag.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {flag.category}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{flag.issue}</p>
                      {flag.data_points.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Evidence: {flag.data_points.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.suggested_response && (
              <div>
                <h4 className="font-medium mb-1">Suggested Response</h4>
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground italic">
                  "{analysis.suggested_response}"
                </div>
              </div>
            )}

            {analysis.coaching_notes && (
              <div>
                <h4 className="font-medium mb-1">Coaching Notes</h4>
                <p className="text-sm text-muted-foreground">{analysis.coaching_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Responses</CardTitle>
          <CardDescription>
            Answers to your check-in questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No questions in this check-in
            </p>
          ) : (
            questions.map((question, index) => {
              const answer = answers.find((a) => a.question_id === question.id);
              return (
                <div key={question.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">Q{index + 1}</Badge>
                    <p className="font-medium">{question.question_text}</p>
                  </div>
                  <div className="ml-8 p-3 bg-muted rounded-lg">
                    {answer?.answer_value ? (
                      <p data-testid={`answer-${question.id}`}>{answer.answer_value}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No response</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {submission.client_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Additional Notes from Client</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{submission.client_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
