import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { PermissionCategoryAccordion } from "./PermissionCategoryAccordion";
import { ExclusiveTransferDialog } from "./ExclusiveTransferDialog";
import { 
  useClientPermissions, 
  useUpdatePermissions,
  findExclusiveHolder,
  type PermissionDefinition,
  type RelationshipPermissions,
} from "@/lib/permissions";
import { Shield, ChevronDown, ChevronUp, Lock, AlertCircle, RefreshCw } from "lucide-react";
import type { PermissionSlug } from "@shared/supabase-types";

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface PermissionManagerProps {
  relationshipId: string;
}

export function PermissionManager({ relationshipId }: PermissionManagerProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingPermissions, setPendingPermissions] = useState<Set<PermissionSlug>>(new Set());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{
    permission: PermissionDefinition;
    currentHolder: RelationshipPermissions;
    newHolder: RelationshipPermissions;
  } | null>(null);
  
  const { data, isLoading, isError, refetch } = useClientPermissions();
  const updateMutation = useUpdatePermissions(relationshipId);
  
  const currentRelationship = useMemo(() => {
    return data?.relationships.find(r => r.relationship_id === relationshipId);
  }, [data, relationshipId]);
  
  const definitions = data?.permission_definitions || [];
  const allRelationships = data?.relationships || [];
  const grantedPermissions = currentRelationship?.granted_permissions || [];
  
  const totalPermissions = definitions.length;
  const grantedCount = grantedPermissions.length;
  const exclusiveCount = definitions.filter(d => d.is_exclusive && grantedPermissions.includes(d.slug)).length;
  
  const handleGrant = async (slug: PermissionSlug) => {
    setPendingPermissions(prev => new Set(prev).add(slug));
    try {
      const result = await updateMutation.mutateAsync({ grant: [slug] });
      
      if (result.transfers && result.transfers.length > 0) {
        toast({
          title: "Permission transferred",
          description: `Permission transferred from ${result.transfers[0].previous_holder_name || 'previous holder'}`,
        });
      } else {
        toast({
          title: "Permission granted",
          description: `${currentRelationship?.professional_name} can now access this data.`,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConflict = errorMessage.includes('conflict') || errorMessage.includes('Permission conflict');
      
      toast({
        title: isConflict ? "Permission conflict" : "Failed to grant permission",
        description: isConflict 
          ? "Another change was made. Refreshing data..." 
          : "Please try again.",
        variant: "destructive",
      });
      
      if (isConflict) {
        refetch();
      }
    } finally {
      setPendingPermissions(prev => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  };
  
  const handleRevoke = async (slug: PermissionSlug) => {
    setPendingPermissions(prev => new Set(prev).add(slug));
    try {
      await updateMutation.mutateAsync({ revoke: [slug] });
      toast({
        title: "Permission revoked",
        description: `${currentRelationship?.professional_name} can no longer access this data.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConflict = errorMessage.includes('conflict');
      
      toast({
        title: isConflict ? "Permission conflict" : "Failed to revoke permission",
        description: isConflict 
          ? "Another change was made. Refreshing data..." 
          : "Please try again.",
        variant: "destructive",
      });
      
      if (isConflict) {
        refetch();
      }
    } finally {
      setPendingPermissions(prev => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  };
  
  const handleTransferRequest = (slug: PermissionSlug) => {
    const permission = definitions.find(d => d.slug === slug);
    const currentHolder = findExclusiveHolder(slug, allRelationships, relationshipId);
    
    if (permission && currentHolder && currentRelationship) {
      setPendingTransfer({
        permission,
        currentHolder,
        newHolder: currentRelationship,
      });
      setTransferDialogOpen(true);
    }
  };
  
  const handleConfirmTransfer = (slug: PermissionSlug) => {
    setTransferDialogOpen(false);
    setPendingTransfer(null);
    handleGrant(slug);
  };
  
  if (isLoading) {
    return (
      <Card data-testid="loading-permissions">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (isError) {
    return (
      <Card data-testid="error-permissions">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load permissions</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-permissions">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!currentRelationship) {
    return null;
  }
  
  return (
    <>
      <Card data-testid="permission-manager">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
            <Badge variant="secondary" data-testid="badge-permission-count">
              {grantedCount}/{totalPermissions}
            </Badge>
          </div>
          <CardDescription>
            Control what {currentRelationship.professional_name} can access
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <button 
            type="button"
            className="flex items-center justify-between w-full p-4 min-h-16 bg-muted/50 rounded-lg cursor-pointer hover-elevate text-left"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="permission-summary-card"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {getInitials(currentRelationship.professional_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm" data-testid="text-pro-name-permissions">{currentRelationship.professional_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span data-testid="text-granted-count">{grantedCount} permissions granted</span>
                  {exclusiveCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1" data-testid="text-exclusive-count">
                        <Lock className="h-3 w-3" />
                        {exclusiveCount} exclusive
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span className="p-2" data-testid="icon-toggle-permissions">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </span>
          </button>
          
          {isExpanded && (
            <PermissionCategoryAccordion
              definitions={definitions}
              grantedPermissions={grantedPermissions}
              professionalName={currentRelationship.professional_name}
              relationshipId={relationshipId}
              allRelationships={allRelationships}
              pendingPermissions={pendingPermissions}
              onGrant={handleGrant}
              onRevoke={handleRevoke}
              onTransfer={handleTransferRequest}
            />
          )}
        </CardContent>
      </Card>
      
      <ExclusiveTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        permission={pendingTransfer?.permission || null}
        currentHolder={pendingTransfer?.currentHolder || null}
        newHolder={pendingTransfer?.newHolder || null}
        onConfirm={handleConfirmTransfer}
        isPending={updateMutation.isPending}
      />
    </>
  );
}

interface PermissionsListProps {
  className?: string;
}

export function PermissionsList({ className }: PermissionsListProps) {
  const { data, isLoading, isError, refetch } = useClientPermissions();
  
  if (isLoading) {
    return (
      <div className={className} data-testid="loading-permissions-list">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (isError) {
    return (
      <Card className={className} data-testid="error-permissions-list">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load permissions</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-list">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const relationships = data?.relationships || [];
  
  if (relationships.length === 0) {
    return null;
  }
  
  return (
    <div className={className} data-testid="permissions-list">
      {relationships.map((rel) => (
        <PermissionManager
          key={rel.relationship_id}
          relationshipId={rel.relationship_id}
        />
      ))}
    </div>
  );
}
