import { Flame } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ProgressRingProps {
  eaten: number;
  target: number;
}

export default function ProgressRing({
  eaten,
  target,
}: ProgressRingProps) {
  const percentage = Math.min((eaten / target) * 100, 100);
  const remaining = Math.max(target - eaten, 0);

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${percentage * 2.64} 264`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums" data-testid="text-calories-eaten">
              {eaten.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">
              of {target.toLocaleString()} kcal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="w-4 h-4" />
          <span data-testid="text-calories-remaining">{remaining.toLocaleString()} kcal remaining</span>
        </div>
      </div>
    </Card>
  );
}
