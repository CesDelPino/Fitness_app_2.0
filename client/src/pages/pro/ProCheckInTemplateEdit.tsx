import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useProCheckInTemplate,
  useCreateCheckInTemplate,
  useUpdateCheckInTemplate,
  useSetCheckInQuestions,
  usePublishCheckInTemplate,
  type QuestionFieldType,
  type CheckInCadence,
} from "@/lib/pro-checkins";

interface QuestionInput {
  id?: string;
  question_text: string;
  field_type: QuestionFieldType;
  options: string[];
  is_required: boolean;
  display_order: number;
}

const fieldTypeLabels: Record<QuestionFieldType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  single_select: "Single Choice",
  multi_select: "Multiple Choice",
  scale_1_5: "Rating (1-5)",
  boolean: "Yes/No",
};

const defaultQuestions: QuestionInput[] = [
  {
    question_text: "How are you feeling this week?",
    field_type: "scale_1_5",
    options: [],
    is_required: true,
    display_order: 1,
  },
  {
    question_text: "Any challenges or concerns to discuss?",
    field_type: "long_text",
    options: [],
    is_required: false,
    display_order: 2,
  },
];

export default function ProCheckInTemplateEdit() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = !params.id || params.id === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<CheckInCadence>("weekly");
  const [questions, setQuestions] = useState<QuestionInput[]>(defaultQuestions);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { data: templateData, isLoading } = useProCheckInTemplate(isNew ? undefined : params.id);
  const createMutation = useCreateCheckInTemplate();
  const updateMutation = useUpdateCheckInTemplate();
  const setQuestionsMutation = useSetCheckInQuestions();
  const publishMutation = usePublishCheckInTemplate();

  useEffect(() => {
    if (templateData) {
      setName(templateData.template.name);
      setDescription(templateData.template.description || "");
      setCadence(templateData.template.cadence);
      
      if (templateData.questions.length > 0) {
        setQuestions(
          templateData.questions.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            field_type: q.field_type as QuestionFieldType,
            options: q.options || [],
            is_required: q.is_required,
            display_order: q.display_order,
          }))
        );
      }
    }
  }, [templateData]);

  const handleAddQuestion = () => {
    if (questions.length >= 8) {
      toast({
        title: "Maximum questions reached",
        description: "Templates can have up to 8 questions.",
        variant: "destructive",
      });
      return;
    }

    setQuestions([
      ...questions,
      {
        question_text: "",
        field_type: "short_text",
        options: [],
        is_required: false,
        display_order: questions.length + 1,
      },
    ]);
    setIsDirty(true);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(
      newQuestions.map((q, i) => ({ ...q, display_order: i + 1 }))
    );
    setIsDirty(true);
  };

  const handleQuestionChange = (index: number, field: keyof QuestionInput, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
    setIsDirty(true);
  };

  const handleOptionsChange = (index: number, optionsText: string) => {
    const options = optionsText.split("\n").filter((o) => o.trim());
    handleQuestionChange(index, "options", options);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your template.",
        variant: "destructive",
      });
      return;
    }

    const validQuestions = questions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      toast({
        title: "Questions required",
        description: "Please add at least one question to your template.",
        variant: "destructive",
      });
      return;
    }

    try {
      let templateId = params.id;

      if (isNew) {
        const result = await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          cadence,
        });
        templateId = result.template.id;
      } else {
        await updateMutation.mutateAsync({
          templateId: params.id!,
          name: name.trim(),
          description: description.trim() || undefined,
          cadence,
        });
      }

      await setQuestionsMutation.mutateAsync({
        templateId: templateId!,
        questions: validQuestions.map((q, i) => ({
          question_text: q.question_text,
          field_type: q.field_type,
          options: q.options.length > 0 ? q.options : undefined,
          is_required: q.is_required,
          display_order: i + 1,
        })),
      });

      setIsDirty(false);
      toast({
        title: "Template saved",
        description: isNew ? "Your template has been created as a draft." : "Your changes have been saved.",
      });

      if (isNew) {
        navigate(`/pro/check-ins/templates/${templateId}`);
      }
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save template.",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async () => {
    if (!params.id || isNew) return;

    try {
      await handleSave();
      await publishMutation.mutateAsync(params.id);
      
      setShowPublishDialog(false);
      toast({
        title: "Template published",
        description: "Your template is now active and can be assigned to clients.",
      });
    } catch (error: any) {
      toast({
        title: "Publish failed",
        description: error.message || "Failed to publish template.",
        variant: "destructive",
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || setQuestionsMutation.isPending;
  const isPublishing = publishMutation.isPending;
  const isPublished = templateData?.template?.active_version_id !== null;

  if (!isNew && isLoading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
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
          <h1 className="text-2xl font-bold">
            {isNew ? "Create Check-In Template" : "Edit Template"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isNew
              ? "Design a weekly check-in form for your clients"
              : `${templateData?.template?.name || "Loading..."}`}
          </p>
        </div>
        {!isNew && (
          <Badge variant={isPublished ? "default" : "secondary"}>
            {isPublished ? "Published" : "Draft"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>Basic information about your check-in form</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              placeholder="e.g., Weekly Progress Check"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsDirty(true);
              }}
              data-testid="input-template-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What this check-in covers..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsDirty(true);
              }}
              data-testid="input-template-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cadence">Check-In Frequency</Label>
            <Select
              value={cadence}
              onValueChange={(v) => {
                setCadence(v as CheckInCadence);
                setIsDirty(true);
              }}
            >
              <SelectTrigger id="cadence" data-testid="select-cadence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Add up to 8 questions. Client health metrics are automatically included.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddQuestion}
              disabled={questions.length >= 8}
              data-testid="button-add-question"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No questions yet. Add some to get started.</p>
            </div>
          ) : (
            questions.map((question, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="pt-2 text-muted-foreground cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Q{index + 1}
                      </Badge>
                      <div className="flex-1">
                        <Input
                          placeholder="Enter your question..."
                          value={question.question_text}
                          onChange={(e) =>
                            handleQuestionChange(index, "question_text", e.target.value)
                          }
                          data-testid={`input-question-${index}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveQuestion(index)}
                        data-testid={`button-remove-question-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Type:</Label>
                        <Select
                          value={question.field_type}
                          onValueChange={(v) =>
                            handleQuestionChange(index, "field_type", v as QuestionFieldType)
                          }
                        >
                          <SelectTrigger className="w-40" data-testid={`select-field-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(fieldTypeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id={`required-${index}`}
                          checked={question.is_required}
                          onCheckedChange={(checked) =>
                            handleQuestionChange(index, "is_required", checked)
                          }
                          data-testid={`switch-required-${index}`}
                        />
                        <Label htmlFor={`required-${index}`} className="text-sm">
                          Required
                        </Label>
                      </div>
                    </div>

                    {(question.field_type === "single_select" ||
                      question.field_type === "multi_select") && (
                      <div className="space-y-2">
                        <Label className="text-sm">Options (one per line)</Label>
                        <Textarea
                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                          value={question.options.join("\n")}
                          onChange={(e) => handleOptionsChange(index, e.target.value)}
                          rows={3}
                          data-testid={`input-options-${index}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Auto-Included Metrics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="mb-2">
            The following data is automatically pulled from your client's logs and included in every check-in:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Weight changes and 4-week trend</li>
            <li>Training sessions completed vs assigned</li>
            <li>Nutrition averages (calories, protein)</li>
            <li>Cardio activity summary</li>
            <li>Fasting completions</li>
          </ul>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-3 justify-end max-w-2xl mx-auto">
        <Button
          variant="outline"
          onClick={() => navigate("/pro")}
          disabled={isSaving || isPublishing}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={isSaving || isPublishing || (!isDirty && !isNew)}
          data-testid="button-save"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Draft
        </Button>
        {!isNew && (
          <Button
            onClick={() => setShowPublishDialog(true)}
            disabled={isSaving || isPublishing || questions.length === 0}
            data-testid="button-publish"
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isPublished ? "Update & Republish" : "Publish"}
          </Button>
        )}
      </div>

      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Once published, this template can be assigned to clients. Any unsaved changes will be saved first.
              {isPublished && (
                <span className="block mt-2 text-amber-600">
                  This template is already published. Publishing again will update it for all new check-ins.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-publish">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} data-testid="button-confirm-publish">
              {isPublishing ? "Publishing..." : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
