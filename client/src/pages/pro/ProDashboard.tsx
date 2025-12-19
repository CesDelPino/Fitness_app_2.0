import { useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { Users, UserPlus, ChevronRight, Apple, Dumbbell, Scale, UserMinus, Activity, X, RefreshCw, Check, Clock, ClipboardList, Plus, Copy, Archive, LayoutTemplate, Sparkles, Edit3, MoreHorizontal, Trash2, FileCheck, AlertCircle, CalendarCheck, MessageSquare, ListChecks, Package } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useProRoutines, useCloneProRoutine, useArchiveProRoutine, useProReviewQueue, useApproveProRoutine, type RoutineBlueprint, type ReviewQueueItem } from "@/lib/pro-routines";
import { useProCheckInTemplates, useProCheckInSubmissions, useProCheckInAssignments, type CheckInTemplate, type CheckInSubmission, type CheckInAssignment } from "@/lib/pro-checkins";
import { ExpiredUpdatesNotification } from "@/components/programmes/ExpiredUpdatesNotification";
import AssignCheckInTemplateModal from "@/components/AssignCheckInTemplateModal";
import AssignCheckInToClientModal from "@/components/AssignCheckInToClientModal";
import AssignProgrammeModal from "@/components/AssignProgrammeModal";
import { SetNutritionTargetsModal } from "@/components/SetNutritionTargetsModal";
import { ClientQuickActions } from "@/components/ClientQuickActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountStatusCard } from "@/components/pro/AccountStatusCard";
import type { Relationship, Profile, ProfessionalRoleType, Invitation, WeighIn, FoodLog, WorkoutSession } from "@shared/supabase-types";

interface ClientHealthSummary {
  lastWeighIn: WeighIn | null;
  recentFoodCount: number;
  recentWorkoutCount: number;
  lastActivity: Date | null;
}

interface ClientWithRelationship {
  relationship: Relationship;
  profile: Profile | null;
  healthSummary: ClientHealthSummary | null;
}

type StatusFilter = "active" | "ended" | "all";

const roleLabels: Record<ProfessionalRoleType, string> = {
  nutritionist: "Nutritionist",
  trainer: "Trainer",
  coach: "Coach",
};

const roleIcons: Record<ProfessionalRoleType, typeof Apple> = {
  nutritionist: Apple,
  trainer: Dumbbell,
  coach: Scale,
};

const roleBadgeVariants: Record<ProfessionalRoleType, "default" | "secondary" | "outline"> = {
  nutritionist: "default",
  trainer: "secondary",
  coach: "outline",
};

const rolePermissions: Record<ProfessionalRoleType, { food: boolean; workouts: boolean; weight: boolean }> = {
  nutritionist: { food: true, workouts: false, weight: true },
  trainer: { food: false, workouts: true, weight: true },
  coach: { food: true, workouts: true, weight: true },
};

type RoutineFilter = "my" | "templates" | "archived";

const creationMethodLabels: Record<string, string> = {
  manual: "Manual",
  template: "From Template",
  ai_assisted: "AI Generated",
};

const creationMethodIcons: Record<string, typeof Edit3> = {
  manual: Edit3,
  template: LayoutTemplate,
  ai_assisted: Sparkles,
};

