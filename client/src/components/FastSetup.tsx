import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, Calendar, AlertTriangle } from "lucide-react";

interface FastSetupProps {
  open: boolean;
  onClose: () => void;
  onStartFast: (endTime: Date) => void;
  isPending: boolean;
}

const EXTENDED_FAST_HOURS = 48;

export default function FastSetup({ open, onClose, onStartFast, isPending }: FastSetupProps) {
  const [mode, setMode] = useState<"duration" | "target">("duration");
  const [hours, setHours] = useState("16");
  const [minutes, setMinutes] = useState("0");
  const [targetDay, setTargetDay] = useState("today");
  const [targetHour, setTargetHour] = useState("12");
  const [targetMinute, setTargetMinute] = useState("00");
  const [targetPeriod, setTargetPeriod] = useState<"AM" | "PM">("PM");
  const [error, setError] = useState("");
  const [showExtendedFastWarning, setShowExtendedFastWarning] = useState(false);
  const [pendingEndTime, setPendingEndTime] = useState<Date | null>(null);

  const calculateEndTime = (): Date | null => {
    const now = new Date();
    
    if (mode === "duration") {
      const h = parseInt(hours) || 0;
      const m = parseInt(minutes) || 0;
      const totalMinutes = h * 60 + m;

      if (totalMinutes <= 0) {
        setError("Duration must be greater than 0");
        return null;
      }

      return new Date(now.getTime() + totalMinutes * 60 * 1000);
    } else {
      const hour = parseInt(targetHour);
      const minute = parseInt(targetMinute);
      let hour24 = hour;
      
      if (targetPeriod === "PM" && hour !== 12) {
        hour24 = hour + 12;
      } else if (targetPeriod === "AM" && hour === 12) {
        hour24 = 0;
      }

      const endTime = new Date();
      endTime.setHours(hour24, minute, 0, 0);

      if (targetDay === "tomorrow") {
        endTime.setDate(endTime.getDate() + 1);
      }

      if (endTime <= now) {
        setError("Target time must be in the future");
        return null;
      }

      return endTime;
    }
  };

  const handleSubmit = () => {
    setError("");
    const endTime = calculateEndTime();
    
    if (!endTime) return;

    const durationHours = (endTime.getTime() - Date.now()) / (1000 * 60 * 60);
    
    if (durationHours > EXTENDED_FAST_HOURS) {
      setPendingEndTime(endTime);
      setShowExtendedFastWarning(true);
      return;
    }

    onStartFast(endTime);
  };

  const handleConfirmExtendedFast = () => {
    if (pendingEndTime) {
      onStartFast(pendingEndTime);
    }
    setShowExtendedFastWarning(false);
    setPendingEndTime(null);
  };

  const handleCancelExtendedFast = () => {
    setShowExtendedFastWarning(false);
    setPendingEndTime(null);
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="dialog-fast-setup">
        <DialogHeader>
          <DialogTitle>Start a Fast</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "duration" | "target")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="duration" data-testid="tab-duration">
              <Clock className="w-4 h-4 mr-2" />
              Duration
            </TabsTrigger>
            <TabsTrigger value="target" data-testid="tab-target">
              <Calendar className="w-4 h-4 mr-2" />
              Until Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value="duration" className="space-y-4">
            <div className="space-y-2">
              <Label>Fast for</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="72"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Hours"
                    data-testid="input-duration-hours"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Hours</p>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="Minutes"
                    data-testid="input-duration-minutes"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minutes</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="target" className="space-y-4">
            <div className="space-y-2">
              <Label>Fast until</Label>
              <Select value={targetDay} onValueChange={setTargetDay}>
                <SelectTrigger data-testid="select-target-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={targetHour} onValueChange={setTargetHour}>
                  <SelectTrigger data-testid="select-target-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={targetMinute} onValueChange={setTargetMinute}>
                  <SelectTrigger data-testid="select-target-minute">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="00">00</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="45">45</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={targetPeriod} onValueChange={(v) => setTargetPeriod(v as "AM" | "PM")}>
                  <SelectTrigger data-testid="select-target-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-sm text-destructive" data-testid="text-error">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-start-fast">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Fasting"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showExtendedFastWarning} onOpenChange={setShowExtendedFastWarning}>
        <AlertDialogContent data-testid="dialog-extended-fast-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Medical Supervision Recommended
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                You are about to start a fast longer than 48 hours. Extended fasts of this duration 
                should only be undertaken with guidance from a healthcare provider.
              </p>
              <p className="font-medium">
                Please consult a doctor before attempting fasts over 48 hours, especially if you have 
                any medical conditions or are taking medications.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExtendedFast} data-testid="button-cancel-extended-fast">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExtendedFast} data-testid="button-confirm-extended-fast">
              I Understand, Start Fasting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
