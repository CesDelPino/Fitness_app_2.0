import { AdminLayout } from "@/components/admin-v2/AdminLayout";
import { Route, Switch as RouterSwitch, Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Target, Users, Key, RefreshCw, Loader2, Search, UserCircle, Trash2, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type PermissionDefinition = {
  slug: string;
  display_name: string;
  description: string | null;
  category: string;
  is_exclusive: boolean;
  is_enabled: boolean;
};

type PermissionStats = {
  permission_slug: string;
  grant_count: number;
  active_relationships: number;
  pending_requests: number;
};

type Feature = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  plan_count: number;
};

type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  features: { id: string; code: string; name: string }[];
};

type FeatureUserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  subscription_plans: { name: string } | null;
};

type FeatureOverride = {
  id: string;
  is_enabled: boolean;
  reason: string | null;
  expires_at: string | null;
  features: { name: string } | null;
};

type FeatureAnalytics = {
  summary: {
    totalUsers: number;
    totalPlans: number;
    totalFeatures: number;
    totalOverrides: number;
  };
  planDistribution: {
    planId: string;
    planCode: string;
    planName: string;
    userCount: number;
  }[];
  featureAdoption: {
    featureId: string;
    featureCode: string;
    featureName: string;
    isActive: boolean;
    planCount: number;
  }[];
  recentOverrides: {
    id: string;
    isEnabled: boolean;
    reason: string | null;
    expiresAt: string | null;
    createdAt: string;
    userEmail: string | null;
    userDisplayName: string | null;
    featureCode: string | null;
    featureName: string | null;
  }[];
};