export default function ProDashboard() {
  const { user, professionalProfile } = useSupabaseAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("clients");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [clientToRemove, setClientToRemove] = useState<ClientWithRelationship | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<Invitation | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>("my");
  const [routineToArchive, setRoutineToArchive] = useState<RoutineBlueprint | null>(null);
  const [templateToAssign, setTemplateToAssign] = useState<CheckInTemplate | null>(null);
  const [clientForProgramme, setClientForProgramme] = useState<{ id: string; name: string } | null>(null);
  const [clientForCheckin, setClientForCheckin] = useState<{ id: string; name: string } | null>(null);
  const [clientForNutritionTargets, setClientForNutritionTargets] = useState<{ id: string; name: string } | null>(null);
  
  const { data: routines, isLoading: routinesLoading } = useProRoutines({
    includeTemplates: true,
    includeArchived: routineFilter === "archived",
  });
  
  const { data: reviewQueue, isLoading: reviewQueueLoading } = useProReviewQueue();
  
  const cloneRoutineMutation = useCloneProRoutine();
  const archiveRoutineMutation = useArchiveProRoutine();
  const approveRoutineMutation = useApproveProRoutine();

  const { data: checkInTemplates, isLoading: templatesLoading } = useProCheckInTemplates();
  const { data: checkInAssignments, isLoading: assignmentsLoading } = useProCheckInAssignments();
  const { data: pendingSubmissions, isLoading: submissionsLoading } = useProCheckInSubmissions({ 
    status: 'submitted', 
    limit: 10 
  });

  const { data: relationships, isLoading: relationshipsLoading } = useQuery({
    queryKey: ["pro-relationships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_client_relationships")
        .select("*")
        .eq("professional_id", user!.id)
        .order("accepted_at", { ascending: false });
      
      if (error) throw error;
      return data as Relationship[];
    },
    enabled: !!user,
  });

  const { data: pendingInvitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ["pro-invitations", professionalProfile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("professional_id", professionalProfile!.id)
        .eq("status", "pending");
      
      if (error) throw error;
      return data as Invitation[];
    },
    enabled: !!professionalProfile,
  });

  const { data: clientProfiles } = useQuery({
    queryKey: ["pro-client-profiles", relationships?.map(r => r.client_id)],
    queryFn: async () => {
      if (!relationships?.length) return [];
      const clientIds = relationships.map(r => r.client_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", clientIds);
      
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!relationships?.length,
  });

  const { data: clientHealthData } = useQuery({
    queryKey: ["pro-client-health-summaries", relationships?.map(r => r.client_id)],
    queryFn: async () => {
      if (!relationships?.length) return {};
      
      const clientIds = relationships.map(r => r.client_id);
      const summaries: Record<string, ClientHealthSummary> = {};
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const [weighInsResult, foodLogsResult, workoutsResult] = await Promise.all([
        supabase
          .from("weigh_ins")
          .select("*")
          .in("user_id", clientIds)
          .order("logged_at", { ascending: false }),
        supabase
          .from("food_logs")
          .select("id, user_id, logged_at")
          .in("user_id", clientIds)
          .gte("logged_at", sevenDaysAgoISO),
        supabase
          .from("workout_sessions")
          .select("id, user_id, logged_at")
          .in("user_id", clientIds)
          .gte("logged_at", sevenDaysAgoISO),
      ]);

      const weighIns = (weighInsResult.data || []) as WeighIn[];
      const foodLogs = (foodLogsResult.data || []) as Array<{ id: string; user_id: string; logged_at: string }>;
      const workouts = (workoutsResult.data || []) as Array<{ id: string; user_id: string; logged_at: string }>;

      for (const clientId of clientIds) {
        const clientWeighIns = weighIns.filter(w => w.user_id === clientId);
        const clientFoodLogs = foodLogs.filter(f => f.user_id === clientId);
        const clientWorkouts = workouts.filter(w => w.user_id === clientId);

        const allDates = [
          ...(clientWeighIns[0]?.logged_at ? [new Date(clientWeighIns[0].logged_at)] : []),
          ...(clientFoodLogs[0]?.logged_at ? [new Date(clientFoodLogs[0].logged_at)] : []),
          ...(clientWorkouts[0]?.logged_at ? [new Date(clientWorkouts[0].logged_at)] : []),
        ];

        summaries[clientId] = {
          lastWeighIn: clientWeighIns[0] || null,
          recentFoodCount: clientFoodLogs.length,
          recentWorkoutCount: clientWorkouts.length,
          lastActivity: allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null,
        };
      }

      return summaries;
    },
    enabled: !!relationships?.length,
  });

  const endRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      const { error } = await supabase
        .from("professional_client_relationships")
        .update({ 
          status: "ended" as const,
          ended_at: new Date().toISOString(),
        } as any)
        .eq("id", relationshipId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pro-relationships"] });
      toast({
        title: "Client Removed",
        description: "The client relationship has been ended.",
      });
      setClientToRemove(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove client",
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "expired" as const } as any)
        .eq("id", invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pro-invitations"] });
      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled.",
      });
      setInvitationToCancel(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    },
  });

  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);

  const resendInvitation = async (invitation: Invitation) => {
    if (!user) return;
    
    setResendingInviteId(invitation.id);
    
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newToken = Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
      
      const { data, error } = await supabase.rpc("create_invitation", {
        p_email: invitation.email,
        p_role_type: invitation.role_type,
        p_token: newToken,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Failed to create invitation");
      }
      
      const link = `${window.location.origin}/pro/accept?token=${newToken}`;
      
      await supabase
        .from("invitations")
        .update({ status: "expired" as const } as any)
        .eq("id", invitation.id);
      
      queryClient.invalidateQueries({ queryKey: ["pro-invitations"] });
      
      let clipboardSuccess = false;
      try {
        await navigator.clipboard.writeText(link);
        clipboardSuccess = true;
      } catch {
        clipboardSuccess = false;
      }
      
      if (clipboardSuccess) {
        setCopiedInviteId(invitation.id);
        setTimeout(() => setCopiedInviteId(null), 3000);
        toast({
          title: "New Invite Link Created",
          description: "A fresh invitation link has been copied to your clipboard.",
        });
      } else {
        setNewInviteLink(link);
      }
    } catch (err: any) {
      toast({
        title: "Resend Failed",
        description: err.message || "Failed to resend invitation",
        variant: "destructive",
      });
    } finally {
      setResendingInviteId(null);
    }
  };

  const filteredRelationships = relationships?.filter(r => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  }) || [];

  const activeRelationships = relationships?.filter(r => r.status === "active") || [];
  
  const clientsWithRelationships: ClientWithRelationship[] = filteredRelationships.map(rel => ({
    relationship: rel,
    profile: clientProfiles?.find(p => p.id === rel.client_id) || null,
    healthSummary: clientHealthData?.[rel.client_id] || null,
  }));

  const isLoading = relationshipsLoading || invitationsLoading;
  
  const filteredRoutines = (routines || []).filter(routine => {
    if (routineFilter === "my") {
      return routine.owner_type === "professional" && !routine.is_archived;
    }
    if (routineFilter === "templates") {
      return routine.owner_type === "platform" && routine.is_template;
    }
    if (routineFilter === "archived") {
      return routine.owner_type === "professional" && routine.is_archived;
    }
    return true;
  });
  
  const myRoutinesCount = (routines || []).filter(r => r.owner_type === "professional" && !r.is_archived).length;
  const templateCount = (routines || []).filter(r => r.owner_type === "platform" && r.is_template).length;
  const reviewQueueCount = reviewQueue?.length || 0;
  
  const handleCloneRoutine = async (routine: RoutineBlueprint) => {
    try {
      await cloneRoutineMutation.mutateAsync({ routineId: routine.id });
      toast({
        title: "Programme Cloned",
        description: `"${routine.name}" has been cloned to your library.`,
      });
    } catch (error: any) {
      toast({
        title: "Clone Failed",
        description: error.message || "Failed to clone programme",
        variant: "destructive",
      });
    }
  };
  
  const handleArchiveRoutine = async () => {
    if (!routineToArchive) return;
    try {
      await archiveRoutineMutation.mutateAsync(routineToArchive.id);
      toast({
        title: "Programme Archived",
        description: `"${routineToArchive.name}" has been archived.`,
      });
      setRoutineToArchive(null);
    } catch (error: any) {
      toast({
        title: "Archive Failed",
        description: error.message || "Failed to archive programme",
        variant: "destructive",
      });
    }
  };
  
  const handleApproveRoutine = async (routine: ReviewQueueItem) => {
    try {
      await approveRoutineMutation.mutateAsync({ routineId: routine.id });
      toast({
        title: "Programme Approved",
        description: `"${routine.name}" is now active and ready to assign.`,
      });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve programme",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-4xl">
      <ExpiredUpdatesNotification />
      
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
            Professional Dashboard
          </h1>
          <p className="text-muted-foreground">
            {professionalProfile?.headline || "Manage your clients and services"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pro/products">
            <Button variant="outline" data-testid="button-products">
              <Package className="w-4 h-4 mr-2" />
              Products
            </Button>
          </Link>
          {activeTab === "clients" && (
            <Link href="/pro/invite">
              <Button data-testid="button-invite-client">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Client
              </Button>
            </Link>
          )}
          {activeTab === "programmes" && (
            <Link href="/pro/programmes/new">
              <Button data-testid="button-new-programme">
                <Plus className="w-4 h-4 mr-2" />
                New Programme
              </Button>
            </Link>
          )}
          {activeTab === "review" && reviewQueueCount > 0 && (
            <Badge variant="secondary" data-testid="badge-review-count">
              {reviewQueueCount} pending
            </Badge>
          )}
          {activeTab === "check-ins" && (
            <Link href="/pro/check-ins/templates/new">
              <Button data-testid="button-new-check-in-template">
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clients" data-testid="tab-clients" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clients</span>
          </TabsTrigger>
          <TabsTrigger value="programmes" data-testid="tab-programmes" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Programmes</span>
          </TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review" className="gap-2">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Review</span>
            {reviewQueueCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {reviewQueueCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="check-ins" data-testid="tab-check-ins" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Check-Ins</span>
            {(pendingSubmissions?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {pendingSubmissions?.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="clients" className="space-y-6 mt-6">
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2 gap-1">
            <CardTitle className="text-xs md:text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold" data-testid="text-active-clients-count">
              {isLoading ? <Skeleton className="h-6 w-8 md:h-8 md:w-12" /> : activeRelationships.length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2 gap-1">
            <CardTitle className="text-xs md:text-sm font-medium">Pending Invites</CardTitle>
            <UserPlus className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold" data-testid="text-pending-invites-count">
              {isLoading ? <Skeleton className="h-6 w-8 md:h-8 md:w-12" /> : pendingInvitations?.length || 0}
            </div>
          </CardContent>
        </Card>
        
        <AccountStatusCard />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Your Clients</CardTitle>
              <CardDescription>
                View and manage your client relationships
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : clientsWithRelationships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {statusFilter === "active" 
                  ? "No active clients yet." 
                  : statusFilter === "ended" 
                    ? "No ended relationships."
                    : "No clients yet."}
              </p>
              {statusFilter === "active" && (
                <p className="text-sm mt-2">
                  <Link href="/pro/invite" className="text-primary hover:underline">
                    Invite your first client
                  </Link>{" "}
                  to get started.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {clientsWithRelationships.map(({ relationship, profile, healthSummary }) => {
                const RoleIcon = roleIcons[relationship.role_type];
                const isEnded = relationship.status === "ended";
                
                return (
                  <div 
                    key={relationship.id}
                    className={`p-3 rounded-lg border ${isEnded ? 'opacity-60' : ''}`}
                    data-testid={`card-client-${relationship.client_id}`}
                  >
                    <Link
                      href={isEnded ? "#" : `/pro/client/${relationship.client_id}`}
                      className={isEnded ? "pointer-events-none" : ""}
                    >
                      <div className={`flex items-center gap-3 ${!isEnded ? 'hover-elevate cursor-pointer' : ''}`}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                          <RoleIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">
                              {(() => {
                                const name = profile?.display_name || "Client";
                                const parts = name.trim().split(/\s+/);
                                if (parts.length > 1) {
                                  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
                                }
                                return name;
                              })()}
                            </p>
                            {!isEnded && (
                              <div 
                                className={`flex items-center gap-1 text-xs ${healthSummary?.lastActivity ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                                data-testid={`summary-activity-${relationship.client_id}`}
                              >
                                <Activity className={`h-3 w-3 ${healthSummary?.lastActivity ? 'text-green-500' : ''}`} />
                                <span>
                                  {healthSummary?.lastActivity 
                                    ? formatDistanceToNow(healthSummary.lastActivity, { addSuffix: true })
                                    : "No activity"}
                                </span>
                              </div>
                            )}
                            <Badge 
                              variant={roleBadgeVariants[relationship.role_type]}
                              className="text-xs"
                            >
                              {roleLabels[relationship.role_type]}
                            </Badge>
                            {isEnded && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Ended
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                    
                    {!isEnded && (
                      <div className="flex items-center gap-0.5 mt-2 ml-12">
                        <ClientQuickActions
                          clientId={relationship.client_id}
                          clientName={profile?.display_name || "Client"}
                          onAssignProgramme={() => setClientForProgramme({ 
                            id: relationship.client_id, 
                            name: profile?.display_name || "Client" 
                          })}
                          onSetMacros={() => setClientForNutritionTargets({
                            id: relationship.client_id,
                            name: profile?.display_name || "Client"
                          })}
                          onAssignCheckin={() => setClientForCheckin({ 
                            id: relationship.client_id, 
                            name: profile?.display_name || "Client" 
                          })}
                        />
                        <Link href={`/pro/client/${relationship.client_id}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-view-client-${relationship.client_id}`}>
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setClientToRemove({ relationship, profile, healthSummary })}
                          data-testid={`button-remove-client-${relationship.client_id}`}
                        >
                          <UserMinus className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingInvitations && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations waiting for client response
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => {
                const isExpiringSoon = new Date(invitation.expires_at).getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000;
                return (
                  <div 
                    key={invitation.id}
                    className="flex items-center justify-between p-4 rounded-lg border gap-4"
                    data-testid={`card-invitation-${invitation.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{invitation.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {roleLabels[invitation.role_type as ProfessionalRoleType]}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className={isExpiringSoon ? "text-orange-500" : ""}>
                            Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendInvitation(invitation)}
                        disabled={resendingInviteId === invitation.id}
                        title="Resend invite (creates new link)"
                        data-testid={`button-resend-invite-${invitation.id}`}
                      >
                        {resendingInviteId === invitation.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : copiedInviteId === invitation.id ? (
                          <>
                            <Check className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-green-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Resend
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setInvitationToCancel(invitation)}
                        title="Cancel invitation"
                        data-testid={`button-cancel-invite-${invitation.id}`}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>
        
        <TabsContent value="programmes" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">My Programmes</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-my-programmes-count">
                  {routinesLoading ? <Skeleton className="h-8 w-12" /> : myRoutinesCount}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-templates-count">
                  {routinesLoading ? <Skeleton className="h-8 w-12" /> : templateCount}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                <Link href="/pro/programmes/new?method=manual">
                  <Button size="sm" variant="outline" data-testid="button-quick-manual">
                    <Edit3 className="h-3 w-3 mr-1" />
                    Manual
                  </Button>
                </Link>
                <Link href="/pro/programmes/new?method=ai">
                  <Button size="sm" variant="outline" data-testid="button-quick-ai">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Build
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Programme Library</CardTitle>
                  <CardDescription>
                    Manage your training programmes
                  </CardDescription>
                </div>
                <Select value={routineFilter} onValueChange={(v) => setRoutineFilter(v as RoutineFilter)}>
                  <SelectTrigger className="w-[160px]" data-testid="select-routine-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="my">My Programmes</SelectItem>
                    <SelectItem value="templates">Templates</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {routinesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredRoutines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {routineFilter === "my" 
                      ? "No programmes yet." 
                      : routineFilter === "templates" 
                        ? "No templates available."
                        : "No archived programmes."}
                  </p>
                  {routineFilter === "my" && (
                    <p className="text-sm mt-2">
                      <Link href="/pro/programmes/new" className="text-primary hover:underline">
                        Create your first programme
                      </Link>{" "}
                      to get started.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRoutines.map((routine) => {
                    const MethodIcon = creationMethodIcons[routine.creation_method] || Edit3;
                    const isTemplate = routine.owner_type === "platform" && routine.is_template;
                    
                    return (
                      <div 
                        key={routine.id}
                        className="p-4 rounded-lg border"
                        data-testid={`card-routine-${routine.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                              {isTemplate ? (
                                <LayoutTemplate className="h-5 w-5" />
                              ) : (
                                <MethodIcon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{routine.name}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {isTemplate && (
                                  <Badge variant="secondary" className="text-xs">
                                    Template
                                  </Badge>
                                )}
                                {routine.is_archived && (
                                  <Badge variant="outline" className="text-xs">
                                    Archived
                                  </Badge>
                                )}
                                {routine.sessions_per_week && (
                                  <span className="text-xs text-muted-foreground">
                                    {routine.sessions_per_week} days/week
                                  </span>
                                )}
                                {routine.duration_weeks && (
                                  <span className="text-xs text-muted-foreground">
                                    {routine.duration_weeks} weeks
                                  </span>
                                )}
                              </div>
                              {routine.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                  {routine.description}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {isTemplate ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleCloneRoutine(routine)}
                                disabled={cloneRoutineMutation.isPending}
                                data-testid={`button-clone-${routine.id}`}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Use Template
                              </Button>
                            ) : (
                              <>
                                <Link href={`/pro/programmes/${routine.id}`}>
                                  <Button variant="ghost" size="icon" data-testid={`button-view-${routine.id}`}>
                                    <ChevronRight className="h-5 w-5" />
                                  </Button>
                                </Link>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-menu-${routine.id}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/pro/programmes/${routine.id}/edit`} className="cursor-pointer">
                                        <Edit3 className="h-4 w-4 mr-2" />
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCloneRoutine(routine)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => setRoutineToArchive(routine)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Archive
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="review" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Review Queue</CardTitle>
                  <CardDescription>
                    AI-generated programmes need review before they can be assigned to clients
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reviewQueueLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : !reviewQueue || reviewQueue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>All caught up!</p>
                  <p className="text-sm mt-2">
                    No programmes waiting for review.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewQueue.map((routine) => {
                    const exerciseCount = routine.latest_version?.exercises?.length || 0;
                    
                    return (
                      <div 
                        key={routine.id}
                        className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10"
                        data-testid={`card-review-${routine.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 shrink-0">
                              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{routine.name}</p>
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                                  Pending Review
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  AI Generated
                                </span>
                                <span>{exerciseCount} exercises</span>
                                {routine.sessions_per_week && (
                                  <span>{routine.sessions_per_week} days/week</span>
                                )}
                                {routine.duration_weeks && (
                                  <span>{routine.duration_weeks} weeks</span>
                                )}
                              </div>
                              {routine.goal && (
                                <Badge variant="secondary" className="mt-2">
                                  {routine.goal.name}
                                </Badge>
                              )}
                              {routine.description && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                  {routine.description}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <Link href={`/pro/programmes/${routine.id}/edit`}>
                              <Button 
                                variant="outline" 
                                size="sm"
                                data-testid={`button-review-edit-${routine.id}`}
                              >
                                <Edit3 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </Link>
                            <Button 
                              size="sm"
                              onClick={() => handleApproveRoutine(routine)}
                              disabled={approveRoutineMutation.isPending}
                              data-testid={`button-approve-${routine.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">About the Review Process</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                AI-generated programmes are created in draft status and must be reviewed before assignment.
              </p>
              <p>
                During review, you can edit exercises, adjust sets/reps, modify rest periods, and fine-tune 
                weight targets to match your client's needs.
              </p>
              <p>
                Once approved, the programme becomes active and can be assigned to any of your clients.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="check-ins" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <ListChecks className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-templates-count">
                  {templatesLoading ? <Skeleton className="h-8 w-12" /> : checkInTemplates?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">check-in forms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pending-submissions-count">
                  {submissionsLoading ? <Skeleton className="h-8 w-12" /> : pendingSubmissions?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">submissions to review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/pro/check-ins/templates/new">
                  <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-new-template">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Check-In Templates</CardTitle>
                  <CardDescription>
                    Create and manage check-in forms for your clients
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !checkInTemplates?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No check-in templates yet</p>
                  <p className="text-sm">Create a template to start collecting weekly updates from your clients</p>
                  <Link href="/pro/check-ins/templates/new">
                    <Button className="mt-4" data-testid="button-create-first-template">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Template
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {checkInTemplates.map((template) => {
                    const assignedCount = checkInAssignments?.filter(
                      a => a.template_id === template.id && a.is_active
                    ).length || 0;
                    
                    return (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                            <ListChecks className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-template-name-${template.id}`}>
                              {template.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {template.questions_count || 0} questions · {template.cadence}
                              {assignedCount > 0 && ` · ${assignedCount} client${assignedCount !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={template.active_version_id ? "default" : "secondary"}>
                            {template.active_version_id ? "Published" : "Draft"}
                          </Badge>
                          {template.active_version_id && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setTemplateToAssign(template)}
                              data-testid={`button-assign-template-${template.id}`}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}
                          <Link href={`/pro/check-ins/templates/${template.id}`}>
                            <Button variant="ghost" size="icon" data-testid={`button-edit-template-${template.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Recent Submissions</CardTitle>
                  <CardDescription>
                    Client check-ins awaiting your review
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {submissionsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !pendingSubmissions?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No pending submissions</p>
                  <p className="text-sm">Client check-ins will appear here when submitted</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {(submission.client?.display_name || submission.client?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-submission-client-${submission.id}`}>
                            {submission.client?.display_name || submission.client?.email || "Client"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Week of {format(new Date(submission.week_start), "MMM d")} · 
                            Submitted {submission.submitted_at ? formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true }) : "pending"}
                          </p>
                        </div>
                      </div>
                      <Link href={`/pro/check-ins/submissions/${submission.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-review-submission-${submission.id}`}>
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">About Check-Ins</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Weekly check-ins help you stay connected with your clients and track their progress.
              </p>
              <p>
                Create custom templates with questions tailored to each client's needs. 
                Clients receive automatic reminders and their health metrics are auto-populated.
              </p>
              <p>
                Premium feature: AI-powered analysis highlights key insights and suggests responses.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!routineToArchive} onOpenChange={(open) => !open && setRoutineToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Programme</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive{" "}
              <strong>{routineToArchive?.name || "this programme"}</strong>?
              Archived programmes can still be viewed but won't appear in your active library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveRoutine}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-archive"
            >
              {archiveRoutineMutation.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clientToRemove} onOpenChange={(open) => !open && setClientToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end your relationship with{" "}
              <strong>{clientToRemove?.profile?.display_name || "this client"}</strong>?
              This will revoke your access to their health data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToRemove && endRelationshipMutation.mutate(clientToRemove.relationship.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {endRelationshipMutation.isPending ? "Removing..." : "Remove Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!invitationToCancel} onOpenChange={(open) => !open && setInvitationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{" "}
              <strong>{invitationToCancel?.email}</strong>?
              They will no longer be able to use this link to connect with you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-invite">Keep Invitation</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToCancel && cancelInvitationMutation.mutate(invitationToCancel.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-cancel-invite"
            >
              {cancelInvitationMutation.isPending ? "Cancelling..." : "Cancel Invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!newInviteLink} onOpenChange={(open) => !open && setNewInviteLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Invitation Created</DialogTitle>
            <DialogDescription>
              Share this link with your client. They can use it to sign up and connect with you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input 
              value={newInviteLink || ""} 
              readOnly 
              className="font-mono text-sm"
              data-testid="input-new-invite-link"
            />
            <Button
              onClick={async () => {
                if (newInviteLink) {
                  try {
                    await navigator.clipboard.writeText(newInviteLink);
                    toast({
                      title: "Copied!",
                      description: "Link copied to clipboard.",
                    });
                  } catch {
                    toast({
                      title: "Copy failed",
                      description: "Please select and copy the link manually.",
                      variant: "destructive",
                    });
                  }
                }
              }}
              data-testid="button-copy-new-link"
            >
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewInviteLink(null)} data-testid="button-close-link-dialog">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {templateToAssign && (
        <AssignCheckInTemplateModal
          open={!!templateToAssign}
          onClose={() => setTemplateToAssign(null)}
          template={templateToAssign}
        />
      )}

      {clientForProgramme && (
        <AssignProgrammeModal
          open={!!clientForProgramme}
          onClose={() => setClientForProgramme(null)}
          clientId={clientForProgramme.id}
          clientName={clientForProgramme.name}
        />
      )}

      {clientForCheckin && (
        <AssignCheckInToClientModal
          open={!!clientForCheckin}
          onClose={() => setClientForCheckin(null)}
          clientId={clientForCheckin.id}
          clientName={clientForCheckin.name}
        />
      )}

      {clientForNutritionTargets && (
        <SetNutritionTargetsModal
          open={!!clientForNutritionTargets}
          onClose={() => setClientForNutritionTargets(null)}
          clientId={clientForNutritionTargets.id}
          clientName={clientForNutritionTargets.name}
        />
      )}
    </div>
  );
}
