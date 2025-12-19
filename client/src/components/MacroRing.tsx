import { Card } from "@/components/ui/card";

interface MacroRingProps {
  label: string;
  current: number;
  target: number;
  color: string;
}

export default function MacroRing({ label, current, target, color }: MacroRingProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <Card className="p-4 text-center space-y-2" data-testid={`macro-ring-${label.toLowerCase()}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="relative w-16 h-16 mx-auto">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle 
            cx="50" 
            cy="50" 
            r="40" 
            fill="none" 
            stroke="hsl(var(--muted))" 
            strokeWidth="10" 
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${Math.min(percentage, 100) * 2.51} 251`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold tabular-nums" data-testid={`text-${label.toLowerCase()}-current`}>
            {Math.round(current)}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" data-testid={`text-${label.toLowerCase()}-target`}>{target}g</p>
    </Card>
  );
}
