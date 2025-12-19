import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Plus, Coffee, Sun, Sunset, Cookie, Clock, StopCircle, Droplets } from "lucide-react";
import { formatVolumeShort, getWaterPresets, type VolumeUnit } from "@shared/units";

interface AddMealDropdownProps {
  onSelectMeal: (mealType: string) => void;
  onStartFast: () => void;
  onEndFast?: () => void;
  isFasting?: boolean;
  isEndingFast?: boolean;
  onAddWater?: (amountMl: number) => void;
  waterTotal?: number;
  waterTarget?: number;
  volumeUnit?: VolumeUnit;
  isAddingWater?: boolean;
}

export default function AddMealDropdown({
  onSelectMeal,
  onStartFast,
  onEndFast,
  isFasting = false,
  isEndingFast = false,
  onAddWater,
  waterTotal = 0,
  waterTarget = 2000,
  volumeUnit = "ml",
  isAddingWater = false,
}: AddMealDropdownProps) {
  const [mealOpen, setMealOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);

  const handleSelectMeal = (mealType: string) => {
    setMealOpen(false);
    onSelectMeal(mealType);
  };

  const handleAddWater = (amountMl: number) => {
    setWaterOpen(false);
    onAddWater?.(amountMl);
  };

  const waterPresets = getWaterPresets(volumeUnit);

  return (
    <div className="flex flex-wrap gap-2">
      <DropdownMenu open={mealOpen} onOpenChange={setMealOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="flex-1 min-w-[100px] h-14 text-base gap-2"
            data-testid="button-add-meal"
          >
            <Plus className="w-5 h-5" />
            Food
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="center">
          <DropdownMenuItem
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => handleSelectMeal("Breakfast")}
            data-testid="menu-item-breakfast"
          >
            <Coffee className="w-5 h-5" />
            <span className="text-base">Breakfast</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => handleSelectMeal("Lunch")}
            data-testid="menu-item-lunch"
          >
            <Sun className="w-5 h-5" />
            <span className="text-base">Lunch</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => handleSelectMeal("Dinner")}
            data-testid="menu-item-dinner"
          >
            <Sunset className="w-5 h-5" />
            <span className="text-base">Dinner</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => handleSelectMeal("Snacks")}
            data-testid="menu-item-snacks"
          >
            <Cookie className="w-5 h-5" />
            <span className="text-base">Snacks</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu open={waterOpen} onOpenChange={setWaterOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="flex-1 min-w-[100px] h-14 text-base gap-2 bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
            disabled={isAddingWater}
            data-testid="button-add-water"
          >
            <Droplets className="w-5 h-5" />
            <span className="flex flex-col items-start leading-tight">
              <span>+H2O</span>
              {waterTotal > 0 && (
                <span className="text-xs opacity-80">
                  {formatVolumeShort(waterTotal, volumeUnit)}
                </span>
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" align="center">
          {waterPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => handleAddWater(preset.ml)}
              data-testid={`water-preset-${preset.label}`}
            >
              <Droplets className="w-5 h-5 text-blue-500" />
              <span className="text-base">+{preset.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {isFasting ? (
        <Button
          size="lg"
          variant="destructive"
          className="flex-1 min-w-[100px] h-14 text-base gap-2"
          onClick={onEndFast}
          disabled={isEndingFast}
          data-testid="button-end-fast"
        >
          <StopCircle className="w-5 h-5" />
          End
        </Button>
      ) : (
        <Button
          size="lg"
          className="flex-1 min-w-[100px] h-14 text-base gap-2 bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
          onClick={onStartFast}
          data-testid="button-start-fast"
        >
          <Clock className="w-5 h-5" />
          Fast
        </Button>
      )}
    </div>
  );
}
