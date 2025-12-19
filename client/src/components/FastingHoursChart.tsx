import { Card } from "@/components/ui/card";

export interface FastingData {
  date: string;
  hours: number;
}

interface FastingHoursChartProps {
  data: FastingData[];
}

export default function FastingHoursChart({ data }: FastingHoursChartProps) {
  if (data.length === 0) {
    return null;
  }

  const maxHours = Math.max(...data.map((d) => d.hours), 24);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium mb-4">Fasting Hours Over Time</h3>

      <div className="h-56 relative" data-testid="chart-fasting-hours">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          {[...Array(5)].map((_, i) => (
            <line
              key={i}
              x1="0"
              y1={i * 40 + 20}
              x2="400"
              y2={i * 40 + 20}
              stroke="hsl(var(--border))"
              strokeWidth="1"
              strokeOpacity="0.3"
            />
          ))}

          {data.map((point, i) => {
            const barWidth = Math.min(380 / data.length - 8, 40);
            const x = (i * 380) / data.length + 10;
            const barHeight = (point.hours / maxHours) * 160;
            const y = 180 - barHeight;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="hsl(var(--chart-1))"
                  rx="4"
                >
                  <title>{`${point.date}: ${point.hours.toFixed(1)}h`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between items-center text-xs text-muted-foreground mt-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-chart-1" />
            <span>Fast Duration</span>
          </div>
        </div>
      </div>

      {data.length <= 14 && (
        <div className="grid gap-1 mt-4" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((point, i) => (
            <div key={i} className="text-xs text-center text-muted-foreground truncate">
              {point.date}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
