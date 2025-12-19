import { useMemo } from "react";

interface Zone {
  name: string;
  min: number;
  max: number;
  color: string;
}

const ADULT_BMI_ZONES: Zone[] = [
  { name: "Underweight", min: 0, max: 18.5, color: "bg-blue-400" },
  { name: "Healthy Weight", min: 18.5, max: 25, color: "bg-green-500" },
  { name: "Overweight", min: 25, max: 30, color: "bg-yellow-500" },
  { name: "Class 1 Obesity", min: 30, max: 35, color: "bg-orange-500" },
  { name: "Class 2 Obesity", min: 35, max: 40, color: "bg-red-500" },
  { name: "Class 3 Obesity", min: 40, max: 100, color: "bg-red-700" },
];

const PEDIATRIC_PERCENTILE_ZONES: Zone[] = [
  { name: "Underweight", min: 0, max: 5, color: "bg-blue-400" },
  { name: "Healthy Weight", min: 5, max: 85, color: "bg-green-500" },
  { name: "Overweight", min: 85, max: 95, color: "bg-yellow-500" },
  { name: "Obese", min: 95, max: 100, color: "bg-red-500" },
];

interface BMIGaugeProps {
  currentWeightKg: number;
  heightCm: number;
  isMetric?: boolean;
  mode?: "adult" | "pediatric";
  percentile?: number;
}

function getZoneForValue(value: number, zones: Zone[]): number {
  for (let i = 0; i < zones.length; i++) {
    if (value < zones[i].max) {
      return i;
    }
  }
  return zones.length - 1;
}

function getDisplayZones(currentZoneIndex: number, zones: Zone[]): Zone[] {
  const displayZones: Zone[] = [];

  if (currentZoneIndex === 0) {
    displayZones.push(zones[0]);
    if (zones[1]) displayZones.push(zones[1]);
  } else if (currentZoneIndex === zones.length - 1) {
    if (zones[currentZoneIndex - 1]) displayZones.push(zones[currentZoneIndex - 1]);
    displayZones.push(zones[currentZoneIndex]);
  } else {
    displayZones.push(zones[currentZoneIndex - 1]);
    displayZones.push(zones[currentZoneIndex]);
    displayZones.push(zones[currentZoneIndex + 1]);
  }

  return displayZones;
}

export default function BMIGauge({
  currentWeightKg,
  heightCm,
  isMetric = true,
  mode = "adult",
  percentile,
}: BMIGaugeProps) {
  if (heightCm <= 0 || currentWeightKg <= 0) {
    return null;
  }

  const heightM = heightCm / 100;

  const calculateBMI = (weightKg: number) => {
    return weightKg / (heightM * heightM);
  };

  const calculateWeightForBMI = (bmi: number) => {
    return bmi * heightM * heightM;
  };

  const formatWeight = (kg: number) => {
    if (isMetric) {
      return `${kg.toFixed(1)} kg`;
    }
    return `${(kg * 2.205).toFixed(1)} lb`;
  };

  const isPediatric = mode === "pediatric" && percentile !== undefined;
  const zones = isPediatric ? PEDIATRIC_PERCENTILE_ZONES : ADULT_BMI_ZONES;
  const currentValue = isPediatric ? percentile : calculateBMI(currentWeightKg);

  const currentBMI = useMemo(() => calculateBMI(currentWeightKg), [currentWeightKg, heightM]);
  const currentZoneIndex = useMemo(() => getZoneForValue(currentValue, zones), [currentValue, zones]);
  const currentZone = zones[currentZoneIndex];
  const displayZones = useMemo(() => getDisplayZones(currentZoneIndex, zones), [currentZoneIndex, zones]);

  const chevronPositionInCurrentZone = useMemo(() => {
    const zoneRange = currentZone.max - currentZone.min;
    const positionInZone = (currentValue - currentZone.min) / zoneRange;
    return Math.max(0, Math.min(1, positionInZone));
  }, [currentValue, currentZone]);

  const currentZoneIndexInDisplay = displayZones.findIndex((z) => z.name === currentZone.name);

  const chevronLeftPercent = useMemo(() => {
    const zoneWidth = 100 / displayZones.length;
    const zoneStart = currentZoneIndexInDisplay * zoneWidth;
    return zoneStart + chevronPositionInCurrentZone * zoneWidth;
  }, [displayZones.length, currentZoneIndexInDisplay, chevronPositionInCurrentZone]);

  const boundaries = useMemo(() => {
    const result: { value: number; weight?: number; position: number }[] = [];
    const zoneWidth = 100 / displayZones.length;

    for (let i = 0; i < displayZones.length; i++) {
      if (i === 0 && displayZones[i].min > 0) {
        result.push({
          value: displayZones[i].min,
          weight: isPediatric ? undefined : calculateWeightForBMI(displayZones[i].min),
          position: 0,
        });
      }

      result.push({
        value: displayZones[i].max,
        weight: isPediatric ? undefined : calculateWeightForBMI(displayZones[i].max),
        position: (i + 1) * zoneWidth,
      });
    }

    return result;
  }, [displayZones, heightM, isPediatric]);

  const visibleBoundaries = boundaries.filter((b) => b.value < 100 && b.value > 0);

  return (
    <div className="space-y-0" data-testid="bmi-gauge">
      <div className="relative h-8 mb-1">
        <div
          className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center z-10"
          style={{ left: `${chevronLeftPercent}%` }}
          data-testid="bmi-chevron"
        >
          <span className="text-[10px] font-medium text-muted-foreground mb-0.5">You</span>
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-foreground" />
        </div>
      </div>

      {!isPediatric && (
        <div className="relative h-4 mb-1">
          {visibleBoundaries.map((boundary, idx) => {
            const isFirst = idx === 0 && boundary.position === 0;
            const isLast = idx === visibleBoundaries.length - 1;

            return (
              <div
                key={`weight-${boundary.value}`}
                className={`absolute bottom-0 -translate-x-1/2 text-[10px] text-muted-foreground font-medium whitespace-nowrap ${isFirst ? "translate-x-0" : isLast ? "-translate-x-full" : ""}`}
                style={{ left: `${boundary.position}%` }}
              >
                {boundary.weight !== undefined && formatWeight(boundary.weight)}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex rounded-md overflow-hidden h-6">
        {displayZones.map((zone) => (
          <div
            key={zone.name}
            className={`${zone.color} flex-1 flex items-center justify-center`}
            data-testid={`bmi-zone-${zone.name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <span className="text-[10px] font-medium text-white/90 truncate px-1">{zone.name}</span>
          </div>
        ))}
      </div>

      <div className="relative h-5 mt-1">
        {visibleBoundaries.map((boundary, idx) => {
          const isFirst = idx === 0 && boundary.position === 0;
          const isLast = idx === visibleBoundaries.length - 1;

          return (
            <div
              key={`value-${boundary.value}`}
              className={`absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap ${isFirst ? "translate-x-0" : isLast ? "-translate-x-full" : ""}`}
              style={{ left: `${boundary.position}%` }}
              data-testid={`bmi-boundary-${boundary.value}`}
            >
              {isPediatric ? `${boundary.value}%` : boundary.value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
