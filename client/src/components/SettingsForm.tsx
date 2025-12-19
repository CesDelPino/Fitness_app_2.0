import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export interface UserProfile {
  heightCm: number;
  currentWeightKg: number;
  birthdate: string;
  gender: "M" | "F";
  activityMultiplier: number;
  preferredUnitSystem: "metric" | "imperial";
  macroInputType: "percentage" | "grams";
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  manualCalorieTarget: number | null;
  dailyCalorieTarget?: number;
  showBmiTape: boolean;
  unitBodyWeight: string | null;
  unitBodyMeasurements: string | null;
  unitExerciseWeight: string | null;
  unitCardioDistance: string | null;
  unitFoodWeight: string | null;
  unitFoodVolume: string | null;
}

interface SettingsFormProps {
  initialData?: UserProfile;
  onSave: (data: UserProfile) => void;
}

const activityLevels = [
  { value: 1.2, label: "Sedentary (little or no exercise)" },
  { value: 1.375, label: "Lightly active (1-3 days/week)" },
  { value: 1.55, label: "Moderately active (3-5 days/week)" },
  { value: 1.725, label: "Very active (6-7 days/week)" },
  { value: 1.9, label: "Extra active (physical job + exercise)" },
];

export default function SettingsForm({
  initialData = {
    heightCm: 178,
    currentWeightKg: 84,
    birthdate: "1994-01-15",
    gender: "M",
    activityMultiplier: 1.55,
    preferredUnitSystem: "metric" as "metric" | "imperial",
    macroInputType: "percentage" as "percentage" | "grams",
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    manualCalorieTarget: null,
    showBmiTape: true,
    unitBodyWeight: null,
    unitBodyMeasurements: null,
    unitExerciseWeight: null,
    unitCardioDistance: null,
    unitFoodWeight: null,
    unitFoodVolume: null,
  },
  onSave,
}: SettingsFormProps) {
  const [profile, setProfile] = useState<UserProfile>(initialData);
  const [isMetric, setIsMetric] = useState(profile.preferredUnitSystem === "metric");
  const [macroPercentages, setMacroPercentages] = useState({ protein: 40, carbs: 30, fat: 30 });

  useEffect(() => {
    setProfile(initialData);
    setIsMetric(initialData.preferredUnitSystem === "metric");
    
    if (initialData.macroInputType === "percentage" && initialData.proteinTargetG != null && initialData.carbsTargetG != null && initialData.fatTargetG != null) {
      const age = initialData.birthdate ? (() => {
        const today = new Date();
        const birth = new Date(initialData.birthdate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      })() : 30;
      
      let bmrCalc = 0;
      if (initialData.gender === "M") {
        bmrCalc = Math.round(10 * initialData.currentWeightKg + 6.25 * initialData.heightCm - 5 * age + 5);
      } else {
        bmrCalc = Math.round(10 * initialData.currentWeightKg + 6.25 * initialData.heightCm - 5 * age - 161);
      }
      
      const tdeeCalc = bmrCalc * initialData.activityMultiplier;
      const targetCalories = initialData.manualCalorieTarget || tdeeCalc;
      if (targetCalories > 0) {
        let proteinPct = Math.round((initialData.proteinTargetG * 4 / targetCalories) * 100);
        let carbsPct = Math.round((initialData.carbsTargetG * 4 / targetCalories) * 100);
        let fatPct = Math.round((initialData.fatTargetG * 9 / targetCalories) * 100);
        
        const total = proteinPct + carbsPct + fatPct;
        if (total !== 100) {
          const diff = 100 - total;
          proteinPct += diff;
        }
        
        setMacroPercentages({ protein: proteinPct, carbs: carbsPct, fat: fatPct });
        
        const normalizedProteinG = (proteinPct / 100) * targetCalories / 4;
        const normalizedCarbsG = (carbsPct / 100) * targetCalories / 4;
        const normalizedFatG = (fatPct / 100) * targetCalories / 9;
        setProfile({
          ...initialData,
          proteinTargetG: normalizedProteinG,
          carbsTargetG: normalizedCarbsG,
          fatTargetG: normalizedFatG,
        });
      }
    }
  }, [initialData.birthdate, initialData.heightCm, initialData.gender, initialData.currentWeightKg, initialData.activityMultiplier, initialData.preferredUnitSystem, initialData.macroInputType, initialData.proteinTargetG, initialData.carbsTargetG, initialData.fatTargetG, initialData.manualCalorieTarget]);

  const calculateAge = (birthdate: string): number => {
    if (!birthdate) return 30;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const calculateBMR = () => {
    const { currentWeightKg, heightCm, birthdate, gender } = profile;
    
    if (!currentWeightKg || !heightCm || !birthdate) return 0;
    
    const age = calculateAge(birthdate);

    if (gender === "M") {
      return Math.round(10 * currentWeightKg + 6.25 * heightCm - 5 * age + 5);
    } else {
      return Math.round(10 * currentWeightKg + 6.25 * heightCm - 5 * age - 161);
    }
  };

  const bmr = calculateBMR();
  const tdee = bmr > 0 ? Math.round(bmr * profile.activityMultiplier) : 0;

  const displayHeight = isMetric 
    ? profile.heightCm 
    : profile.heightCm / 2.54;

  const handleHeightChange = (value: number) => {
    const heightCm = isMetric ? value : value * 2.54;
    setProfile({ ...profile, heightCm });
  };

  const toggleUnitSystem = (checked: boolean) => {
    setIsMetric(checked);
    setProfile({ ...profile, preferredUnitSystem: checked ? "metric" : "imperial" });
  };

  const toggleMacroInputType = (checked: boolean) => {
    const newType = checked ? "grams" : "percentage";
    
    if (newType === "grams") {
      const targetCalories = profile.manualCalorieTarget || tdee;
      setProfile({
        ...profile,
        macroInputType: newType,
        manualCalorieTarget: null,
        proteinTargetG: profile.proteinTargetG != null ? profile.proteinTargetG : (macroPercentages.protein / 100) * targetCalories / 4,
        carbsTargetG: profile.carbsTargetG != null ? profile.carbsTargetG : (macroPercentages.carbs / 100) * targetCalories / 4,
        fatTargetG: profile.fatTargetG != null ? profile.fatTargetG : (macroPercentages.fat / 100) * targetCalories / 9,
      });
    } else {
      const proteinG = profile.proteinTargetG ?? 0;
      const carbsG = profile.carbsTargetG ?? 0;
      const fatG = profile.fatTargetG ?? 0;
      const totalCals = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
      
      if (totalCals > 0) {
        let proteinPct = Math.round((proteinG * 4 / totalCals) * 100);
        let carbsPct = Math.round((carbsG * 4 / totalCals) * 100);
        let fatPct = Math.round((fatG * 9 / totalCals) * 100);
        
        const total = proteinPct + carbsPct + fatPct;
        if (total !== 100) {
          const diff = 100 - total;
          proteinPct += diff;
        }
        
        setMacroPercentages({ protein: proteinPct, carbs: carbsPct, fat: fatPct });
        
        const normalizedProteinG = (proteinPct / 100) * totalCals / 4;
        const normalizedCarbsG = (carbsPct / 100) * totalCals / 4;
        const normalizedFatG = (fatPct / 100) * totalCals / 9;
        setProfile({ 
          ...profile, 
          macroInputType: newType, 
          manualCalorieTarget: totalCals,
          proteinTargetG: normalizedProteinG,
          carbsTargetG: normalizedCarbsG,
          fatTargetG: normalizedFatG,
        });
      } else {
        setProfile({ ...profile, macroInputType: newType });
      }
    }
  };

  const handlePercentageChange = (macro: "protein" | "carbs" | "fat", value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value || 0));
    const newPercentages = { ...macroPercentages, [macro]: clampedValue };
    setMacroPercentages(newPercentages);
    
    const targetCalories = profile.manualCalorieTarget || tdee;
    if (targetCalories > 0) {
      const proteinG = (newPercentages.protein / 100) * targetCalories / 4;
      const carbsG = (newPercentages.carbs / 100) * targetCalories / 4;
      const fatG = (newPercentages.fat / 100) * targetCalories / 9;
      
      setProfile({
        ...profile,
        macroInputType: "percentage",
        proteinTargetG: proteinG,
        carbsTargetG: carbsG,
        fatTargetG: fatG,
      });
    }
  };

  const handleGramsChange = (macro: "protein" | "carbs" | "fat", value: number) => {
    const clampedValue = Math.max(0, value || 0);
    
    const newProtein = macro === "protein" ? clampedValue : (profile.proteinTargetG ?? 0);
    const newCarbs = macro === "carbs" ? clampedValue : (profile.carbsTargetG ?? 0);
    const newFat = macro === "fat" ? clampedValue : (profile.fatTargetG ?? 0);
    
    setProfile({
      ...profile,
      macroInputType: "grams",
      proteinTargetG: newProtein,
      carbsTargetG: newCarbs,
      fatTargetG: newFat,
      manualCalorieTarget: null,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profile.macroInputType === "percentage") {
      const total = macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat;
      if (total !== 100) {
        return;
      }
    }
    
    let dailyCalorieTarget = 0;
    if (profile.macroInputType === "percentage") {
      dailyCalorieTarget = profile.manualCalorieTarget || tdee;
    } else {
      const proteinCals = (profile.proteinTargetG ?? 0) * 4;
      const carbsCals = (profile.carbsTargetG ?? 0) * 4;
      const fatCals = (profile.fatTargetG ?? 0) * 9;
      dailyCalorieTarget = Math.round(proteinCals + carbsCals + fatCals);
    }
    
    onSave({ ...profile, dailyCalorieTarget });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 bg-primary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-4">Your Metabolic Rate</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">BMR</div>
            <div className="text-3xl font-bold tabular-nums" data-testid="text-bmr">
              {bmr}
            </div>
            <div className="text-xs text-muted-foreground">cal/day</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">TDEE</div>
            <div className="text-3xl font-bold tabular-nums" data-testid="text-tdee">
              {tdee}
            </div>
            <div className="text-xs text-muted-foreground">cal/day</div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Personal Information</h3>
          <div className="flex items-center gap-3">
            <Label htmlFor="unit-toggle" className="text-sm text-muted-foreground">
              lb & in
            </Label>
            <Switch
              id="unit-toggle"
              checked={isMetric}
              onCheckedChange={toggleUnitSystem}
              data-testid="switch-unit-system"
            />
            <Label htmlFor="unit-toggle" className="text-sm">
              kg & cm
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="height">Height ({isMetric ? "cm" : "inches"})</Label>
            <Input
              id="height"
              type="number"
              value={displayHeight}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="mt-2"
              data-testid="input-height"
            />
          </div>
          <div>
            <Label htmlFor="birthdate">Birthdate</Label>
            <Input
              id="birthdate"
              type="date"
              value={profile.birthdate}
              onChange={(e) =>
                setProfile({ ...profile, birthdate: e.target.value })
              }
              className="mt-2"
              data-testid="input-birthdate"
            />
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={profile.gender}
              onValueChange={(value: "M" | "F") =>
                setProfile({ ...profile, gender: value })
              }
            >
              <SelectTrigger className="mt-2" id="gender" data-testid="select-gender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div>
          <Label htmlFor="activity">Activity Level</Label>
          <Select
            value={profile.activityMultiplier.toString()}
            onValueChange={(value) =>
              setProfile({ ...profile, activityMultiplier: Number(value) })
            }
          >
            <SelectTrigger className="mt-2" id="activity" data-testid="select-activity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activityLevels.map((level) => (
                <SelectItem key={level.value} value={level.value.toString()}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Display Preferences</h3>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="bmi-tape-toggle" className="text-sm font-medium">
              Show BMI Tape
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Display visual BMI gauge with weight targets on Analytics
            </p>
          </div>
          <Switch
            id="bmi-tape-toggle"
            checked={profile.showBmiTape}
            onCheckedChange={(checked) => setProfile({ ...profile, showBmiTape: checked })}
            data-testid="switch-bmi-tape"
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Units & Measurements</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customize unit preferences for different areas. Leave as "Use Default" to follow your main unit system.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="unit-body-weight" className="text-sm font-medium">Body Weight</Label>
            <Select
              value={profile.unitBodyWeight || "default"}
              onValueChange={(value) => setProfile({ ...profile, unitBodyWeight: value === "default" ? null : value })}
            >
              <SelectTrigger className="mt-2" id="unit-body-weight" data-testid="select-unit-body-weight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use Default ({isMetric ? "kg" : "lb"})</SelectItem>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                <SelectItem value="lb">Pounds (lb)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="unit-body-measurements" className="text-sm font-medium">Body Measurements</Label>
            <Select
              value={profile.unitBodyMeasurements || "default"}
              onValueChange={(value) => setProfile({ ...profile, unitBodyMeasurements: value === "default" ? null : value })}
            >
              <SelectTrigger className="mt-2" id="unit-body-measurements" data-testid="select-unit-body-measurements">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use Default ({isMetric ? "cm" : "in"})</SelectItem>
                <SelectItem value="cm">Centimeters (cm)</SelectItem>
                <SelectItem value="in">Inches (in)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="unit-exercise-weight" className="text-sm font-medium">Exercise Weights</Label>
            <Select
              value={profile.unitExerciseWeight || "default"}
              onValueChange={(value) => setProfile({ ...profile, unitExerciseWeight: value === "default" ? null : value })}
            >
              <SelectTrigger className="mt-2" id="unit-exercise-weight" data-testid="select-unit-exercise-weight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use Default ({isMetric ? "kg" : "lb"})</SelectItem>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                <SelectItem value="lb">Pounds (lb)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="unit-cardio-distance" className="text-sm font-medium">Cardio Distance</Label>
            <Select
              value={profile.unitCardioDistance || "default"}
              onValueChange={(value) => setProfile({ ...profile, unitCardioDistance: value === "default" ? null : value })}
            >
              <SelectTrigger className="mt-2" id="unit-cardio-distance" data-testid="select-unit-cardio-distance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use Default ({isMetric ? "km" : "mi"})</SelectItem>
                <SelectItem value="km">Kilometers (km)</SelectItem>
                <SelectItem value="mi">Miles (mi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="unit-food-weight" className="text-sm font-medium">Food Weight</Label>
            <Select
              value={profile.unitFoodWeight || "default"}
              onValueChange={(value) => setProfile({ ...profile, unitFoodWeight: value === "default" ? null : value })}
            >
              <SelectTrigger className="mt-2" id="unit-food-weight" data-testid="select-unit-food-weight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use Default ({isMetric ? "g" : "oz"})</SelectItem>
                <SelectItem value="g">Grams (g)</SelectItem>
                <SelectItem value="oz">Ounces (oz)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="unit-food-volume" className="text-sm font-medium">Food Volume</Label>
            <Select
              value={profile.unitFoodVolume || "default"}
              onValueChange={(value) => setProfile({ ...profile, unitFoodVolume: value === "default" ? null : value })}
            >
              <SelectTrigger className="mt-2" id="unit-food-volume" data-testid="select-unit-food-volume">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use Default ({isMetric ? "ml" : "fl oz"})</SelectItem>
                <SelectItem value="ml">Milliliters (ml)</SelectItem>
                <SelectItem value="floz">Fluid Ounces (fl oz)</SelectItem>
                <SelectItem value="cups">Cups</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Macro Goals</h3>
          <div className="flex items-center gap-3">
            <Label htmlFor="macro-toggle" className="text-sm text-muted-foreground">
              %
            </Label>
            <Switch
              id="macro-toggle"
              checked={profile.macroInputType === "grams"}
              onCheckedChange={toggleMacroInputType}
              data-testid="switch-macro-type"
            />
            <Label htmlFor="macro-toggle" className="text-sm">
              Grams
            </Label>
          </div>
        </div>

        <div className="space-y-4">
          {profile.macroInputType === "percentage" ? (
            <>
              <div>
                <Label htmlFor="manual-calories">Target Calories (per day)</Label>
                <Input
                  id="manual-calories"
                  type="number"
                  min="0"
                  value={profile.manualCalorieTarget || ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : Number(e.target.value);
                    const targetCalories = value || tdee;
                    
                    const proteinG = (macroPercentages.protein / 100) * targetCalories / 4;
                    const carbsG = (macroPercentages.carbs / 100) * targetCalories / 4;
                    const fatG = (macroPercentages.fat / 100) * targetCalories / 9;
                    
                    setProfile({
                      ...profile,
                      manualCalorieTarget: value,
                      proteinTargetG: proteinG,
                      carbsTargetG: carbsG,
                      fatTargetG: fatG,
                    });
                  }}
                  placeholder={`${tdee} (auto from TDEE)`}
                  className="mt-2"
                  data-testid="input-manual-calories"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to use TDEE ({tdee} cal)
                </p>
              </div>
              
              <Separator />
              
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="protein-pct">Protein</Label>
                  <span className="text-sm text-muted-foreground">
                    {macroPercentages.protein}% ({((macroPercentages.protein / 100) * (profile.manualCalorieTarget || tdee) / 4).toFixed(1)}g)
                  </span>
                </div>
                <Input
                  id="protein-pct"
                  type="number"
                  min="0"
                  max="100"
                  value={macroPercentages.protein}
                  onChange={(e) => handlePercentageChange("protein", Number(e.target.value))}
                  data-testid="input-protein-pct"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="carbs-pct">Carbs</Label>
                  <span className="text-sm text-muted-foreground">
                    {macroPercentages.carbs}% ({((macroPercentages.carbs / 100) * (profile.manualCalorieTarget || tdee) / 4).toFixed(1)}g)
                  </span>
                </div>
                <Input
                  id="carbs-pct"
                  type="number"
                  min="0"
                  max="100"
                  value={macroPercentages.carbs}
                  onChange={(e) => handlePercentageChange("carbs", Number(e.target.value))}
                  data-testid="input-carbs-pct"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="fat-pct">Fat</Label>
                  <span className="text-sm text-muted-foreground">
                    {macroPercentages.fat}% ({((macroPercentages.fat / 100) * (profile.manualCalorieTarget || tdee) / 9).toFixed(1)}g)
                  </span>
                </div>
                <Input
                  id="fat-pct"
                  type="number"
                  min="0"
                  max="100"
                  value={macroPercentages.fat}
                  onChange={(e) => handlePercentageChange("fat", Number(e.target.value))}
                  data-testid="input-fat-pct"
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Calories</div>
                <div className="text-2xl font-bold tabular-nums" data-testid="text-auto-calories">
                  {Math.round(
                    (profile.proteinTargetG || 0) * 4 + 
                    (profile.carbsTargetG || 0) * 4 + 
                    (profile.fatTargetG || 0) * 9
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  auto-calculated from macros
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label htmlFor="protein-g">Protein (g)</Label>
                <Input
                  id="protein-g"
                  type="number"
                  min="0"
                  value={profile.proteinTargetG || ""}
                  onChange={(e) => handleGramsChange("protein", Number(e.target.value))}
                  className="mt-2"
                  data-testid="input-protein-g"
                />
              </div>
              <div>
                <Label htmlFor="carbs-g">Carbs (g)</Label>
                <Input
                  id="carbs-g"
                  type="number"
                  min="0"
                  value={profile.carbsTargetG || ""}
                  onChange={(e) => handleGramsChange("carbs", Number(e.target.value))}
                  className="mt-2"
                  data-testid="input-carbs-g"
                />
              </div>
              <div>
                <Label htmlFor="fat-g">Fat (g)</Label>
                <Input
                  id="fat-g"
                  type="number"
                  min="0"
                  value={profile.fatTargetG || ""}
                  onChange={(e) => handleGramsChange("fat", Number(e.target.value))}
                  className="mt-2"
                  data-testid="input-fat-g"
                />
              </div>
            </>
          )}
        </div>

        {profile.macroInputType === "percentage" && (
          <div className={`text-xs ${
            macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat === 100
              ? "text-muted-foreground"
              : "text-destructive font-semibold"
          }`}>
            Total: {macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat}%
            {macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat !== 100 && " (should equal 100%)"}
          </div>
        )}
      </Card>

      <Button 
        type="submit" 
        className="w-full h-14 text-lg" 
        data-testid="button-save-settings"
        disabled={profile.macroInputType === "percentage" && macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat !== 100}
      >
        Save Settings
      </Button>
    </form>
  );
}
