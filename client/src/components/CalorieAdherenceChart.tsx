import { Card } from "@/components/ui/card";

export interface CalorieData {
  date: string;
  eaten: number;
  target: number;
}

interface CalorieAdherenceChartProps {
  data: CalorieData[];
}

export default function CalorieAdherenceChart({
  data,
}: CalorieAdherenceChartProps) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.eaten, d.target)));

  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-6">7-Day Calorie Adherence</h3>

      <div className="h-56 relative" data-testid="chart-adherence">
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
            const barWidth = 380 / data.length - 8;
            const x = (i * 380) / data.length + 10;
            const targetHeight = (point.target / maxValue) * 160;
            const eatenHeight = (point.eaten / maxValue) * 160;
            const targetY = 180 - targetHeight;
            const eatenY = 180 - eatenHeight;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={targetY}
                  width={barWidth}
                  height={targetHeight}
                  fill="hsl(var(--muted))"
                  rx="4"
                />
                <rect
                  x={x}
                  y={eatenY}
                  width={barWidth}
                  height={eatenHeight}
                  fill={
                    point.eaten > point.target
                      ? "hsl(var(--destructive))"
                      : "hsl(var(--chart-1))"
                  }
                  rx="4"
                >
                  <title>{`${point.date}: ${point.eaten} / ${point.target} cal`}</title>
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
            <span>Eaten</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <span>Target</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-4">
        {data.map((point, i) => (
          <div key={i} className="text-xs text-center text-muted-foreground">
            {point.date.split(" ")[1]}
          </div>
        ))}
      </div>
    </Card>
  );
}
