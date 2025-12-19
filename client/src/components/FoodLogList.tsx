import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FoodLogItem {
  id: string;
  time: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodLogListProps {
  logs: FoodLogItem[];
  onDelete: (id: string) => void;
}

export default function FoodLogList({ logs, onDelete }: FoodLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No food logged today</p>
        <p className="text-sm mt-2">Use the quick actions above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="list-food-logs">
      {logs.map((log) => (
        <Card
          key={log.id}
          className="p-4 flex items-center justify-between gap-4"
          data-testid={`card-food-log-${log.id}`}
        >
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">{log.time}</span>
              <span className="text-lg font-bold tabular-nums" data-testid={`text-calories-${log.id}`}>
                {log.calories} cal
              </span>
            </div>
            <div className="font-medium mb-2" data-testid={`text-food-name-${log.id}`}>
              {log.foodName}
            </div>
            <div className="text-sm text-muted-foreground">
              P: {log.protein}g | C: {log.carbs}g | F: {log.fat}g
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(log.id)}
            data-testid={`button-delete-${log.id}`}
            className="shrink-0"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </Card>
      ))}
    </div>
  );
}
