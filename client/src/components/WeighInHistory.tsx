import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, TrendingDown, Minus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";

export interface WeighInRecord {
  id: string;
  date: string;
  weight: number;
  change?: number;
  notes?: string;
  measurements?: {
    waist?: number;
    hips?: number;
    bustChest?: number;
    thigh?: number;
    arm?: number;
    calf?: number;
    neck?: number;
  };
}

interface WeighInHistoryProps {
  records: WeighInRecord[];
  unit?: "kg" | "lbs";
  onDelete?: (id: string) => void;
}

export default function WeighInHistory({ records, unit = "lbs", onDelete }: WeighInHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { bodyMeasurements } = useUnitPreferences();
  const measurementUnit = bodyMeasurements.unit;

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No weigh-in history yet</p>
      </div>
    );
  }

  const hasMeasurements = (record: WeighInRecord) => {
    return record.measurements && Object.values(record.measurements).some(v => v !== undefined);
  };

  return (
    <div className="space-y-3" data-testid="list-weigh-ins">
      {records.map((record) => {
        const TrendIcon = record.change
          ? record.change > 0
            ? TrendingUp
            : record.change < 0
              ? TrendingDown
              : Minus
          : Minus;

        const trendColor = record.change
          ? record.change > 0
            ? "text-destructive"
            : record.change < 0
              ? "text-chart-1"
              : "text-muted-foreground"
          : "text-muted-foreground";

        const showMeasurements = hasMeasurements(record);
        const isExpanded = expandedId === record.id;

        return (
          <Card
            key={record.id}
            className="p-4"
            data-testid={`card-weigh-in-${record.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{record.date}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {record.change !== undefined && record.change !== 0 && (
                    <div className={`flex items-center gap-1 ${trendColor}`}>
                      <TrendIcon className="w-4 h-4" />
                      <span className="text-sm font-medium tabular-nums">
                        {Math.abs(record.change).toFixed(1)}
                      </span>
                    </div>
                  )}
                  <span className="text-2xl font-bold tabular-nums" data-testid={`text-weight-${record.id}`}>
                    {record.weight.toFixed(1)} {unit}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {showMeasurements && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                      data-testid={`button-expand-${record.id}`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(record.id)}
                      data-testid={`button-delete-${record.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {record.notes && (
              <p className="text-sm text-muted-foreground mb-2">{record.notes}</p>
            )}

            {showMeasurements && isExpanded && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm font-medium mb-3">Body Measurements</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {record.measurements!.waist && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waist:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.waist).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                  {record.measurements!.hips && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hips:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.hips).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                  {record.measurements!.bustChest && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bust/Chest:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.bustChest).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                  {record.measurements!.neck && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Neck:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.neck).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                  {record.measurements!.thigh && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thigh:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.thigh).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                  {record.measurements!.arm && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arm:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.arm).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                  {record.measurements!.calf && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Calf:</span>
                      <span className="font-medium tabular-nums">{bodyMeasurements.fromCm(record.measurements!.calf).toFixed(1)} {measurementUnit}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
