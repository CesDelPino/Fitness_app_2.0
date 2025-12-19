import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface TextFallbackDialogProps {
  open: boolean;
  onClose: () => void;
  onAnalyze: (description: string) => void;
  onManualEntry: () => void;
  isAnalyzing: boolean;
  mealType: string;
}

export default function TextFallbackDialog({
  open,
  onClose,
  onAnalyze,
  onManualEntry,
  isAnalyzing,
  mealType,
}: TextFallbackDialogProps) {
  const [description, setDescription] = useState("");

  const handleAnalyze = () => {
    if (description.trim()) {
      onAnalyze(description.trim());
    }
  };

  const handleClose = () => {
    setDescription("");
    onClose();
  };

  const handleManualEntry = () => {
    setDescription("");
    onManualEntry();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Describe Your Food</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tell us what you ate and we'll analyze it for you.
          </p>

          <div>
            <Label htmlFor="fallback-description">Food Description</Label>
            <Textarea
              id="fallback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 150g grilled salmon with lemon and steamed broccoli"
              className="mt-2 min-h-24"
              disabled={isAnalyzing}
              data-testid="input-fallback-description"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleAnalyze}
            disabled={!description.trim() || isAnalyzing}
            className="w-full h-14 text-lg"
            data-testid="button-analyze-fallback"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Find / Analyse Food"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isAnalyzing}
            className="w-full"
            data-testid="button-cancel-fallback"
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleManualEntry}
            disabled={isAnalyzing}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 pt-2"
            data-testid="link-manual-entry"
          >
            Still not right? Enter macros manually
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
