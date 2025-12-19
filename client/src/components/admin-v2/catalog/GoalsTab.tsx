import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

type GoalType = {
  id: string;
  name: string;
  description: string | null;
  default_rep_range: string | null;
  default_rest_seconds: number | null;
  display_order: number;
  is_active: boolean;
};

export function GoalsTab() {
  const { toast } = useToast();
  const [editingGoal, setEditingGoal] = useState<GoalType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_rep_range: "",
    default_rest_seconds: 60,
    display_order: 0,
    is_active: true,
  });

  const { data: goals = [], isLoading } = useQuery<GoalType[]>({
    queryKey: ["/api/admin/goals"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/admin/goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/goals"] });
      toast({ title: "Goal created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create goal", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      await apiRequest("PUT", `/api/admin/goals/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/goals"] });
      toast({ title: "Goal updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update goal", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/goals"] });
      toast({ title: "Goal deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete goal", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", default_rep_range: "", default_rest_seconds: 60, display_order: 0, is_active: true });
    setEditingGoal(null);
  };

  const openEditDialog = (item: GoalType) => {
    setEditingGoal(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      default_rep_range: item.default_rep_range || "",
      default_rest_seconds: item.default_rest_seconds || 60,
      display_order: item.display_order,
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Training Goals</h2>
          <p className="text-sm text-muted-foreground">{goals.length} goals</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-goal">
              <Plus className="w-4 h-4 mr-2" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Edit Goal" : "Add Goal"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name">Name</Label>
                <Input
                  id="goal-name"
                  data-testid="input-goal-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Hypertrophy"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-description">Description</Label>
                <Textarea
                  id="goal-description"
                  data-testid="input-goal-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Build muscle mass with moderate weight and higher reps"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-reps">Default Rep Range</Label>
                  <Input
                    id="goal-reps"
                    data-testid="input-goal-reps"
                    value={formData.default_rep_range}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_rep_range: e.target.value }))}
                    placeholder="8-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-rest">Rest (seconds)</Label>
                  <Input
                    id="goal-rest"
                    data-testid="input-goal-rest"
                    type="number"
                    value={formData.default_rest_seconds}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_rest_seconds: parseInt(e.target.value) || 60 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-order">Display Order</Label>
                <Input
                  id="goal-order"
                  data-testid="input-goal-order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="goal-active"
                  data-testid="switch-goal-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="goal-active">Active</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-goal">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingGoal ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {goals
          .sort((a, b) => a.display_order - b.display_order)
          .map(goal => (
            <Card key={goal.id} data-testid={`goal-row-${goal.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{goal.name}</h3>
                      {!goal.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {goal.default_rep_range && (
                        <span>Reps: {goal.default_rep_range}</span>
                      )}
                      {goal.default_rest_seconds && (
                        <span>Rest: {goal.default_rest_seconds}s</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(goal)}
                      data-testid={`button-edit-goal-${goal.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this goal?")) {
                          deleteMutation.mutate(goal.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-goal-${goal.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
