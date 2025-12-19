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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, Lock } from "lucide-react";
import type { PermissionDefinition, RelationshipPermissions } from "@/lib/permissions";
import type { PermissionSlug } from "@shared/supabase-types";

interface ExclusiveTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: PermissionDefinition | null;
  currentHolder: RelationshipPermissions | null;
  newHolder: RelationshipPermissions | null;
  onConfirm: (slug: PermissionSlug) => void;
  isPending?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ExclusiveTransferDialog({
  open,
  onOpenChange,
  permission,
  currentHolder,
  newHolder,
  onConfirm,
  isPending,
}: ExclusiveTransferDialogProps) {
  if (!permission || !currentHolder || !newHolder) {
    return null;
  }
  
  const handleConfirm = () => {
    onConfirm(permission.slug);
    onOpenChange(false);
  };
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Transfer Exclusive Permission
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                <strong>{permission.display_name}</strong> is an exclusive permission. 
                Only one professional can hold it at a time.
              </p>
              
              <div className="flex items-center justify-center gap-4 py-4">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-12 w-12 mb-2">
                    <AvatarFallback>
                      {getInitials(currentHolder.professional_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {currentHolder.professional_name}
                  </span>
                  <span className="text-xs text-destructive">Will lose access</span>
                </div>
                
                <ArrowRight className="h-6 w-6 text-muted-foreground shrink-0" />
                
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-12 w-12 mb-2">
                    <AvatarFallback>
                      {getInitials(newHolder.professional_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {newHolder.professional_name}
                  </span>
                  <span className="text-xs text-primary">Will gain access</span>
                </div>
              </div>
              
              <p className="text-sm">
                {permission.description}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            disabled={isPending} 
            data-testid="button-cancel-transfer"
            className="min-h-12"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isPending}
            data-testid="button-confirm-transfer"
            className="min-h-12"
          >
            Transfer Permission
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