function PolicyTab() {
  const { toast } = useToast();
  const [exclusivityReason, setExclusivityReason] = useState("");
  const [showExclusivityDialog, setShowExclusivityDialog] = useState(false);
  const [pendingExclusivityChange, setPendingExclusivityChange] = useState<{
    slug: string;
    newValue: boolean;
  } | null>(null);

  const { data: permissions = [], isLoading, refetch } = useQuery<PermissionDefinition[]>({
    queryKey: ["/api/admin/permissions/definitions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: stats = [] } = useQuery<PermissionStats[]>({
    queryKey: ["/api/admin/permissions/stats"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const toggleExclusivityMutation = useMutation({
    mutationFn: async ({ slug, is_exclusive, reason }: { slug: string; is_exclusive: boolean; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/permissions/definitions/${slug}/toggle-exclusivity`, {
        is_exclusive,
        reason,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Permission exclusivity updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions/definitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions/stats"] });
      setShowExclusivityDialog(false);
      setPendingExclusivityChange(null);
      setExclusivityReason("");
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to toggle exclusivity", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ slug, is_enabled }: { slug: string; is_enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/permissions/definitions/${slug}`, {
        is_enabled,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Permission updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions/definitions"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to update permission", variant: "destructive" });
    },
  });

  const handleExclusivityClick = (slug: string, currentValue: boolean) => {
    if (toggleExclusivityMutation.isPending) return;
    setPendingExclusivityChange({ slug, newValue: !currentValue });
    setExclusivityReason("");
    setShowExclusivityDialog(true);
  };

  const confirmExclusivityChange = () => {
    if (!pendingExclusivityChange || toggleExclusivityMutation.isPending) return;
    if (exclusivityReason.trim().length < 10) {
      toast({ title: "Reason must be at least 10 characters", variant: "destructive" });
      return;
    }
    toggleExclusivityMutation.mutate({
      slug: pendingExclusivityChange.slug,
      is_exclusive: pendingExclusivityChange.newValue,
      reason: exclusivityReason.trim(),
    });
  };

  const handleCloseDialog = (open: boolean) => {
    if (toggleExclusivityMutation.isPending) return;
    setShowExclusivityDialog(open);
    if (!open) {
      setPendingExclusivityChange(null);
      setExclusivityReason("");
    }
  };

  const getStatForPermission = (slug: string) => {
    return stats.find(s => s.permission_slug === slug);
  };

  const sharedPermissions = permissions.filter(p => p.category === "read");
  const exclusivePermissions = permissions.filter(p => p.category === "write");

  const renderPermissionCard = (permission: PermissionDefinition) => {
    const stat = getStatForPermission(permission.slug);
    return (
      <Card key={permission.slug} className="relative">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium truncate">{permission.display_name}</CardTitle>
              <CardDescription className="text-xs mt-1 line-clamp-2">
                {permission.description || "No description"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {permission.is_exclusive && (
                <Badge variant="secondary" className="text-xs">Exclusive</Badge>
              )}
              {!permission.is_enabled && (
                <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-3">
            {stat && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {stat.grant_count} grants
                </span>
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  {stat.active_relationships} active
                </span>
                {stat.pending_requests > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    {stat.pending_requests} pending
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`enabled-${permission.slug}`}
                    checked={permission.is_enabled}
                    onCheckedChange={(checked) => {
                      updatePermissionMutation.mutate({
                        slug: permission.slug,
                        is_enabled: checked,
                      });
                    }}
                    disabled={updatePermissionMutation.isPending}
                    data-testid={`switch-enabled-${permission.slug}`}
                  />
                  <Label htmlFor={`enabled-${permission.slug}`} className="text-xs">Enabled</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={permission.is_exclusive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleExclusivityClick(permission.slug, permission.is_exclusive)}
                  disabled={toggleExclusivityMutation.isPending}
                  data-testid={`button-toggle-exclusive-${permission.slug}`}
                >
                  {permission.is_exclusive ? (
                    <>
                      <Key className="w-3 h-3 mr-1" />
                      Exclusive
                    </>
                  ) : (
                    <>
                      <Users className="w-3 h-3 mr-1" />
                      Shared
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Permission Policy Management</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-permissions"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Configure permission definitions, toggle exclusivity, and manage policy settings.
            Exclusivity changes require a reason and are logged to the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : permissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No permission definitions found. Run the migrations to populate permission data.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Shared Permissions (Read)
                  <Badge variant="outline" className="text-xs">{sharedPermissions.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sharedPermissions.map(renderPermissionCard)}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Exclusive Permissions (Write)
                  <Badge variant="outline" className="text-xs">{exclusivePermissions.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exclusivePermissions.map(renderPermissionCard)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showExclusivityDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingExclusivityChange?.newValue ? "Make Permission Exclusive" : "Make Permission Shared"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {pendingExclusivityChange?.newValue
                ? "Making this permission exclusive means only one professional can hold it per client. This change will be logged to the audit trail."
                : "Making this permission shared means multiple professionals can hold it per client. This change will be logged to the audit trail."}
            </p>
            {pendingExclusivityChange?.newValue && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Warning: If multiple professionals currently hold this permission for any client, conflicts may occur.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="exclusivity-reason">Reason for change (minimum 10 characters)</Label>
              <Textarea
                id="exclusivity-reason"
                value={exclusivityReason}
                onChange={(e) => setExclusivityReason(e.target.value)}
                placeholder="Explain why this change is being made..."
                className="min-h-[80px]"
                disabled={toggleExclusivityMutation.isPending}
                data-testid="textarea-exclusivity-reason"
              />
              <p className="text-xs text-muted-foreground">
                {exclusivityReason.trim().length}/10 characters minimum
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleCloseDialog(false)}
                disabled={toggleExclusivityMutation.isPending}
                data-testid="button-cancel-exclusivity"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmExclusivityChange}
                disabled={exclusivityReason.trim().length < 10 || toggleExclusivityMutation.isPending}
                data-testid="button-confirm-exclusivity"
              >
                {toggleExclusivityMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Confirm Change
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeaturesTab() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'toggles' | 'plans' | 'overrides' | 'analytics'>('toggles');

  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<FeatureUserProfile | null>(null);
  const [overrideFeatureId, setOverrideFeatureId] = useState('');
  const [overrideIsEnabled, setOverrideIsEnabled] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');

  const { data: features = [], isLoading: loadingFeatures } = useQuery<Feature[]>({
    queryKey: ['/api/admin/features'],
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/admin/subscription-plans'],
  });

  const { data: analytics, isLoading: loadingAnalytics } = useQuery<FeatureAnalytics>({
    queryKey: ['/api/admin/feature-analytics'],
    enabled: activeSection === 'analytics',
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await apiRequest('PATCH', `/api/admin/features/${id}`, { is_active });
      if (!response.ok) throw new Error('Failed to toggle feature');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-analytics'] });
      toast({ title: 'Feature updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update feature', variant: 'destructive' });
    },
  });

  const updatePlanFeaturesMutation = useMutation({
    mutationFn: async ({ planId, featureIds }: { planId: string; featureIds: string[] }) => {
      const response = await apiRequest('PATCH', `/api/admin/subscription-plans/${planId}/features`, {
        feature_ids: featureIds,
      });
      if (!response.ok) throw new Error('Failed to update plan features');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-analytics'] });
      toast({ title: 'Plan features updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update plan features', variant: 'destructive' });
    },
  });

  const searchUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/admin/users/by-email?email=${encodeURIComponent(email)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('User not found');
      return response.json() as Promise<FeatureUserProfile>;
    },
    onSuccess: (data) => {
      setSelectedUser(data);
    },
    onError: () => {
      toast({ title: 'User not found', variant: 'destructive' });
      setSelectedUser(null);
    },
  });

  const { data: userOverrides = [], refetch: refetchOverrides } = useQuery<FeatureOverride[]>({
    queryKey: ['/api/admin/users', selectedUser?.id, 'feature-overrides'],
    queryFn: async () => {
      if (!selectedUser) return [];
      const response = await fetch(`/api/admin/users/${selectedUser.id}/feature-overrides`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedUser,
  });

  const createOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('No user selected');
      const response = await apiRequest('POST', `/api/admin/users/${selectedUser.id}/feature-overrides`, {
        feature_id: overrideFeatureId,
        is_enabled: overrideIsEnabled,
        reason: overrideReason || null,
        expires_at: overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : null,
      });
      if (!response.ok) throw new Error('Failed to create override');
      return response.json();
    },
    onSuccess: () => {
      refetchOverrides();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-analytics'] });
      toast({ title: 'Override created' });
      setOverrideFeatureId('');
      setOverrideReason('');
      setOverrideExpiresAt('');
    },
    onError: () => {
      toast({ title: 'Failed to create override', variant: 'destructive' });
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/feature-overrides/${id}`);
      if (!response.ok) throw new Error('Failed to delete override');
      return response.json();
    },
    onSuccess: () => {
      refetchOverrides();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-analytics'] });
      toast({ title: 'Override deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete override', variant: 'destructive' });
    },
  });

  const handlePlanFeatureToggle = (planId: string, featureId: string, currentFeatureIds: string[]) => {
    const newFeatureIds = currentFeatureIds.includes(featureId)
      ? currentFeatureIds.filter(id => id !== featureId)
      : [...currentFeatureIds, featureId];
    updatePlanFeaturesMutation.mutate({ planId, featureIds: newFeatureIds });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeSection === 'toggles' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('toggles')}
          data-testid="button-section-toggles"
        >
          Feature Toggles
        </Button>
        <Button
          variant={activeSection === 'plans' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('plans')}
          data-testid="button-section-plans"
        >
          Plan Matrix
        </Button>
        <Button
          variant={activeSection === 'overrides' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('overrides')}
          data-testid="button-section-overrides"
        >
          User Overrides
        </Button>
        <Button
          variant={activeSection === 'analytics' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('analytics')}
          data-testid="button-section-analytics"
        >
          Analytics
        </Button>
      </div>

      {activeSection === 'toggles' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Feature Toggles
            </CardTitle>
            <CardDescription>
              Enable or disable features globally. Disabled features are not accessible by any user.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFeatures ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : features.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No features found</p>
            ) : (
              <div className="space-y-3">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                    data-testid={`feature-row-${feature.code}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{feature.name}</span>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {feature.code}
                        </Badge>
                      </div>
                      {feature.description && (
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Assigned to {feature.plan_count} plan{feature.plan_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Switch
                      checked={feature.is_active}
                      onCheckedChange={(checked) =>
                        toggleFeatureMutation.mutate({ id: feature.id, is_active: checked })
                      }
                      disabled={toggleFeatureMutation.isPending}
                      data-testid={`switch-feature-${feature.code}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'plans' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Plan-Feature Matrix
            </CardTitle>
            <CardDescription>
              Configure which features are available for each subscription plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPlans || loadingFeatures ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : plans.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No plans found</p>
            ) : (
              <div className="space-y-6">
                {plans.map((plan) => {
                  const currentFeatureIds = plan.features.map(f => f.id);
                  return (
                    <div key={plan.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{plan.name}</h3>
                        <Badge variant="outline" className="font-mono text-xs">{plan.code}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {features.map((feature) => {
                          const isAssigned = currentFeatureIds.includes(feature.id);
                          return (
                            <div
                              key={feature.id}
                              className="flex items-center gap-2 p-2 rounded border"
                            >
                              <Checkbox
                                checked={isAssigned}
                                onCheckedChange={() =>
                                  handlePlanFeatureToggle(plan.id, feature.id, currentFeatureIds)
                                }
                                disabled={updatePlanFeaturesMutation.isPending || !feature.is_active}
                                data-testid={`checkbox-plan-${plan.code}-feature-${feature.code}`}
                              />
                              <span className={`text-sm ${!feature.is_active ? 'text-muted-foreground line-through' : ''}`}>
                                {feature.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'overrides' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Find User
              </CardTitle>
              <CardDescription>
                Search for a user by email to manage their feature overrides.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  searchUserMutation.mutate(searchEmail);
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="user@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  data-testid="input-search-user-email"
                />
                <Button
                  type="submit"
                  disabled={searchUserMutation.isPending || !searchEmail}
                  data-testid="button-search-user"
                >
                  {searchUserMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {selectedUser && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5" />
                    {selectedUser.display_name || selectedUser.email}
                  </CardTitle>
                  <CardDescription>
                    {selectedUser.email}
                    {selectedUser.subscription_plans && (
                      <> | Plan: <Badge variant="secondary">{selectedUser.subscription_plans.name}</Badge></>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create Override</CardTitle>
                  <CardDescription>
                    Grant or revoke a specific feature for this user.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createOverrideMutation.mutate();
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Feature</Label>
                        <Select value={overrideFeatureId} onValueChange={setOverrideFeatureId}>
                          <SelectTrigger data-testid="select-override-feature">
                            <SelectValue placeholder="Select feature..." />
                          </SelectTrigger>
                          <SelectContent>
                            {features.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Action</Label>
                        <Select
                          value={overrideIsEnabled ? 'grant' : 'revoke'}
                          onValueChange={(v) => setOverrideIsEnabled(v === 'grant')}
                        >
                          <SelectTrigger data-testid="select-override-action">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grant">Grant Access</SelectItem>
                            <SelectItem value="revoke">Revoke Access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Input
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="e.g., Beta tester, Support request"
                          data-testid="input-override-reason"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={overrideExpiresAt}
                          onChange={(e) => setOverrideExpiresAt(e.target.value)}
                          data-testid="input-override-expires"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={!overrideFeatureId || createOverrideMutation.isPending}
                      data-testid="button-create-override"
                    >
                      {createOverrideMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Override
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Overrides</CardTitle>
                  <CardDescription>
                    Active feature overrides for this user.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userOverrides.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No overrides for this user</p>
                  ) : (
                    <div className="space-y-2">
                      {userOverrides.map((override) => (
                        <div
                          key={override.id}
                          className="flex items-center justify-between p-3 rounded-md border"
                          data-testid={`override-row-${override.id}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{override.features?.name}</span>
                              <Badge variant={override.is_enabled ? 'default' : 'destructive'}>
                                {override.is_enabled ? 'Granted' : 'Revoked'}
                              </Badge>
                            </div>
                            {override.reason && (
                              <p className="text-sm text-muted-foreground">{override.reason}</p>
                            )}
                            {override.expires_at && (
                              <p className="text-xs text-muted-foreground">
                                Expires: {format(new Date(override.expires_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteOverrideMutation.mutate(override.id)}
                            disabled={deleteOverrideMutation.isPending}
                            data-testid={`button-delete-override-${override.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {activeSection === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{analytics?.summary.totalUsers ?? '-'}</div>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{analytics?.summary.totalPlans ?? '-'}</div>
                <p className="text-sm text-muted-foreground">Plans</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{analytics?.summary.totalFeatures ?? '-'}</div>
                <p className="text-sm text-muted-foreground">Features</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{analytics?.summary.totalOverrides ?? '-'}</div>
                <p className="text-sm text-muted-foreground">Overrides</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
              <CardDescription>Users per subscription plan</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {analytics?.planDistribution.map((plan) => (
                    <div
                      key={plan.planId}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <span>{plan.planName}</span>
                        <Badge variant="outline" className="font-mono text-xs">{plan.planCode}</Badge>
                      </div>
                      <Badge variant="secondary">{plan.userCount} users</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption</CardTitle>
              <CardDescription>Plans using each feature</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {analytics?.featureAdoption.map((feature) => (
                    <div
                      key={feature.featureId}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <span className={!feature.isActive ? 'text-muted-foreground line-through' : ''}>
                          {feature.featureName}
                        </span>
                        <Badge variant="outline" className="font-mono text-xs">{feature.featureCode}</Badge>
                        {!feature.isActive && <Badge variant="secondary">Disabled</Badge>}
                      </div>
                      <Badge variant="secondary">{feature.planCount} plans</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Overrides</CardTitle>
              <CardDescription>Latest feature override changes</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : analytics?.recentOverrides.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent overrides</p>
              ) : (
                <div className="space-y-2">
                  {analytics?.recentOverrides.map((override) => (
                    <div
                      key={override.id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{override.userEmail}</span>
                          <Badge variant={override.isEnabled ? 'default' : 'destructive'} className="text-xs">
                            {override.isEnabled ? 'Granted' : 'Revoked'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{override.featureName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(override.createdAt), 'MMM d, yyyy h:mm a')}
                          {override.reason && ` - ${override.reason}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminSystemPage() {
  return (
    <AdminLayout>
      <RouterSwitch>
        <Route path="/admin/system/policy" component={PolicyTab} />
        <Route path="/admin/system/features" component={FeaturesTab} />
        <Route path="/admin/system">
          <Redirect to="/admin/system/policy" />
        </Route>
      </RouterSwitch>
    </AdminLayout>
  );
}
