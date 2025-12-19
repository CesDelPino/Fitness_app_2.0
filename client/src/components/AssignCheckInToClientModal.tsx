import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks, Search, Calendar, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProCheckInTemplates, useCreateCheckInAssignment, type CheckInTemplate } from "@/lib/pro-checkins";
import { format, nextDay } from "date-fns";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const assignFormSchema = z.object({
  templateId: z.string().min(1, "Please select a check-in template"),
  cadence: z.enum(["weekly", "biweekly"]),
  anchorWeekday: z.number().min(0).max(6),
  startDate: z.string().min(1, "Please select a start date"),
});

type AssignFormValues = z.infer<typeof assignFormSchema>;

interface AssignCheckInToClientModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
}

export default function AssignCheckInToClientModal({
  open,
  onClose,
  clientId,
  clientName,
}: AssignCheckInToClientModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: templates, isLoading: templatesLoading } = useProCheckInTemplates();
  const assignMutation = useCreateCheckInAssignment();

  const today = new Date();
  const nextMonday = nextDay(today, 1);
  const defaultStartDate = format(nextMonday, "yyyy-MM-dd");

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: {
      templateId: "",
      cadence: "weekly",
      anchorWeekday: 0,
      startDate: defaultStartDate,
    },
  });

  const watchedTemplateId = form.watch("templateId");
  const watchedAnchorWeekday = form.watch("anchorWeekday");
  const watchedCadence = form.watch("cadence");
  const watchedStartDate = form.watch("startDate");

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return templates;
    
    return templates.filter((template) =>
      template.name.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const selectedTemplate = useMemo(() => {
    return templates?.find((t) => t.id === watchedTemplateId);
  }, [templates, watchedTemplateId]);

  const selectedWeekday = WEEKDAYS.find(w => w.value === watchedAnchorWeekday);

  const handleSubmit = async (data: AssignFormValues) => {
    try {
      await assignMutation.mutateAsync({
        template_id: data.templateId,
        client_id: clientId,
        cadence: data.cadence,
        anchor_weekday: data.anchorWeekday,
        start_date: data.startDate,
      });
      
      toast({
        title: "Check-in assigned",
        description: `${selectedTemplate?.name || "Check-in"} assigned to ${clientName || "client"}.`,
      });
      
      form.reset();
      setSearchQuery("");
      onClose();
    } catch (error: unknown) {
      toast({
        title: "Failed to assign check-in",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    form.reset();
    setSearchQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Assign Check-in Template
          </DialogTitle>
          <DialogDescription>
            Schedule recurring check-ins for {clientName || "this client"}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check-in Template</FormLabel>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-templates"
                      />
                    </div>
                    {templatesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : filteredTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {searchQuery ? "No templates found" : "No templates available. Create a template first."}
                      </p>
                    ) : (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                <span>{template.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {template.questions_count || 0} questions
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedTemplate && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-1">{selectedTemplate.name}</p>
                {selectedTemplate.description && (
                  <p className="text-muted-foreground text-xs mb-2">{selectedTemplate.description}</p>
                )}
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplate.questions_count || 0} questions
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cadence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Frequency
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cadence">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="anchorWeekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Due Day
                    </FormLabel>
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={(v) => field.onChange(parseInt(v, 10))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-weekday">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAYS.map((day) => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Check-in Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      data-testid="input-start-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedTemplate && selectedWeekday && (
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <strong>{clientName || "Client"}</strong> will receive <strong>{selectedTemplate.name}</strong>{" "}
                every {watchedCadence === "biweekly" ? "other " : ""}{selectedWeekday.label},
                starting {watchedStartDate && format(new Date(watchedStartDate), "MMM d, yyyy")}.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={assignMutation.isPending || !selectedTemplate}
                data-testid="button-assign-checkin"
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Check-in"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
