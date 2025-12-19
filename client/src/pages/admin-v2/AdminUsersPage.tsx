import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-v2/AdminLayout";
import { Route, Switch as RouterSwitch, Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Loader2, Users, UserCircle, BadgeCheck, UserPlus, FileSearch, Key, Trash2,
  RefreshCw, Clock, XCircle, FileText, ExternalLink, ChevronLeft, ChevronRight,
  Filter, X, Plus, MoreHorizontal, Archive, Eye, AlertTriangle
} from "lucide-react";

type SupabaseUser = {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  createdAt: string;
  lastSignIn?: string;
};

type EnhancedUser = {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
  isPremium: boolean;
  hasAdminOverride: boolean;
  subscriptionStatus: string | null;
  adminOverrideDetails: {
    grantedBy?: string;
    grantedAt?: string;
    expiresAt?: string;
    reason?: string;
  } | null;
};

type UsersResponse = {
  users: EnhancedUser[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

type UserDependencies = {
  userId: string;
  displayName: string;
  role: string;
  dependencies: {
    messages: number;
    conversations: number;
    purchases: number;
    products: number;
  };
  warnings: string[];
};

type VerificationRequest = {
  user_id: string;
  professional_name: string;
  email: string;
  headline: string;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_submitted_at: string | null;
  document_count: number;
  specialties: string[] | null;
};

type VerificationDetails = {
  user_id: string;
  professional_name: string;
  email: string;
  headline: string;
  bio: string | null;
  specialties: string[] | null;
  experience_years: number | null;
  location_city: string | null;
  location_state: string | null;
  verification_status: string;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_reviewed_by: string | null;
  reviewer_name: string | null;
  verification_notes: string | null;
  documents: Array<{
    id: string;
    document_type: string;
    file_path: string;
    file_name: string;
    file_size_bytes: number | null;
    mime_type: string | null;
    uploaded_at: string;
    review_status: string;
  }>;
};

type AuditLogEntry = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string;
  actor_name: string;
  target_client_id: string | null;
  target_client_name: string | null;
  target_relationship_id: string | null;
  target_professional_id: string | null;
  target_professional_name: string | null;
  permission_slug: string | null;
  permission_name: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

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

type UserProfile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string;
};

type Relationship = {
  id: string;
  client_id: string;
  professional_id: string;
  status: string;
  forced_by_admin: string | null;
  forced_reason: string | null;
  forced_at: string | null;
  created_at: string;
  client: UserProfile;
  professional: UserProfile;
};

type PresetAvatar = {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  image_path: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

function UsersListTab() {
  const { toast } = useToast();
  
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newGender, setNewGender] = useState<"M" | "F">("M");
  const [newAge, setNewAge] = useState("");
  const [newHeight, setNewHeight] = useState("");
  const [newWeight, setNewWeight] = useState("");
  
  const [selectedUserId, setSelectedUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [premiumFilter, setPremiumFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);

  const [premiumDialogUser, setPremiumDialogUser] = useState<EnhancedUser | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<EnhancedUser | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<UserDependencies | null>(null);
  const [premiumReason, setPremiumReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  useState(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  });

  const searchTimer = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer[0]) clearTimeout(searchTimer[0]);
    searchTimer[1](setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300) as unknown as NodeJS.Timeout);
  };

  const { data: legacyUsers = [] } = useQuery<SupabaseUser[]>({
    queryKey: ["/api/admin/supabase-users"],
  });

  const { data: usersData, isLoading: loadingUsers, refetch: refetchUsers } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", debouncedSearch, roleFilter, premiumFilter, currentPage, perPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        role: roleFilter,
        premiumStatus: premiumFilter,
        page: currentPage.toString(),
        perPage: perPage.toString(),
      });
      const response = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const users = usersData?.users || [];

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        email: newEmail,
        password: newPassword,
      };
      if (newDisplayName) payload.displayName = newDisplayName;
      if (newGender) payload.gender = newGender;
      if (newAge) payload.age = parseInt(newAge);
      if (newHeight) payload.heightCm = parseInt(newHeight);
      if (newWeight) payload.currentWeightKg = parseFloat(newWeight);
      
      const response = await apiRequest("POST", "/api/admin/supabase-users", payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supabase-users"] });
      toast({ title: "User created successfully" });
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewAge("");
      setNewHeight("");
      setNewWeight("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create user", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/supabase-users/${selectedUserId}/password`, {
        password: resetPassword,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated successfully" });
      setSelectedUserId("");
      setResetPassword("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update password", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const premiumMutation = useMutation({
    mutationFn: async ({ userId, action, reason }: { userId: string; action: 'grant' | 'revoke'; reason?: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/premium`, {
        action,
        reason,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} premium`);
      }
      return response.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: action === 'grant' ? "Premium access granted" : "Premium access revoked" });
      setPremiumDialogUser(null);
      setPremiumReason("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update premium status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const fetchDependencies = async (userId: string) => {
    const response = await fetch(`/api/admin/users/${userId}/dependencies`, { credentials: 'include' });
    if (!response.ok) throw new Error("Failed to fetch dependencies");
    return response.json() as Promise<UserDependencies>;
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`, {
        confirm: true,
        reason,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supabase-users"] });
      toast({ title: "User deleted successfully" });
      setDeleteDialogUser(null);
      setDeleteDependencies(null);
      setDeleteReason("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete user", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleDeleteClick = async (user: EnhancedUser) => {
    setDeleteDialogUser(user);
    try {
      const deps = await fetchDependencies(user.id);
      setDeleteDependencies(deps);
    } catch (error) {
      toast({ title: "Failed to fetch user data", variant: "destructive" });
    }
  };

  const selectedUser = legacyUsers.find(u => u.id === selectedUserId);

  return (
    <div className="p-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create New User
            </CardTitle>
            <CardDescription>
              Create a Supabase Auth user who can log into the main app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email *</Label>
                  <Input
                    id="new-email"
                    data-testid="input-new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password *</Label>
                  <Input
                    id="new-password"
                    data-testid="input-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-display-name">Display Name</Label>
                <Input
                  id="new-display-name"
                  data-testid="input-new-display-name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-gender">Gender</Label>
                  <Select value={newGender} onValueChange={(v) => setNewGender(v as "M" | "F")}>
                    <SelectTrigger id="new-gender" data-testid="select-new-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-age">Age</Label>
                  <Input
                    id="new-age"
                    data-testid="input-new-age"
                    type="number"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    placeholder="30"
                    min={1}
                    max={120}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-height">Height (cm)</Label>
                  <Input
                    id="new-height"
                    data-testid="input-new-height"
                    type="number"
                    value={newHeight}
                    onChange={(e) => setNewHeight(e.target.value)}
                    placeholder="175"
                    min={50}
                    max={300}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-weight">Weight (kg)</Label>
                  <Input
                    id="new-weight"
                    data-testid="input-new-weight"
                    type="number"
                    step="0.1"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="70"
                    min={20}
                    max={500}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createUserMutation.isPending}
                data-testid="button-create-user"
              >
                {createUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Reset User Password
            </CardTitle>
            <CardDescription>
              Reset password for any Supabase Auth user
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  resetPasswordMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="select-user">Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="select-user" data-testid="select-user-for-reset">
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {legacyUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email} {user.displayName && `(${user.displayName})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedUser && (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <p><strong>Email:</strong> {selectedUser.email}</p>
                    {selectedUser.displayName && <p><strong>Name:</strong> {selectedUser.displayName}</p>}
                    <p><strong>Role:</strong> {selectedUser.role || 'client'}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New Password</Label>
                  <Input
                    id="reset-password"
                    data-testid="input-reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!selectedUserId || resetPasswordMutation.isPending}
                  data-testid="button-reset-password"
                >
                  {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reset Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Users
                </CardTitle>
                <CardDescription>
                  {usersData?.total || 0} registered users
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchUsers()}
                data-testid="button-refresh-users"
              >
                Refresh
              </Button>
            </div>
            
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    data-testid="input-user-search"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[140px]" data-testid="select-role-filter">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={premiumFilter} onValueChange={(v) => { setPremiumFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px]" data-testid="select-premium-filter">
                    <SelectValue placeholder="Premium Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="override">Admin Override</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No users found</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-3 rounded-md border bg-card"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium truncate">{user.email}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        {user.displayName && <span className="truncate">{user.displayName}</span>}
                        <Badge variant="secondary" className="text-xs">
                          {user.role || 'client'}
                        </Badge>
                        {user.isPremium && (
                          <Badge variant="default" className="text-xs bg-amber-500">
                            Premium
                          </Badge>
                        )}
                        {user.hasAdminOverride && (
                          <Badge variant="outline" className="text-xs border-purple-500 text-purple-600">
                            Override
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <div className="text-right text-sm text-muted-foreground hidden md:block">
                        <p>Created: {format(new Date(user.createdAt), 'MMM d, yyyy')}</p>
                        {user.lastSignIn && (
                          <p>Last: {format(new Date(user.lastSignIn), 'MMM d')}</p>
                        )}
                      </div>
                      <Button
                        variant={user.hasAdminOverride ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPremiumDialogUser(user)}
                        data-testid={`button-premium-${user.id}`}
                      >
                        {user.hasAdminOverride ? "Revoke" : "Grant"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(user)}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {usersData && usersData.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {usersData.page} of {usersData.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= usersData.totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!premiumDialogUser} onOpenChange={(open) => !open && setPremiumDialogUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {premiumDialogUser?.hasAdminOverride ? "Revoke Premium Access" : "Grant Premium Access"}
              </DialogTitle>
              <DialogDescription>
                {premiumDialogUser?.hasAdminOverride 
                  ? `Remove admin-granted premium from ${premiumDialogUser?.email}?`
                  : `Grant premium access to ${premiumDialogUser?.email}?`
                }
              </DialogDescription>
            </DialogHeader>
            {!premiumDialogUser?.hasAdminOverride && (
              <div className="space-y-2">
                <Label htmlFor="premium-reason">Reason (optional)</Label>
                <Input
                  id="premium-reason"
                  value={premiumReason}
                  onChange={(e) => setPremiumReason(e.target.value)}
                  placeholder="e.g., VIP customer, support case..."
                  data-testid="input-premium-reason"
                />
              </div>
            )}
            {premiumDialogUser?.hasAdminOverride && premiumDialogUser.adminOverrideDetails && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md space-y-1">
                <p><strong>Granted by:</strong> {premiumDialogUser.adminOverrideDetails.grantedBy || 'Admin'}</p>
                {premiumDialogUser.adminOverrideDetails.grantedAt && (
                  <p><strong>Granted at:</strong> {format(new Date(premiumDialogUser.adminOverrideDetails.grantedAt), 'MMM d, yyyy')}</p>
                )}
                {premiumDialogUser.adminOverrideDetails.reason && (
                  <p><strong>Reason:</strong> {premiumDialogUser.adminOverrideDetails.reason}</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPremiumDialogUser(null)}>
                Cancel
              </Button>
              <Button
                variant={premiumDialogUser?.hasAdminOverride ? "destructive" : "default"}
                disabled={premiumMutation.isPending}
                onClick={() => premiumDialogUser && premiumMutation.mutate({
                  userId: premiumDialogUser.id,
                  action: premiumDialogUser.hasAdminOverride ? 'revoke' : 'grant',
                  reason: premiumReason,
                })}
                data-testid="button-confirm-premium"
              >
                {premiumMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {premiumDialogUser?.hasAdminOverride ? "Revoke Premium" : "Grant Premium"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteDialogUser} onOpenChange={(open) => !open && setDeleteDialogUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete User
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteDialogUser?.email}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {deleteDependencies ? (
              <div className="space-y-3">
                <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                  <p className="font-medium">User Data:</p>
                  <p>Messages: {deleteDependencies.dependencies.messages}</p>
                  <p>Conversations: {deleteDependencies.dependencies.conversations}</p>
                  <p>Purchases: {deleteDependencies.dependencies.purchases}</p>
                  {deleteDependencies.dependencies.products > 0 && (
                    <p>Products: {deleteDependencies.dependencies.products}</p>
                  )}
                </div>
                {deleteDependencies.warnings.length > 0 && (
                  <div className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">
                    <p className="font-medium">Warnings:</p>
                    <ul className="list-disc list-inside">
                      {deleteDependencies.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="delete-reason">Reason (optional)</Label>
                  <Input
                    id="delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="e.g., User requested deletion..."
                    data-testid="input-delete-reason"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeleteDialogUser(null); setDeleteDependencies(null); }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending || !deleteDependencies}
                onClick={(e) => {
                  e.preventDefault();
                  if (deleteDialogUser) {
                    deleteMutation.mutate({ userId: deleteDialogUser.id, reason: deleteReason });
                  }
                }}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function VerificationTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: verificationRequests = [], isLoading, refetch } = useQuery<VerificationRequest[]>({
    queryKey: ["/api/admin/verification/requests", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      const response = await fetch(`/api/admin/verification/requests?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch verification requests");
      return response.json();
    },
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/verification/requests/count", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter });
      const response = await fetch(`/api/admin/verification/requests/count?${params}`, { credentials: "include" });
      if (!response.ok) return { count: 0 };
      return response.json();
    },
  });

  const { data: selectedDetails, isLoading: isLoadingDetails } = useQuery<VerificationDetails>({
    queryKey: ["/api/admin/verification/requests", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      const response = await fetch(`/api/admin/verification/requests/${selectedUserId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch details");
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ userId, decision, reason }: { userId: string; decision: 'verified' | 'rejected'; reason: string }) => {
      const response = await fetch(`/api/admin/verification/requests/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decision, reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Review failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification Updated",
        description: `Professional ${data.decision === 'verified' ? 'verified' : 'rejected'} successfully`,
      });
      setSelectedUserId(null);
      setReviewReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verification/requests"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getSignedUrlMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/admin/verification/documents/${docId}/signed-url`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get document URL");
      return response.json();
    },
    onSuccess: (data) => {
      window.open(data.signedUrl, "_blank");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to open document",
        variant: "destructive",
      });
    },
  });

  const totalPages = Math.ceil((countData?.count || 0) / pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'verified':
        return <Badge variant="outline" className="text-green-600 border-green-600"><BadgeCheck className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDocTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      certification: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      license: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      id_verification: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    };
    return <Badge className={colors[type] || colors.other}>{type.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5" />
                Professional Verification
              </CardTitle>
              <CardDescription>
                Review and approve professional verification requests
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-verification-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-verifications">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : verificationRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {statusFilter} verification requests found
            </div>
          ) : (
            <div className="space-y-4">
              {verificationRequests.map((request) => (
                <Card key={request.user_id} className="hover-elevate cursor-pointer" onClick={() => setSelectedUserId(request.user_id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCircle className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{request.professional_name}</div>
                          <div className="text-sm text-muted-foreground">{request.email}</div>
                          {request.headline && (
                            <div className="text-xs text-muted-foreground mt-1">{request.headline}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(request.verification_status)}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          {request.document_count} document{request.document_count !== 1 ? 's' : ''}
                        </div>
                        {request.verification_submitted_at && (
                          <div className="text-xs text-muted-foreground">
                            Submitted {format(new Date(request.verification_submitted_at), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({countData?.count || 0} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      data-testid="button-verification-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      data-testid="button-verification-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Dialog open={!!selectedUserId} onOpenChange={(open) => { if (!open) { setSelectedUserId(null); setReviewReason(""); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5" />
                  Verification Details
                </DialogTitle>
              </DialogHeader>

              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : selectedDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <div className="font-medium">{selectedDetails.professional_name}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <div className="font-medium">{selectedDetails.email}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <div>{getStatusBadge(selectedDetails.verification_status)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Experience</Label>
                      <div className="font-medium">{selectedDetails.experience_years ? `${selectedDetails.experience_years} years` : '-'}</div>
                    </div>
                  </div>

                  {selectedDetails.headline && (
                    <div>
                      <Label className="text-muted-foreground">Headline</Label>
                      <div>{selectedDetails.headline}</div>
                    </div>
                  )}

                  {selectedDetails.bio && (
                    <div>
                      <Label className="text-muted-foreground">Bio</Label>
                      <div className="text-sm">{selectedDetails.bio}</div>
                    </div>
                  )}

                  {selectedDetails.specialties && selectedDetails.specialties.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Specialties</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedDetails.specialties.map((s, i) => (
                          <Badge key={i} variant="secondary">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-muted-foreground">Documents ({selectedDetails.documents.length})</Label>
                    <div className="space-y-2 mt-2">
                      {selectedDetails.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">{doc.file_name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {getDocTypeBadge(doc.document_type)}
                                <span className="text-xs text-muted-foreground">
                                  {doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => getSignedUrlMutation.mutate(doc.id)}
                            disabled={getSignedUrlMutation.isPending}
                            data-testid={`button-view-document-${doc.id}`}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedDetails.verification_status === 'pending' && (
                    <div className="border-t pt-4 space-y-4">
                      <div>
                        <Label htmlFor="review-reason">Review Notes (required, min 10 characters)</Label>
                        <Textarea
                          id="review-reason"
                          placeholder="Provide reason for approval or rejection..."
                          value={reviewReason}
                          onChange={(e) => setReviewReason(e.target.value)}
                          className="mt-1"
                          data-testid="textarea-review-reason"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {reviewReason.trim().length}/10 characters minimum
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => reviewMutation.mutate({ userId: selectedUserId!, decision: 'rejected', reason: reviewReason })}
                          disabled={reviewReason.trim().length < 10 || reviewMutation.isPending}
                          data-testid="button-reject-verification"
                        >
                          {reviewMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                          Reject
                        </Button>
                        <Button
                          onClick={() => reviewMutation.mutate({ userId: selectedUserId!, decision: 'verified', reason: reviewReason })}
                          disabled={reviewReason.trim().length < 10 || reviewMutation.isPending}
                          data-testid="button-approve-verification"
                        >
                          {reviewMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <BadgeCheck className="w-4 h-4 mr-1" />}
                          Verify
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedDetails.verification_reviewed_at && (
                    <div className="border-t pt-4">
                      <Label className="text-muted-foreground">Review History</Label>
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm">
                          Reviewed by <span className="font-medium">{selectedDetails.reviewer_name || 'Admin'}</span>
                          {' on '}
                          {format(new Date(selectedDetails.verification_reviewed_at), 'MMM d, yyyy HH:mm')}
                        </div>
                        {selectedDetails.verification_notes && (
                          <div className="text-sm text-muted-foreground mt-1">
                            "{selectedDetails.verification_notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [actorTypeFilter, setActorTypeFilter] = useState<string>("");
  const [permissionFilter, setPermissionFilter] = useState<string>("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pageSize = 20;

  const { data: auditLogs = [], isLoading, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/admin/audit-log", page, eventTypeFilter, actorTypeFilter, permissionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      if (eventTypeFilter) params.append("event_type", eventTypeFilter);
      if (actorTypeFilter) params.append("actor_type", actorTypeFilter);
      if (permissionFilter) params.append("permission_slug", permissionFilter);
      
      const response = await fetch(`/api/admin/audit-log?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch audit log");
      return response.json();
    },
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/audit-log/count", eventTypeFilter, actorTypeFilter, permissionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (eventTypeFilter) params.append("event_type", eventTypeFilter);
      if (actorTypeFilter) params.append("actor_type", actorTypeFilter);
      if (permissionFilter) params.append("permission_slug", permissionFilter);
      
      const response = await fetch(`/api/admin/audit-log/count?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to count audit log");
      return response.json();
    },
  });

  const { data: permissions = [] } = useQuery<PermissionDefinition[]>({
    queryKey: ["/api/admin/permission-definitions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/permission-definitions", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const totalCount = countData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const eventTypeColors: Record<string, string> = {
    grant: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    revoke: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    transfer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    admin_override: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    policy_change: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    invitation_accept: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    request_approve: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    request_deny: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  };

  const actorTypeColors: Record<string, string> = {
    client: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    professional: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    admin: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    system: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  const clearFilters = () => {
    setEventTypeFilter("");
    setActorTypeFilter("");
    setPermissionFilter("");
    setPage(1);
  };

  const hasFilters = eventTypeFilter || actorTypeFilter || permissionFilter;

  return (
    <div className="p-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileSearch className="w-5 h-5" />
                <CardTitle>Permission Audit Log</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  data-testid="button-refresh-audit-log"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              Track all permission changes including grants, revokes, and transfers. 
              {totalCount > 0 && ` Showing ${auditLogs.length} of ${totalCount} entries.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filters:</span>
              </div>
              <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-event-type-filter">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grant">Grant</SelectItem>
                  <SelectItem value="revoke">Revoke</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="admin_override">Admin Override</SelectItem>
                  <SelectItem value="policy_change">Policy Change</SelectItem>
                  <SelectItem value="invitation_accept">Invitation Accept</SelectItem>
                  <SelectItem value="request_approve">Request Approve</SelectItem>
                  <SelectItem value="request_deny">Request Deny</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actorTypeFilter} onValueChange={(v) => { setActorTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-actor-type-filter">
                  <SelectValue placeholder="Actor Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <Select value={permissionFilter} onValueChange={(v) => { setPermissionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]" data-testid="select-permission-filter">
                  <SelectValue placeholder="Permission" />
                </SelectTrigger>
                <SelectContent>
                  {permissions.map(p => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {hasFilters ? "No audit log entries match the current filters." : "No audit log entries yet."}
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 hover-elevate cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                    data-testid={`audit-entry-${entry.id}`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={eventTypeColors[entry.event_type] || "bg-gray-100"}>
                          {entry.event_type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className={actorTypeColors[entry.actor_type] || ""}>
                          {entry.actor_type}
                        </Badge>
                        {entry.permission_name && (
                          <Badge variant="secondary">{entry.permission_name}</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy HH:mm:ss")}
                      </span>
                    </div>
                    
                    <div className="mt-2 text-sm">
                      <span className="font-medium">{entry.actor_name}</span>
                      <span className="text-muted-foreground"> {entry.event_type}ed permission</span>
                      {entry.target_client_name && (
                        <span className="text-muted-foreground"> for client <span className="font-medium text-foreground">{entry.target_client_name}</span></span>
                      )}
                      {entry.target_professional_name && (
                        <span className="text-muted-foreground"> (pro: {entry.target_professional_name})</span>
                      )}
                    </div>

                    {expandedRow === entry.id && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {entry.reason && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Reason:</span>
                            <p className="text-sm mt-1">{entry.reason}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {entry.previous_state && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Previous State:</span>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                {JSON.stringify(entry.previous_state, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.new_state && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">New State:</span>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                {JSON.stringify(entry.new_state, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Metadata:</span>
                            <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          <span>ID: {entry.id}</span>
                          {entry.target_relationship_id && (
                            <span className="ml-4">Relationship: {entry.target_relationship_id}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  const { toast } = useToast();
  const [clientSearch, setClientSearch] = useState("");
  const [proSearch, setProSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
  const [selectedPro, setSelectedPro] = useState<UserProfile | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [reason, setReason] = useState("");
  const [disconnectReason, setDisconnectReason] = useState("");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState<Relationship | null>(null);

  const { data: clients = [] } = useQuery<UserProfile[]>({
    queryKey: ["/api/admin/users/clients", clientSearch],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/clients?search=${encodeURIComponent(clientSearch)}&limit=20`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: clientSearch.length >= 2,
  });

  const { data: professionals = [] } = useQuery<UserProfile[]>({
    queryKey: ["/api/admin/users/professionals", proSearch],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/professionals?search=${encodeURIComponent(proSearch)}&limit=20`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: proSearch.length >= 2,
  });

  const { data: presets = [] } = useQuery<PermissionPreset[]>({
    queryKey: ["/api/admin/permission-presets"],
    queryFn: async () => {
      const response = await fetch("/api/admin/permission-presets", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: relationships = [], refetch: refetchRelationships } = useQuery<Relationship[]>({
    queryKey: ["/api/admin/relationships"],
    queryFn: async () => {
      const response = await fetch("/api/admin/relationships?limit=50", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const forceConnectMutation = useMutation({
    mutationFn: async (data: { client_id: string; professional_id: string; preset_id?: string; reason: string }) => {
      const response = await fetch("/api/admin/force-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to force connect");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: `Connection ${data.action}: ${data.client_name} - ${data.professional_name}` });
      setSelectedClient(null);
      setSelectedPro(null);
      setSelectedPreset("");
      setReason("");
      refetchRelationships();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const forceDisconnectMutation = useMutation({
    mutationFn: async (data: { relationship_id: string; reason: string }) => {
      const response = await fetch("/api/admin/force-disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to force disconnect");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: `Disconnected: ${data.client_name} - ${data.professional_name}` });
      setShowDisconnectDialog(null);
      setDisconnectReason("");
      refetchRelationships();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleConnect = () => {
    if (!selectedClient || !selectedPro) return;
    if (reason.trim().length < 10) {
      toast({ title: "Reason must be at least 10 characters", variant: "destructive" });
      return;
    }
    forceConnectMutation.mutate({
      client_id: selectedClient.id,
      professional_id: selectedPro.id,
      preset_id: selectedPreset && selectedPreset !== "none" ? selectedPreset : undefined,
      reason: reason.trim(),
    });
  };

  const handleDisconnect = () => {
    if (!showDisconnectDialog) return;
    if (disconnectReason.trim().length < 10) {
      toast({ title: "Reason must be at least 10 characters", variant: "destructive" });
      return;
    }
    forceDisconnectMutation.mutate({
      relationship_id: showDisconnectDialog.id,
      reason: disconnectReason.trim(),
    });
  };

  return (
    <div className="p-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Force Connect
            </CardTitle>
            <CardDescription>Create an admin-initiated professional-client connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                <Input
                  placeholder="Search clients by name or email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  data-testid="input-client-search"
                />
                {clients.length > 0 && !selectedClient && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                    {clients.map(c => (
                      <div
                        key={c.id}
                        className="p-2 hover:bg-muted cursor-pointer"
                        onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                      >
                        <div className="font-medium">{c.full_name || c.display_name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedClient && (
                  <div className="flex items-center justify-between mt-2 p-2 border rounded-md bg-muted/50">
                    <div>
                      <div className="font-medium">{selectedClient.full_name || selectedClient.display_name}</div>
                      <div className="text-xs text-muted-foreground">{selectedClient.email}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label>Professional</Label>
                <Input
                  placeholder="Search professionals by name or email..."
                  value={proSearch}
                  onChange={(e) => setProSearch(e.target.value)}
                  data-testid="input-professional-search"
                />
                {professionals.length > 0 && !selectedPro && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                    {professionals.map(p => (
                      <div
                        key={p.id}
                        className="p-2 hover:bg-muted cursor-pointer"
                        onClick={() => { setSelectedPro(p); setProSearch(""); }}
                      >
                        <div className="font-medium">{p.full_name || p.display_name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedPro && (
                  <div className="flex items-center justify-between mt-2 p-2 border rounded-md bg-muted/50">
                    <div>
                      <div className="font-medium">{selectedPro.full_name || selectedPro.display_name}</div>
                      <div className="text-xs text-muted-foreground">{selectedPro.email}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPro(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Permission Preset (optional)</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger data-testid="select-preset">
                  <SelectValue placeholder="Select a preset to apply..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset</SelectItem>
                  {presets.filter(p => p.is_active).map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (required, min 10 characters)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're creating this connection..."
                data-testid="textarea-connect-reason"
              />
              <div className="text-xs text-muted-foreground mt-1">{reason.trim().length}/10 characters</div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={!selectedClient || !selectedPro || reason.trim().length < 10 || forceConnectMutation.isPending}
              data-testid="button-force-connect"
            >
              {forceConnectMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Force Connect
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Active Relationships
            </CardTitle>
            <CardDescription>Manage existing professional-client connections</CardDescription>
          </CardHeader>
          <CardContent>
            {relationships.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No active relationships</div>
            ) : (
              <div className="space-y-2">
                {relationships.map(rel => (
                  <div key={rel.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rel.client?.full_name || rel.client?.display_name || "Unknown"}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="font-medium">{rel.professional?.full_name || rel.professional?.display_name || "Unknown"}</span>
                        {rel.forced_by_admin && <Badge variant="secondary">Admin-created</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created {format(new Date(rel.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { setShowDisconnectDialog(rel); setDisconnectReason(""); }}
                      data-testid={`button-disconnect-${rel.id}`}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!showDisconnectDialog} onOpenChange={(open) => { if (!open) setShowDisconnectDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Force Disconnect</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will terminate the connection between{" "}
                <strong>{showDisconnectDialog?.client?.full_name}</strong> and{" "}
                <strong>{showDisconnectDialog?.professional?.full_name}</strong> and revoke all active permissions.
              </p>
              <div>
                <Label>Reason (required, min 10 characters)</Label>
                <Textarea
                  value={disconnectReason}
                  onChange={(e) => setDisconnectReason(e.target.value)}
                  placeholder="Explain why you're terminating this connection..."
                  data-testid="textarea-disconnect-reason"
                />
                <div className="text-xs text-muted-foreground mt-1">{disconnectReason.trim().length}/10 characters</div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDisconnectDialog(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnectReason.trim().length < 10 || forceDisconnectMutation.isPending}
                  data-testid="button-confirm-disconnect"
                >
                  {forceDisconnectMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Disconnect
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function AvatarCard({ 
  avatar, 
  onToggle, 
  onDelete 
}: { 
  avatar: PresetAvatar; 
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`relative group ${!avatar.is_active ? 'opacity-50' : ''}`} data-testid={`avatar-card-${avatar.id}`}>
      <div className="aspect-square rounded-lg overflow-hidden border-2 border-border bg-muted">
        {avatar.image_url ? (
          <img 
            src={avatar.image_url} 
            alt={avatar.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UserCircle className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <p className="text-xs text-center mt-1 truncate" title={avatar.name}>{avatar.name}</p>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="secondary" className="w-6 h-6" data-testid={`button-avatar-menu-${avatar.id}`}>
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggle(!avatar.is_active)} data-testid={`button-toggle-avatar-${avatar.id}`}>
              {avatar.is_active ? (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onDelete} 
              className="text-destructive"
              data-testid={`button-delete-avatar-${avatar.id}`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!avatar.is_active && (
        <Badge variant="secondary" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs">
          Inactive
        </Badge>
      )}
    </div>
  );
}

function AvatarsTab() {
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadGender, setUploadGender] = useState<'female' | 'male' | 'neutral'>('female');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  const { data: avatars = [], isLoading, refetch } = useQuery<PresetAvatar[]>({
    queryKey: ["/api/admin/preset-avatars"],
    queryFn: async () => {
      const response = await fetch("/api/admin/preset-avatars", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch avatars");
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/admin/preset-avatars", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to upload avatar");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Avatar uploaded successfully" });
      refetch();
      closeUploadDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await fetch(`/api/admin/preset-avatars/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!response.ok) throw new Error("Failed to update avatar");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Avatar updated" });
      refetch();
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/preset-avatars/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete avatar");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Avatar deleted" });
      refetch();
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !uploadName.trim()) {
      toast({ title: "Please provide name and select an image", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("name", uploadName.trim());
    formData.append("gender", uploadGender);
    uploadMutation.mutate(formData);
  };

  const closeUploadDialog = () => {
    setIsUploadDialogOpen(false);
    setUploadName("");
    setUploadGender("female");
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const femaleAvatars = avatars.filter(a => a.gender === 'female');
  const maleAvatars = avatars.filter(a => a.gender === 'male');
  const neutralAvatars = avatars.filter(a => a.gender === 'neutral');

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Preset Avatars</CardTitle>
              <CardDescription>Manage avatar options available to users</CardDescription>
            </div>
            <Button onClick={() => setIsUploadDialogOpen(true)} data-testid="button-add-avatar">
              <Plus className="w-4 h-4 mr-2" />
              Add Avatar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : avatars.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No preset avatars yet</p>
              <p className="text-sm">Click "Add Avatar" to upload one</p>
            </div>
          ) : (
            <div className="space-y-6">
              {femaleAvatars.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Female ({femaleAvatars.length})</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {femaleAvatars.map(avatar => (
                      <AvatarCard 
                        key={avatar.id} 
                        avatar={avatar} 
                        onToggle={(active) => toggleActiveMutation.mutate({ id: avatar.id, is_active: active })}
                        onDelete={() => deleteMutation.mutate(avatar.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {maleAvatars.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Male ({maleAvatars.length})</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {maleAvatars.map(avatar => (
                      <AvatarCard 
                        key={avatar.id} 
                        avatar={avatar} 
                        onToggle={(active) => toggleActiveMutation.mutate({ id: avatar.id, is_active: active })}
                        onDelete={() => deleteMutation.mutate(avatar.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {neutralAvatars.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Neutral ({neutralAvatars.length})</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {neutralAvatars.map(avatar => (
                      <AvatarCard 
                        key={avatar.id} 
                        avatar={avatar} 
                        onToggle={(active) => toggleActiveMutation.mutate({ id: avatar.id, is_active: active })}
                        onDelete={() => deleteMutation.mutate(avatar.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <Dialog open={isUploadDialogOpen} onOpenChange={(open) => !open && closeUploadDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Preset Avatar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="avatar-name">Name</Label>
                <Input
                  id="avatar-name"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g., Fitness Enthusiast"
                  data-testid="input-avatar-name"
                />
              </div>
              <div>
                <Label htmlFor="avatar-gender">Gender</Label>
                <Select value={uploadGender} onValueChange={(v) => setUploadGender(v as any)}>
                  <SelectTrigger data-testid="select-avatar-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Image</Label>
                <div className="mt-2">
                  {previewUrl ? (
                    <div className="relative w-24 h-24 mx-auto">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-24 h-24 rounded-full object-cover border-2 border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 w-6 h-6"
                        onClick={() => {
                          setSelectedFile(null);
                          if (previewUrl) URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                        }}
                        data-testid="button-remove-preview"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-avatar"
                    >
                      <UserCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to select an image</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { fileInputRef.current = el; }}
                    onChange={handleFileSelect}
                    data-testid="input-avatar-file"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeUploadDialog} data-testid="button-cancel-avatar">
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || !uploadName.trim() || uploadMutation.isPending}
                  data-testid="button-upload-avatar"
                >
                  {uploadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Upload
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminLayout>
      <RouterSwitch>
        <Route path="/admin/users/list" component={UsersListTab} />
        <Route path="/admin/users/avatars" component={AvatarsTab} />
        <Route path="/admin/users/verification" component={VerificationTab} />
        <Route path="/admin/users/connections" component={ConnectionsTab} />
        <Route path="/admin/users/audit" component={AuditTab} />
        <Route path="/admin/users">
          <Redirect to="/admin/users/list" />
        </Route>
      </RouterSwitch>
    </AdminLayout>
  );
}
