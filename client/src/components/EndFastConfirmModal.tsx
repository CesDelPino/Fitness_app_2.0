import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, UtensilsCrossed } from "lucide-react";

interface EndFastConfirmModalProps {
  open: boolean;
  trigger: "manual" | "food_logging" | null;
  duration: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function EndFastConfirmModal({
  open,
  trigger,
  duration,
  isPending,
  onConfirm,
  onCancel,
}: EndFastConfirmModalProps) {
  const isManual = trigger === "manual";
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent data-testid="dialog-end-fast-confirm">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {isManual ? (
                <Clock className="w-8 h-8 text-primary" />
              ) : (
                <UtensilsCrossed className="w-8 h-8 text-primary" />
              )}
            </div>
          </div>
          <DialogTitle className="text-center" data-testid="text-confirm-title">
            {isManual ? "End your fast early?" : "You're currently fasting"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isManual ? (
              <>
                You've been fasting for <span className="font-semibold text-foreground">{duration}</span>.
                <br />
                Are you sure you want to end it now?
              </>
            ) : (
              <>
                You've been fasting for <span className="font-semibold text-foreground">{duration}</span>.
                <br />
                Would you like to end your fast?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="w-full"
            data-testid="button-confirm-end-fast"
          >
            {isPending ? "Ending..." : "Yes, end fast"}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="w-full"
            data-testid="button-cancel-end-fast"
          >
            {isManual ? "No, continue fasting" : "No, keep fasting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
