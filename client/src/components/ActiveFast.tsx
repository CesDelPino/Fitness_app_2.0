import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActiveFastProps {
  fast: {
    id: string;
    startTime: string;
    endTime: string;
  };
  onEnd: () => void;
  onTimerExpired?: () => void;
  isPending: boolean;
}

export default function ActiveFast({ fast, onEnd, onTimerExpired, isPending }: ActiveFastProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const endTime = new Date(fast.endTime);
      const startTime = new Date(fast.startTime);

      if (now >= endTime) {
        setTimeRemaining("Completed!");
        setProgress(100);
        if (!hasCompleted && !isPending) {
          setHasCompleted(true);
          if (onTimerExpired) {
            onTimerExpired();
          } else {
            onEnd();
          }
        }
        return;
      }

      const totalDuration = endTime.getTime() - startTime.getTime();
      const elapsed = now.getTime() - startTime.getTime();
      const remaining = endTime.getTime() - now.getTime();

      const progressPercent = (elapsed / totalDuration) * 100;
      setProgress(Math.min(progressPercent, 100));

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [fast, hasCompleted, isPending, onEnd, onTimerExpired]);

  const startTime = new Date(fast.startTime);
  const endTime = new Date(fast.endTime);
  const formattedStart = startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const formattedEnd = endTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="border-primary bg-card" data-testid="card-active-fast">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Active Fast
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEnd}
          disabled={isPending}
          data-testid="button-end-fast"
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div
            className="text-3xl font-bold text-primary"
            data-testid="text-time-remaining"
          >
            {timeRemaining}
          </div>
          <p className="text-sm text-muted-foreground mt-1">remaining</p>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" data-testid="progress-fast" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formattedStart}</span>
            <span>{formattedEnd}</span>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Started {formatDistanceToNow(startTime, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
