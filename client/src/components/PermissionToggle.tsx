import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
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
import type { PermissionDefinition, RelationshipPermissions } from "@/lib/permissions";
import type { PermissionSlug } from "@shared/supabase-types";

interface PermissionToggleProps {
  permission: PermissionDefinition;
  isGranted: boolean;
  professionalName: string;
  isPending: boolean;
  currentHolder?: RelationshipPermissions | null;
  onGrant: (slug: PermissionSlug) => void;
  onRevoke: (slug: PermissionSlug) => void;
  onTransfer: (slug: PermissionSlug) => void;
}

export function PermissionToggle({
  permission,
  isGranted,
  professionalName,
  isPending,
  currentHolder,
  onGrant,
  onRevoke,
  onTransfer,
}: PermissionToggleProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showGrantConfirm, setShowGrantConfirm] = useState(false);
  
  const isExclusive = permission.is_exclusive;
  const hasOtherHolder = isExclusive && currentHolder && !isGranted;
  
  const handleToggle = (checked: boolean) => {
    if (isPending) return;
    
    if (checked) {
      if (hasOtherHolder) {
        onTransfer(permission.slug);
      } else {
        setShowGrantConfirm(true);
      }
    } else {
      setShowRevokeConfirm(true);
    }
  };
  
  const handleConfirmGrant = () => {
    setShowGrantConfirm(false);
    onGrant(permission.slug);
  };
  
  const handleConfirmRevoke = () => {
    setShowRevokeConfirm(false);
    onRevoke(permission.slug);
  };
  
  return (
    <>
      <div 
        className="flex items-center justify-between py-3 px-1"
        data-testid={`permission-toggle-${permission.slug}`}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <Label 
              htmlFor={`switch-${permission.slug}`}
              className="font-medium cursor-pointer"
            >
              {permission.display_name}
            </Label>
            {isExclusive && (
              <Badge variant="outline" className="text-xs shrink-0">
                <Lock className="h-3 w-3 mr-1" />
                Exclusive
              </Badge>
            )}
          </div>
          {permission.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {permission.description}
            </p>
          )}
          {hasOtherHolder && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Currently held by {currentHolder.professional_name}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0 min-h-12">
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Switch
            id={`switch-${permission.slug}`}
            checked={isGranted}
            onCheckedChange={handleToggle}
            disabled={isPending}
            className="data-[state=checked]:bg-primary h-6 w-11"
            data-testid={`switch-${permission.slug}`}
          />
        </div>
      </div>
      
      <AlertDialog open={showGrantConfirm} onOpenChange={setShowGrantConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Grant Permission</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow <strong>{professionalName}</strong> to {permission.description?.toLowerCase() || permission.display_name.toLowerCase()}.
              {isExclusive && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  This is an exclusive permission. Only one professional can hold it at a time.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="button-cancel-grant" className="min-h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGrant} data-testid="button-confirm-grant" className="min-h-12">
              Grant Permission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Permission</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{professionalName}</strong> will no longer be able to {permission.description?.toLowerCase() || permission.display_name.toLowerCase()}.
              {isExclusive && (
                <span className="block mt-2">
                  This will allow another professional to request this permission.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="button-cancel-revoke" className="min-h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRevoke} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-12"
              data-testid="button-confirm-revoke"
            >
              Revoke Permission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
