import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface WeightDataPoint {
  date: string;
  weight: number;
}

interface WeightChartProps {
  data: WeightDataPoint[];
  unit?: "kg" | "lbs";
  range: "7" | "30" | "90";
  onRangeChange: (range: "7" | "30" | "90") => void;
}

export default function WeightChart({ data, unit = "kg", range, onRangeChange }: WeightChartProps) {

  const filteredData = data.slice(-Number(range));
  const maxWeight = Math.max(...filteredData.map((d) => d.weight));
  const minWeight = Math.min(...filteredData.map((d) => d.weight));
  const weightRange = maxWeight - minWeight || 10;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Weight Trend ({unit})</h3>
        <Tabs value={range} onValueChange={(v) => onRangeChange(v as "7" | "30" | "90")}>
          <TabsList>
            <TabsTrigger value="7" data-testid="tab-7-days">7 days</TabsTrigger>
            <TabsTrigger value="30" data-testid="tab-30-days">30 days</TabsTrigger>
            <TabsTrigger value="90" data-testid="tab-90-days">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="h-64 relative" data-testid="chart-weight">
        <svg className="w-full h-full" viewBox="0 0 450 200">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[...Array(5)].map((_, i) => {
            const yPos = i * 40 + 20;
            const weightValue = maxWeight - (i * weightRange / 4);
            return (
              <g key={i}>
                <line
                  x1="50"
                  y1={yPos}
                  x2="450"
                  y2={yPos}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
                <text
                  x="5"
                  y={yPos + 4}
                  fill="hsl(var(--muted-foreground))"
                  fontSize="11"
                  fontFamily="system-ui"
                >
                  {weightValue.toFixed(1)}
                </text>
              </g>
            );
          })}

          {filteredData.length > 1 && (
            <>
              <path
                d={filteredData
                  .map((point, i) => {
                    const x = (i / (filteredData.length - 1)) * 380 + 60;
                    const normalizedWeight =
                      ((point.weight - minWeight) / weightRange) * 160;
                    const y = 180 - normalizedWeight;
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                stroke="hsl(var(--chart-1))"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={`${filteredData
                  .map((point, i) => {
                    const x = (i / (filteredData.length - 1)) * 380 + 60;
                    const normalizedWeight =
                      ((point.weight - minWeight) / weightRange) * 160;
                    const y = 180 - normalizedWeight;
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")} L 440 180 L 60 180 Z`}
                fill="url(#gradient)"
              />

              {filteredData.map((point, i) => {
                const x = (i / (filteredData.length - 1)) * 380 + 60;
                const normalizedWeight =
                  ((point.weight - minWeight) / weightRange) * 160;
                const y = 180 - normalizedWeight;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="hsl(var(--chart-1))"
                    stroke="hsl(var(--background))"
                    strokeWidth="2"
                  >
                    <title>{`${point.date}: ${point.weight} ${unit}`}</title>
                  </circle>
                );
              })}
            </>
          )}
        </svg>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mt-4">
        {filteredData.length > 0 && (
          <>
            <span>{filteredData[0].date}</span>
            <span>{filteredData[filteredData.length - 1].date}</span>
          </>
        )}
      </div>
    </Card>
  );
}
