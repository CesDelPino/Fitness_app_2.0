import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";

type PermissionDefinition = {
  slug: string;
  display_name: string;
  description: string | null;
  category: string;
  is_exclusive: boolean;
  is_enabled: boolean;
  requires_verification: boolean;
  created_at: string;
  updated_at: string;
};

type PermissionPreset = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by: string | null;
  creator_name: string;
  created_at: string;
  updated_at: string;
  permission_count: number;
  permissions: Array<{
    slug: string;
    is_enabled: boolean;
    display_name: string;
    category: string;
    is_exclusive: boolean;
  }>;
};

export function PresetsTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingPreset, setDeletingPreset] = useState<PermissionPreset | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [editingPreset, setEditingPreset] = useState<PermissionPreset | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");

  const { data: presets = [], isLoading, refetch } = useQuery<PermissionPreset[]>({
    queryKey: ["/api/admin/permission-presets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/permission-presets?include_inactive=true");
      return response.json();
    },
  });

  const { data: permissionDefs = [] } = useQuery<PermissionDefinition[]>({
    queryKey: ["/api/admin/permissions/definitions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createPresetMutation = useMutation({
    mutationFn: async (data: { id?: string; name: string; description: string; permissions: Array<{ slug: string; is_enabled: boolean }>; reason: string }) => {
      const response = await apiRequest("POST", "/api/admin/permission-presets", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: `Preset ${data.action}` });
      setShowCreateDialog(false);
      setEditingPreset(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permission-presets"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiRequest("DELETE", `/api/admin/permission-presets/${id}`, { reason });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Preset deactivated" });
      setShowDeleteDialog(false);
      setDeletingPreset(null);
      setDeleteReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permission-presets"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setPresetName("");
    setPresetDescription("");
    setSelectedPermissions(new Set());
    setReason("");
  };

  const openEditDialog = (preset: PermissionPreset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetDescription(preset.description || "");
    setSelectedPermissions(new Set(preset.permissions.filter(p => p.is_enabled).map(p => p.slug)));
    setReason("");
    setShowCreateDialog(true);
  };

  const openDeleteDialog = (preset: PermissionPreset) => {
    setDeletingPreset(preset);
    setDeleteReason("");
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    if (!deletingPreset) return;
    if (deleteReason.trim().length < 10) {
      toast({ title: "Reason must be at least 10 characters", variant: "destructive" });
      return;
    }
    deletePresetMutation.mutate({ id: deletingPreset.id, reason: deleteReason.trim() });
  };

  const handleSave = () => {
    if (reason.trim().length < 10) {
      toast({ title: "Reason must be at least 10 characters", variant: "destructive" });
      return;
    }
    createPresetMutation.mutate({
      id: editingPreset?.id,
      name: presetName,
      description: presetDescription,
      permissions: Array.from(selectedPermissions).map(slug => ({ slug, is_enabled: true })),
      reason: reason.trim(),
    });
  };

  const togglePermission = (slug: string) => {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(slug)) {
      newSet.delete(slug);
    } else {
      newSet.add(slug);
    }
    setSelectedPermissions(newSet);
  };

  const sharedPerms = permissionDefs.filter(p => p.category === "read");
  const exclusivePerms = permissionDefs.filter(p => p.category === "write");

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Permission Presets
              </CardTitle>
              <CardDescription>
                Manage role-based permission bundles for quick assignment
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-presets">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button onClick={() => { resetForm(); setEditingPreset(null); setShowCreateDialog(true); }} data-testid="button-create-preset">
                <Plus className="w-4 h-4 mr-1" />
                Create Preset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No presets configured yet</div>
          ) : (
            <div className="space-y-3">
              {presets.map(preset => (
                <Card key={preset.id} className={!preset.is_active ? "opacity-60" : ""} data-testid={`card-preset-${preset.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-preset-name-${preset.id}`}>{preset.name}</span>
                            {preset.is_system && <Badge variant="secondary">System</Badge>}
                            {!preset.is_active && <Badge variant="outline">Inactive</Badge>}
                          </div>
                          {preset.description && <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {preset.permissions.slice(0, 5).map(p => (
                              <Badge key={p.slug} variant="outline" className="text-xs">{p.display_name}</Badge>
                            ))}
                            {preset.permissions.length > 5 && (
                              <Badge variant="outline" className="text-xs">+{preset.permissions.length - 5} more</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(preset)} data-testid={`button-edit-preset-${preset.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!preset.is_system && preset.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(preset)}
                            data-testid={`button-delete-preset-${preset.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingPreset(null); resetForm(); } else { setShowCreateDialog(true); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPreset ? "Edit Preset" : "Create Preset"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="preset-name">Name</Label>
                  <Input
                    id="preset-name"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., Nutritionist, Personal Trainer"
                    disabled={editingPreset?.is_system}
                    data-testid="input-preset-name"
                  />
                </div>
                <div>
                  <Label htmlFor="preset-description">Description</Label>
                  <Textarea
                    id="preset-description"
                    value={presetDescription}
                    onChange={(e) => setPresetDescription(e.target.value)}
                    placeholder="Describe when to use this preset..."
                    data-testid="textarea-preset-description"
                  />
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Shared (Read) Permissions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {sharedPerms.map(perm => (
                          <div key={perm.slug} className="flex items-center gap-2">
                            <Checkbox
                              id={`perm-${perm.slug}`}
                              checked={selectedPermissions.has(perm.slug)}
                              onCheckedChange={() => togglePermission(perm.slug)}
                              disabled={!perm.is_enabled}
                              data-testid={`checkbox-perm-${perm.slug}`}
                            />
                            <Label htmlFor={`perm-${perm.slug}`} className="text-sm cursor-pointer">
                              {perm.display_name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Exclusive (Write) Permissions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {exclusivePerms.map(perm => (
                          <div key={perm.slug} className="flex items-center gap-2">
                            <Checkbox
                              id={`perm-${perm.slug}`}
                              checked={selectedPermissions.has(perm.slug)}
                              onCheckedChange={() => togglePermission(perm.slug)}
                              disabled={!perm.is_enabled}
                              data-testid={`checkbox-perm-${perm.slug}`}
                            />
                            <Label htmlFor={`perm-${perm.slug}`} className="text-sm cursor-pointer">
                              {perm.display_name}
                              {perm.is_exclusive && <span className="text-xs text-muted-foreground ml-1">(exclusive)</span>}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="preset-reason">Reason (required, min 10 characters)</Label>
                  <Textarea
                    id="preset-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why you're making this change..."
                    data-testid="textarea-preset-reason"
                  />
                  <div className="text-xs text-muted-foreground mt-1">{reason.trim().length}/10 characters</div>
                </div>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" data-testid="button-cancel-preset">Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={handleSave}
                    disabled={!presetName.trim() || reason.trim().length < 10 || createPresetMutation.isPending}
                    data-testid="button-save-preset"
                  >
                    {createPresetMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    {editingPreset ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeletingPreset(null); setDeleteReason(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deactivate Preset</DialogTitle>
                <DialogDescription>
                  Are you sure you want to deactivate "{deletingPreset?.name}"? This action can be undone by an administrator.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="delete-reason">Reason (required, min 10 characters)</Label>
                  <Textarea
                    id="delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Explain why you're deactivating this preset..."
                    data-testid="textarea-delete-reason"
                  />
                  <div className="text-xs text-muted-foreground mt-1">{deleteReason.trim().length}/10 characters</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete-preset">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteReason.trim().length < 10 || deletePresetMutation.isPending}
                  data-testid="button-confirm-delete-preset"
                >
                  {deletePresetMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Deactivate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
