import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

type EquipmentOption = {
  id: string;
  name: string;
  category: string;
  display_order: number;
  is_active: boolean;
};

export function EquipmentTab() {
  const { toast } = useToast();
  const [editingEquipment, setEditingEquipment] = useState<EquipmentOption | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    display_order: 0,
    is_active: true,
  });

  const { data: equipment = [], isLoading } = useQuery<EquipmentOption[]>({
    queryKey: ["/api/admin/equipment"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/admin/equipment", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      toast({ title: "Equipment created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create equipment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      await apiRequest("PUT", `/api/admin/equipment/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      toast({ title: "Equipment updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update equipment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      toast({ title: "Equipment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete equipment", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", category: "", display_order: 0, is_active: true });
    setEditingEquipment(null);
  };

  const openEditDialog = (item: EquipmentOption) => {
    setEditingEquipment(item);
    setFormData({
      name: item.name,
      category: item.category,
      display_order: item.display_order,
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEquipment) {
      updateMutation.mutate({ id: editingEquipment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const categories = Array.from(new Set(equipment.map(e => e.category))).sort();

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
          <h2 className="text-lg font-semibold">Equipment Options</h2>
          <p className="text-sm text-muted-foreground">{equipment.length} items</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-equipment">
              <Plus className="w-4 h-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEquipment ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="equip-name">Name</Label>
                <Input
                  id="equip-name"
                  data-testid="input-equipment-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Barbell"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equip-category">Category</Label>
                <Input
                  id="equip-category"
                  data-testid="input-equipment-category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Free Weights"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equip-order">Display Order</Label>
                <Input
                  id="equip-order"
                  data-testid="input-equipment-order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="equip-active"
                  data-testid="switch-equipment-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="equip-active">Active</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-equipment">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingEquipment ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {categories.map(category => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {equipment
                .filter(e => e.category === category)
                .sort((a, b) => a.display_order - b.display_order)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                    data-testid={`equipment-row-${item.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{item.name}</span>
                      {!item.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(item)}
                        data-testid={`button-edit-equipment-${item.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this equipment?")) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-equipment-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
