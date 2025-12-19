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
import { ListChecks, Search, Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProClients } from "@/lib/pro-routines";
import { useCreateCheckInAssignment, type CheckInTemplate } from "@/lib/pro-checkins";
import { format, addDays, startOfWeek, nextDay } from "date-fns";

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
  clientId: z.string().min(1, "Please select a client"),
  cadence: z.enum(["weekly", "biweekly"]),
  anchorWeekday: z.number().min(0).max(6),
  startDate: z.string().min(1, "Please select a start date"),
});

type AssignFormValues = z.infer<typeof assignFormSchema>;

interface AssignCheckInTemplateModalProps {
  open: boolean;
  onClose: () => void;
  template: CheckInTemplate;
}

export default function AssignCheckInTemplateModal({
  open,
  onClose,
  template,
}: AssignCheckInTemplateModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: clients, isLoading: clientsLoading } = useProClients();
  const assignMutation = useCreateCheckInAssignment();

  const today = new Date();
  const nextMonday = nextDay(today, 1);
  const defaultStartDate = format(nextMonday, "yyyy-MM-dd");

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: {
      clientId: "",
      cadence: "weekly",
      anchorWeekday: 0,
      startDate: defaultStartDate,
    },
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return clients;
    
    return clients.filter((client) =>
      client.display_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const selectedClient = useMemo(() => {
    const clientId = form.watch("clientId");
    return clients?.find((c) => c.id === clientId);
  }, [clients, form.watch("clientId")]);

  const selectedWeekday = WEEKDAYS.find(w => w.value === form.watch("anchorWeekday"));
  const selectedCadence = form.watch("cadence");

  const handleSubmit = async (data: AssignFormValues) => {
    try {
      await assignMutation.mutateAsync({
        template_id: template.id,
        client_id: data.clientId,
        cadence: data.cadence,
        anchor_weekday: data.anchorWeekday,
        start_date: data.startDate,
      });

      toast({
        title: "Check-In Assigned",
        description: `${template.name} assigned to ${selectedClient?.display_name || selectedClient?.email || "client"}. First check-in due on ${selectedWeekday?.label}.`,
      });

      form.reset();
      setSearchQuery("");
      onClose();
    } catch (error: any) {
      console.error("Assignment error:", error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign the check-in template. Please try again.",
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
            <ListChecks className="w-5 h-5" />
            Assign Check-In Template
          </DialogTitle>
          <DialogDescription>
            Assign "{template.name}" to a client. They will receive {selectedCadence} reminders to complete their check-in.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Search Clients</FormLabel>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-clients"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Client</FormLabel>
                  <FormControl>
                    {clientsLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : filteredClients.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground border rounded-md">
                        {searchQuery
                          ? "No clients match your search"
                          : "No connected clients. Invite clients first."}
                      </div>
                    ) : (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger data-testid="select-client">
                          <SelectValue placeholder="Choose a client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredClients.map((client) => (
                            <SelectItem
                              key={client.id}
                              value={client.id}
                              data-testid={`option-client-${client.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{client.display_name || client.email}</span>
                                {client.profile_completed === false && (
                                  <Badge variant="outline" className="text-xs ml-1">
                                    Setup pending
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

            {selectedClient && (
              <div className="p-3 bg-muted rounded-md space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{selectedClient.display_name || "Client"}</p>
                  {selectedClient.profile_completed === false && (
                    <Badge variant="outline" className="text-xs">
                      Setup pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cadence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger data-testid="select-cadence">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="anchorWeekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Day</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value.toString()}
                        onValueChange={(v) => field.onChange(parseInt(v))}
                      >
                        <SelectTrigger data-testid="select-weekday">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((day) => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
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
                  <FormLabel>Start Date</FormLabel>
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

            <div className="p-3 bg-primary/5 rounded-md space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Check-ins due every <strong>{selectedWeekday?.label}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Starting from <strong>{form.watch("startDate") ? format(new Date(form.watch("startDate")), "MMM d, yyyy") : "..."}</strong></span>
              </div>
            </div>

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
                disabled={assignMutation.isPending || !form.watch("clientId")}
                data-testid="button-confirm-assignment"
              >
                {assignMutation.isPending ? "Assigning..." : "Assign Check-In"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
