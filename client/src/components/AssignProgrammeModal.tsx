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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Dumbbell, Target, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProRoutines, useAssignRoutine, type RoutineBlueprint } from "@/lib/pro-routines";
import { format } from "date-fns";

const assignFormSchema = z.object({
  routineId: z.string().min(1, "Please select a programme"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type AssignFormValues = z.infer<typeof assignFormSchema>;

interface AssignProgrammeModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
}

export default function AssignProgrammeModal({
  open,
  onClose,
  clientId,
  clientName,
}: AssignProgrammeModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: routines, isLoading: routinesLoading } = useProRoutines({
    includeTemplates: false,
    includeArchived: false,
  });

  const assignMutation = useAssignRoutine();

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: {
      routineId: "",
      startDate: "",
      endDate: "",
      notes: "",
    },
  });

  const filteredRoutines = useMemo(() => {
    if (!routines) return [];
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return routines;
    
    return routines.filter((routine) =>
      routine.name.toLowerCase().includes(query) ||
      routine.description?.toLowerCase().includes(query)
    );
  }, [routines, searchQuery]);

  const selectedRoutine = useMemo(() => {
    const routineId = form.watch("routineId");
    return routines?.find((r) => r.id === routineId);
  }, [routines, form.watch("routineId")]);

  const handleSubmit = async (data: AssignFormValues) => {
    try {
      await assignMutation.mutateAsync({
        routineId: data.routineId,
        client_id: clientId,
        start_date: data.startDate || undefined,
        end_date: data.endDate || undefined,
        notes: data.notes || undefined,
      });

      toast({
        title: "Programme Assigned",
        description: `Successfully assigned ${selectedRoutine?.name || "programme"} to ${clientName || "client"}.`,
      });

      form.reset();
      setSearchQuery("");
      onClose();
    } catch (error: any) {
      console.error("Assignment error:", error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign the programme. Please try again.",
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Assign Programme
          </DialogTitle>
          <DialogDescription>
            Choose a programme to assign to {clientName || "this client"}.
            Only programmes with an active version can be assigned.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Search Programmes</FormLabel>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-programmes"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="routineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Programme</FormLabel>
                  <FormControl>
                    {routinesLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : filteredRoutines.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground border rounded-md">
                        {searchQuery
                          ? "No programmes match your search"
                          : "No active programmes available. Create a programme first."}
                      </div>
                    ) : (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger data-testid="select-programme">
                          <SelectValue placeholder="Choose a programme..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredRoutines.map((routine) => (
                            <SelectItem
                              key={routine.id}
                              value={routine.id}
                              data-testid={`option-programme-${routine.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{routine.name}</span>
                                {routine.sessions_per_week && (
                                  <Badge variant="outline" className="text-xs">
                                    {routine.sessions_per_week}x/week
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRoutine && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <p className="font-medium">{selectedRoutine.name}</p>
                {selectedRoutine.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedRoutine.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {selectedRoutine.duration_weeks && (
                    <Badge variant="secondary" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      {selectedRoutine.duration_weeks} weeks
                    </Badge>
                  )}
                  {selectedRoutine.sessions_per_week && (
                    <Badge variant="secondary" className="text-xs">
                      <Dumbbell className="w-3 h-3 mr-1" />
                      {selectedRoutine.sessions_per_week}x per week
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    <Target className="w-3 h-3 mr-1" />
                    {selectedRoutine.creation_method}
                  </Badge>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date (Optional)</FormLabel>
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

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes for Client (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any instructions or notes for the client..."
                      className="resize-none"
                      rows={3}
                      data-testid="input-assignment-notes"
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
                data-testid="button-cancel-assignment"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={assignMutation.isPending || !form.watch("routineId")}
                data-testid="button-confirm-assignment"
              >
                {assignMutation.isPending ? "Assigning..." : "Assign Programme"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
