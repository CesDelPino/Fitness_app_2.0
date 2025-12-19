import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2, Pencil, Plus, Info } from "lucide-react";
import { NutrientPanel } from "@/components/NutrientPanel";
import type { NutrientSnapshot } from "@/lib/nutrient-utils";

export interface FoodLogItem {
  id: string;
  time: string;
  foodName: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  sugar?: number | null;
  mealType?: string;
  quantityValue?: number;
  quantityUnit?: string;
  caloriesPerUnit?: number | null;
  proteinPerUnit?: number | null;
  carbsPerUnit?: number | null;
  fatPerUnit?: number | null;
  fiberPerUnit?: number | null;
  sugarPerUnit?: number | null;
  nutrientSnapshot?: any | null;
}

function formatNutrient(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(0)}g`;
}

interface MealSectionProps {
  mealType: string;
  logs: FoodLogItem[];
  onDelete: (id: string) => void;
  onEdit?: (log: FoodLogItem) => void;
  onAdd?: (mealType: string) => void;
  defaultExpanded?: boolean;
}

interface FoodLogRowProps {
  log: FoodLogItem;
  onEdit?: (log: FoodLogItem) => void;
  onDelete: (id: string) => void;
}

function FoodLogRow({ log, onEdit, onDelete }: FoodLogRowProps) {
  const [showNutrients, setShowNutrients] = useState(false);
  
  const hasNutrientSnapshot = log.nutrientSnapshot?.nutrients && 
    Array.isArray(log.nutrientSnapshot.nutrients) && 
    log.nutrientSnapshot.nutrients.length > 0;

  const snapshot: NutrientSnapshot | null = hasNutrientSnapshot
    ? log.nutrientSnapshot as NutrientSnapshot
    : null;

  return (
    <div data-testid={`food-log-${log.id}`}>
      <div
        className="p-4 flex items-start justify-between gap-4 hover-elevate cursor-pointer"
        onClick={() => onEdit?.(log)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm text-muted-foreground tabular-nums">{log.time}</p>
            <h4 className="font-medium truncate">{log.foodName}</h4>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            P: {formatNutrient(log.protein)} • C: {formatNutrient(log.carbs)} • F: {formatNutrient(log.fat)}
            {(log.fiber !== null && log.fiber !== undefined) && (
              <span> • Fiber: {formatNutrient(log.fiber)}</span>
            )}
            {(log.sugar !== null && log.sugar !== undefined) && (
              <span> • Sugar: {formatNutrient(log.sugar)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold tabular-nums" data-testid={`text-calories-${log.id}`}>
            {log.calories}
          </p>
          {hasNutrientSnapshot && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setShowNutrients(!showNutrients);
              }}
              data-testid={`button-nutrients-${log.id}`}
            >
              <Info className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(log);
            }}
            data-testid={`button-edit-${log.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(log.id);
            }}
            data-testid={`button-delete-${log.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {showNutrients && snapshot && (
        <div className="px-4 pb-4 -mt-2">
          <div className="bg-muted/50 rounded-lg p-3">
            <NutrientPanel
              snapshot={snapshot}
              expanded
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MealSection({
  mealType,
  logs,
  onDelete,
  onEdit,
  onAdd,
  defaultExpanded = true,
}: MealSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const hasAnyProtein = logs.some(log => log.protein !== null && log.protein !== undefined);
  const hasAnyCarbs = logs.some(log => log.carbs !== null && log.carbs !== undefined);
  const hasAnyFat = logs.some(log => log.fat !== null && log.fat !== undefined);
  const hasFiber = logs.some(log => log.fiber !== null && log.fiber !== undefined);
  const hasSugar = logs.some(log => log.sugar !== null && log.sugar !== undefined);
  
  const totalProtein = hasAnyProtein ? logs.reduce((sum, log) => sum + (log.protein ?? 0), 0) : null;
  const totalCarbs = hasAnyCarbs ? logs.reduce((sum, log) => sum + (log.carbs ?? 0), 0) : null;
  const totalFat = hasAnyFat ? logs.reduce((sum, log) => sum + (log.fat ?? 0), 0) : null;
  const totalFiber = hasFiber ? logs.reduce((sum, log) => sum + (log.fiber ?? 0), 0) : null;
  const totalSugar = hasSugar ? logs.reduce((sum, log) => sum + (log.sugar ?? 0), 0) : null;

  return (
    <Card data-testid={`meal-section-${mealType.toLowerCase()}`}>
      <CardHeader
        className="cursor-pointer hover-elevate active-elevate-2 p-4"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`button-toggle-${mealType.toLowerCase()}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="text-lg font-semibold">{mealType}</h3>
              <p className="text-sm text-muted-foreground">
                {logs.length} {logs.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums" data-testid={`text-${mealType.toLowerCase()}-calories`}>
              {totalCalories}
            </p>
            <p className="text-xs text-muted-foreground">cal</p>
          </div>
        </div>
        {!isExpanded && logs.length > 0 && (hasAnyProtein || hasAnyCarbs || hasAnyFat || hasFiber || hasSugar) && (
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {hasAnyProtein && <span>P: {formatNutrient(totalProtein)}</span>}
            {hasAnyProtein && hasAnyCarbs && <span>•</span>}
            {hasAnyCarbs && <span>C: {formatNutrient(totalCarbs)}</span>}
            {(hasAnyProtein || hasAnyCarbs) && hasAnyFat && <span>•</span>}
            {hasAnyFat && <span>F: {formatNutrient(totalFat)}</span>}
            {(hasAnyProtein || hasAnyCarbs || hasAnyFat) && hasFiber && <span>•</span>}
            {hasFiber && <span>Fiber: {formatNutrient(totalFiber)}</span>}
            {(hasAnyProtein || hasAnyCarbs || hasAnyFat || hasFiber) && hasSugar && <span>•</span>}
            {hasSugar && <span>Sugar: {formatNutrient(totalSugar)}</span>}
          </div>
        )}
      </CardHeader>

      {isExpanded && logs.length > 0 && (
        <CardContent className="p-0">
          <div className="divide-y">
            {logs.map((log) => (
              <FoodLogRow
                key={log.id}
                log={log}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
          {onAdd && (
            <div className="p-4 border-t">
              <button
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onAdd(mealType)}
                data-testid={`button-add-${mealType.toLowerCase()}-food`}
              >
                <Plus className="w-4 h-4" />
                Add food
              </button>
            </div>
          )}
        </CardContent>
      )}

      {isExpanded && logs.length === 0 && (
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">No items logged yet</p>
          {onAdd && (
            <button
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
              onClick={() => onAdd(mealType)}
              data-testid={`button-add-${mealType.toLowerCase()}-food`}
            >
              <Plus className="w-4 h-4" />
              Add food
            </button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
