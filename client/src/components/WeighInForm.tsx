import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";

export interface MeasurementData {
  waist?: number;
  hips?: number;
  bustChest?: number;
  thigh?: number;
  arm?: number;
  calf?: number;
  neck?: number;
}

interface WeighInFormProps {
  onSubmit: (weight: number, notes?: string, measurements?: MeasurementData) => void;
  currentWeight?: number;
  unit?: "kg" | "lbs";
}

export default function WeighInForm({
  onSubmit,
  currentWeight = 84,
  unit = "kg",
}: WeighInFormProps) {
  const [weight, setWeight] = useState(currentWeight);
  const [notes, setNotes] = useState("");
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementData>({});

  const { bodyMeasurements } = useUnitPreferences();
  const measurementUnit = bodyMeasurements.unit;

  const adjustWeight = (amount: number) => {
    setWeight((prev) => Math.max(0, Number((prev + amount).toFixed(1))));
  };

  const updateMeasurement = (key: keyof MeasurementData, value: string) => {
    const numValue = value === "" ? undefined : Number(value);
    setMeasurements((prev) => ({ ...prev, [key]: numValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasMeasurements = Object.values(measurements).some((v) => v !== undefined);
    
    // Convert measurements to centimeters for storage if user entered in inches
    let convertedMeasurements: MeasurementData | undefined;
    if (hasMeasurements) {
      convertedMeasurements = {};
      for (const [key, value] of Object.entries(measurements)) {
        if (value !== undefined) {
          convertedMeasurements[key as keyof MeasurementData] = bodyMeasurements.toCm(value);
        }
      }
    }
    
    onSubmit(weight, notes, convertedMeasurements);
    setNotes("");
    setMeasurements({});
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="weight" className="text-base text-muted-foreground">
            Current Weight
          </Label>
          
          <div className="flex items-baseline justify-center gap-2 my-6">
            <input
              id="weight"
              type="number"
              step="0.1"
              value={weight.toFixed(1)}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-44 bg-transparent text-6xl font-bold text-center tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              data-testid="input-weight"
            />
            <span className="text-2xl text-muted-foreground font-medium">{unit}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 text-base font-semibold"
              onClick={() => adjustWeight(-1)}
              data-testid="button-subtract-1"
            >
              -1.0
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 text-base font-semibold"
              onClick={() => adjustWeight(-0.1)}
              data-testid="button-subtract-0.1"
            >
              -0.1
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 text-base font-semibold"
              onClick={() => adjustWeight(0.1)}
              data-testid="button-add-0.1"
            >
              +0.1
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 text-base font-semibold"
              onClick={() => adjustWeight(1)}
              data-testid="button-add-1"
            >
              +1.0
            </Button>
          </div>
        </div>

        <Collapsible open={measurementsOpen} onOpenChange={setMeasurementsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              data-testid="button-toggle-measurements"
            >
              <span>Body Measurements (Optional)</span>
              {measurementsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="text-sm font-medium text-muted-foreground">Core Measurements</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="waist" className="text-sm">Waist ({measurementUnit})</Label>
                <Input
                  id="waist"
                  type="number"
                  step="0.1"
                  value={measurements.waist ?? ""}
                  onChange={(e) => updateMeasurement("waist", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-waist"
                />
              </div>
              <div>
                <Label htmlFor="hips" className="text-sm">Hips ({measurementUnit})</Label>
                <Input
                  id="hips"
                  type="number"
                  step="0.1"
                  value={measurements.hips ?? ""}
                  onChange={(e) => updateMeasurement("hips", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-hips"
                />
              </div>
              <div>
                <Label htmlFor="bustChest" className="text-sm">Bust/Chest ({measurementUnit})</Label>
                <Input
                  id="bustChest"
                  type="number"
                  step="0.1"
                  value={measurements.bustChest ?? ""}
                  onChange={(e) => updateMeasurement("bustChest", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-bust-chest"
                />
              </div>
              <div>
                <Label htmlFor="neck" className="text-sm">Neck ({measurementUnit})</Label>
                <Input
                  id="neck"
                  type="number"
                  step="0.1"
                  value={measurements.neck ?? ""}
                  onChange={(e) => updateMeasurement("neck", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-neck"
                />
              </div>
            </div>

            <div className="text-sm font-medium text-muted-foreground mt-6">Additional Measurements</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="thigh" className="text-sm">Thigh ({measurementUnit})</Label>
                <Input
                  id="thigh"
                  type="number"
                  step="0.1"
                  value={measurements.thigh ?? ""}
                  onChange={(e) => updateMeasurement("thigh", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-thigh"
                />
              </div>
              <div>
                <Label htmlFor="arm" className="text-sm">Arm ({measurementUnit})</Label>
                <Input
                  id="arm"
                  type="number"
                  step="0.1"
                  value={measurements.arm ?? ""}
                  onChange={(e) => updateMeasurement("arm", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-arm"
                />
              </div>
              <div>
                <Label htmlFor="calf" className="text-sm">Calf ({measurementUnit})</Label>
                <Input
                  id="calf"
                  type="number"
                  step="0.1"
                  value={measurements.calf ?? ""}
                  onChange={(e) => updateMeasurement("calf", e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                  data-testid="input-calf"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How are you feeling today?"
            className="mt-2 resize-none"
            rows={3}
            data-testid="input-notes"
          />
        </div>

        <Button type="submit" className="w-full h-14 text-lg" data-testid="button-save-weight">
          Save Weigh-In
        </Button>
      </form>
    </Card>
  );
}
