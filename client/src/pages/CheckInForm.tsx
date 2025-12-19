import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, Send, Save, TrendingUp, TrendingDown, Minus, Dumbbell, Utensils, Activity, Clock, AlertCircle, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  useClientUpcomingCheckIn,
  useStartCheckIn,
  useSaveCheckInDraft,
  useSubmitCheckIn,
  useRefreshCheckInMetrics,
} from "@/lib/client-checkins";
import type { CheckInQuestion, WeeklyMetrics } from "@/lib/pro-checkins";

interface AnswerState {
  [questionId: string]: string;
}

function MetricsSummary({ metrics }: { metrics: WeeklyMetrics }) {
  const trendIcon = metrics.weight.trend_4_week === 'gaining'
    ? TrendingUp
    : metrics.weight.trend_4_week === 'losing'
      ? TrendingDown
      : Minus;
  const TrendIcon = trendIcon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Your Weekly Summary</CardTitle>
          <Badge
            variant={
              metrics.reliability === 'high'
                ? 'default'
                : metrics.reliability === 'medium'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {metrics.reliability} data
          </Badge>
        </div>
        <CardDescription>
          Auto-collected from your logs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Weight
            </div>
            <div className="font-semibold">
              {metrics.weight.current_kg?.toFixed(1) || "—"} kg
              {metrics.weight.delta_kg !== null && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({metrics.weight.delta_kg > 0 ? "+" : ""}{metrics.weight.delta_kg.toFixed(1)})
                </span>
              )}
            </div>
            {metrics.weight.trend_4_week && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendIcon className="h-3 w-3" />
                {metrics.weight.trend_4_week}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Dumbbell className="h-3 w-3" />
              Training
            </div>
            <div className="font-semibold">
              {metrics.training.sessions_completed}/{metrics.training.sessions_assigned}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.training.adherence_percent}% adherence
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Utensils className="h-3 w-3" />
              Nutrition
            </div>
            <div className="font-semibold">
              {metrics.nutrition.avg_calories?.toLocaleString() || "—"} kcal
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.nutrition.days_logged} days logged
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Activity className="h-3 w-3" />
              Cardio
            </div>
            <div className="font-semibold">
              {metrics.cardio.total_minutes} min
            </div>
            {metrics.cardio.activities.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {metrics.cardio.activities.slice(0, 2).join(", ")}
              </div>
            )}
          </div>
        </div>

        {metrics.missing_data?.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-muted rounded text-xs">
            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              Missing: {metrics.missing_data?.join(", ")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: CheckInQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  switch (question.field_type) {
    case "short_text":
      return (
        <Input
          placeholder="Your answer..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`input-answer-${question.id}`}
        />
      );

    case "long_text":
      return (
        <Textarea
          placeholder="Your answer..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          data-testid={`input-answer-${question.id}`}
        />
      );

    case "scale_1_5":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((num) => (
            <Button
              key={num}
              variant={value === String(num) ? "default" : "outline"}
              size="lg"
              className="flex-1"
              onClick={() => onChange(String(num))}
              data-testid={`button-scale-${question.id}-${num}`}
            >
              {num}
            </Button>
          ))}
        </div>
      );

    case "boolean":
      return (
        <div className="flex gap-4">
          <Button
            variant={value === "Yes" ? "default" : "outline"}
            onClick={() => onChange("Yes")}
            className="flex-1"
            data-testid={`button-yes-${question.id}`}
          >
            Yes
          </Button>
          <Button
            variant={value === "No" ? "default" : "outline"}
            onClick={() => onChange("No")}
            className="flex-1"
            data-testid={`button-no-${question.id}`}
          >
            No
          </Button>
        </div>
      );

    case "single_select":
      return (
        <RadioGroup value={value} onValueChange={onChange}>
          {(question.options || []).map((option, i) => (
            <div key={i} className="flex items-center space-x-2">
              <RadioGroupItem
                value={option}
                id={`${question.id}-${i}`}
                data-testid={`radio-${question.id}-${i}`}
              />
              <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "multi_select":
      const selectedValues = value ? value.split(", ") : [];
      return (
        <div className="space-y-2">
          {(question.options || []).map((option, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Checkbox
                id={`${question.id}-${i}`}
                checked={selectedValues.includes(option)}
                onCheckedChange={(checked) => {
                  const newValues = checked
                    ? [...selectedValues, option]
                    : selectedValues.filter((v) => v !== option);
                  onChange(newValues.join(", "));
                }}
                data-testid={`checkbox-${question.id}-${i}`}
              />
              <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
            </div>
          ))}
        </div>
      );

    default:
      return (
        <Input
          placeholder="Your answer..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`input-answer-${question.id}`}
        />
      );
  }
}

export default function CheckInForm() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [answers, setAnswers] = useState<AnswerState>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data, isLoading, error, refetch } = useClientUpcomingCheckIn();
  const startMutation = useStartCheckIn();
  const saveDraftMutation = useSaveCheckInDraft();
  const submitMutation = useSubmitCheckIn();
  const refreshMetricsMutation = useRefreshCheckInMetrics();

  const submission = data?.upcoming?.submission;
  const questions = data?.upcoming?.questions || [];
  const metrics = data?.upcoming?.metrics;
  const existingAnswers = data?.upcoming?.answers || [];

  useEffect(() => {
    if (existingAnswers.length > 0) {
      const answerMap: AnswerState = {};
      existingAnswers.forEach((a) => {
        answerMap[a.question_id] = a.answer_value || "";
      });
      setAnswers(answerMap);
    }
  }, [existingAnswers]);

  useEffect(() => {
    if (submission?.id && submission.status === 'scheduled') {
      startMutation.mutate(submission.id);
    }
  }, [submission?.id, submission?.status]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSaveDraft = useCallback(async () => {
    if (!submission?.id) return;

    const answersList = Object.entries(answers).map(([questionId, value]) => ({
      question_id: questionId,
      answer_value: value || null,
    }));

    try {
      await saveDraftMutation.mutateAsync({
        submissionId: submission.id,
        answers: answersList,
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Autosave failed:", error);
    }
  }, [submission?.id, answers, saveDraftMutation]);

  useEffect(() => {
    if (Object.keys(answers).length === 0) return;

    const timer = setTimeout(() => {
      handleSaveDraft();
    }, 3000);

    return () => clearTimeout(timer);
  }, [answers, handleSaveDraft]);

  const handleSubmit = async () => {
    console.log('[CheckIn] handleSubmit called, submission:', submission?.id);
    if (!submission?.id) {
      console.log('[CheckIn] No submission ID, returning early');
      return;
    }

    const requiredQuestions = questions.filter((q) => q.is_required);
    const missingRequired = requiredQuestions.filter(
      (q) => !answers[q.id]?.trim()
    );

    console.log('[CheckIn] Required questions:', requiredQuestions.length, 'Missing:', missingRequired.length);

    if (missingRequired.length > 0) {
      toast({
        title: "Required questions",
        description: `Please answer all required questions (${missingRequired.length} remaining).`,
        variant: "destructive",
      });
      return;
    }

    const answersList = Object.entries(answers).map(([questionId, value]) => ({
      question_id: questionId,
      answer_value: value || null,
    }));

    console.log('[CheckIn] Submitting with answers:', answersList.length);

    try {
      const result = await submitMutation.mutateAsync({
        submissionId: submission.id,
        answers: answersList,
      });

      console.log('[CheckIn] Submit success:', result);

      toast({
        title: "Check-in submitted!",
        description: "Your trainer will review your update soon.",
      });

      navigate("/train");
    } catch (error: any) {
      console.error('[CheckIn] Submit error:', error);
      toast({
        title: "Submit failed",
        description: error.message || "Failed to submit check-in.",
        variant: "destructive",
      });
    }
  };

  const handleRefreshMetrics = async () => {
    try {
      await refreshMetricsMutation.mutateAsync();
      await refetch();
      toast({
        title: "Metrics refreshed",
        description: "Your latest data has been pulled.",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Could not refresh metrics.",
        variant: "destructive",
      });
    }
  };

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="pb-20 px-4 py-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error || !data?.upcoming || !submission) {
    return (
      <div className="pb-20 px-4 py-6 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Check-in not found</h2>
          <p className="text-muted-foreground mb-4">
            This check-in may have been submitted or is no longer available.
          </p>
          <Button onClick={() => navigate("/train")} data-testid="button-go-back">
            Back to Train
          </Button>
        </div>
      </div>
    );
  }

  // If the URL has a different ID, redirect to the correct check-in URL
  if (params.id !== submission.id) {
    navigate(`/check-in/${submission.id}`, { replace: true });
  }

  return (
    <div className="pb-8 px-4 py-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/train")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">Weekly Check-In</h1>
          <p className="text-muted-foreground text-sm">
            Week of {format(new Date(submission.week_start), "MMMM d, yyyy")}
          </p>
        </div>
        <Button
          onClick={() => setShowSubmitDialog(true)}
          disabled={submitMutation.isPending}
          data-testid="button-submit"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {answeredCount} of {questions.length} questions answered
          </span>
          {lastSaved && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Saved {format(lastSaved, "h:mm a")}
            </span>
          )}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {metrics && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Data</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshMetrics}
              disabled={refreshMetricsMutation.isPending}
              data-testid="button-refresh-metrics"
            >
              {refreshMetricsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <MetricsSummary metrics={metrics} />
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Questions</h2>
        {questions.map((question, index) => (
          <Card key={question.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-2">
                <Badge variant="outline">Q{index + 1}</Badge>
                <div className="flex-1">
                  <CardTitle className="text-base font-medium">
                    {question.question_text}
                    {question.is_required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <QuestionField
                question={question}
                value={answers[question.id] || ""}
                onChange={(value) => handleAnswerChange(question.id, value)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Check-In?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, your trainer will be able to review your responses and weekly metrics.
              You won't be able to edit your answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-submit">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              data-testid="button-confirm-submit"
            >
              Submit Check-In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
