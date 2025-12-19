import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Briefcase, ArrowRight } from "lucide-react";
import { usePortalContext, PortalMode } from "@/context/PortalContext";
import { cn } from "@/lib/utils";

interface RoleCardProps {
  mode: PortalMode;
  title: string;
  description: string;
  icon: typeof Users;
  status: "active" | "pending_approval" | "suspended" | null;
  profileId: string | null;
  isSelected: boolean;
  isDisabled: boolean;
  isLoading: boolean;
  onSelect: () => void;
}

function RoleCard({
  mode,
  title,
  description,
  icon: Icon,
  status,
  isSelected,
  isDisabled,
  isLoading,
  onSelect,
}: RoleCardProps) {
  const statusBadge = () => {
    if (status === "pending_approval") {
      return (
        <Badge variant="secondary" className="text-xs">
          Pending Approval
        </Badge>
      );
    }
    if (status === "suspended") {
      return (
        <Badge variant="destructive" className="text-xs">
          Suspended
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card
      data-testid={`card-role-${mode}`}
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-primary",
        isDisabled && "opacity-50 cursor-not-allowed",
        !isDisabled && "hover-elevate"
      )}
      onClick={() => !isDisabled && !isLoading && onSelect()}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-6 w-6 text-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{title}</h3>
                {statusBadge()}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex items-center">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoleSelectorModal() {
  const {
    availableRoles,
    requiresRoleSelection,
    setPortalMode,
    isLoading,
  } = usePortalContext();

  const [selectedMode, setSelectedMode] = useState<PortalMode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!requiresRoleSelection || !availableRoles) {
    return null;
  }

  const handleSelectRole = async (mode: PortalMode, profileId: string | null) => {
    if (!profileId) return;
    
    setSelectedMode(mode);
    setIsSubmitting(true);
    
    try {
      await setPortalMode(mode, profileId);
    } catch (error) {
      console.error("Failed to set portal mode:", error);
    } finally {
      setIsSubmitting(false);
      setSelectedMode(null);
    }
  };

  const hasProRole = availableRoles.availableRoles.includes("pro");
  const hasClientRole = availableRoles.availableRoles.includes("client");
  const proDisabled = availableRoles.proProfileStatus !== "active";

  return (
    <Dialog open={requiresRoleSelection} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Choose Your Portal
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select how you'd like to use LOBA today. You can switch anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {hasProRole && (
            <RoleCard
              mode="pro"
              title="Professional Portal"
              description="Manage clients, create programs, and grow your business"
              icon={Briefcase}
              status={availableRoles.proProfileStatus}
              profileId={availableRoles.proProfileId}
              isSelected={selectedMode === "pro"}
              isDisabled={proDisabled || isSubmitting}
              isLoading={isSubmitting && selectedMode === "pro"}
              onSelect={() => handleSelectRole("pro", availableRoles.proProfileId)}
            />
          )}

          {hasClientRole && (
            <RoleCard
              mode="client"
              title="Client Portal"
              description="Track your health, workouts, and progress"
              icon={Users}
              status={availableRoles.clientProfileStatus}
              profileId={availableRoles.clientProfileId}
              isSelected={selectedMode === "client"}
              isDisabled={isSubmitting}
              isLoading={isSubmitting && selectedMode === "client"}
              onSelect={() => handleSelectRole("client", availableRoles.clientProfileId)}
            />
          )}
        </div>

        {proDisabled && hasProRole && (
          <p className="text-sm text-muted-foreground text-center">
            {availableRoles.proProfileStatus === "pending_approval" 
              ? "Your professional account is pending approval. You'll be notified once approved."
              : "Your professional account has been suspended. Please contact support."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PortalSwitcher() {
  const { mode, availableRoles, switchPortal, isLoading } = usePortalContext();

  if (!availableRoles || availableRoles.availableRoles.length <= 1) {
    return null;
  }

  const currentLabel = mode === "pro" ? "Professional" : "Client";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchPortal}
      disabled={isLoading}
      className="gap-2"
      data-testid="button-switch-portal"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <span className="text-sm text-muted-foreground">Portal:</span>
          <Badge variant="secondary">{currentLabel}</Badge>
        </>
      )}
    </Button>
  );
}
