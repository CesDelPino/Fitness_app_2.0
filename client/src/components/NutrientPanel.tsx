import { useMemo } from "react";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradePrompt } from "./UpgradePrompt";
import { useFeatureAccess, type FeatureCode } from "@/hooks/useFeatureAccess";
import { 
  type NutrientSnapshot, 
  type NutrientValue,
  groupNutrientsBySection, 
  formatNutrientValue,
  hasNutrientsWithValues,
} from "@/lib/nutrient-utils";
import { cn } from "@/lib/utils";

export interface NutrientSectionAccess {
  hasFiberSugar: boolean;
  hasMicros: boolean;
  hasDetailedFats: boolean;
}

interface NutrientPanelProps {
  snapshot: NutrientSnapshot | null | undefined;
  compact?: boolean;
  collapsible?: boolean;
  className?: string;
  showEmptySections?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

interface LegacyNutrientPanelProps {
  nutrients: Array<{ id: number; name: string; unit: string; value: number | null }>;
  expanded?: boolean;
  onToggle?: () => void;
  showMacrosOnly?: boolean;
  compact?: boolean;
}

function NutrientRow({ nutrient, compact = false }: { nutrient: NutrientValue; compact?: boolean }) {
  const displayValue = formatNutrientValue(nutrient.value, nutrient.unit, {
    showUnit: true,
    nullDisplay: "—",
  });
  const isNull = nutrient.value === null || nutrient.value === undefined;
  
  return (
    <div 
      className={cn(
        "flex justify-between items-center",
        compact ? "py-0.5" : "py-1"
      )}
      data-testid={`nutrient-row-${nutrient.id}`}
    >
      <span className={cn(
        "text-muted-foreground",
        compact ? "text-xs" : "text-sm"
      )}>
        {nutrient.name}
      </span>
      <span className={cn(
        "font-medium tabular-nums",
        compact ? "text-xs" : "text-sm",
        isNull && "text-muted-foreground"
      )}>
        {isNull ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">—</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Data not available for this food</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          displayValue
        )}
      </span>
    </div>
  );
}

function MacroGrid({ nutrients, compact = false }: { nutrients: NutrientValue[]; compact?: boolean }) {
  const calories = nutrients.find(n => n.id === 1008);
  const protein = nutrients.find(n => n.id === 1003);
  const carbs = nutrients.find(n => n.id === 1005);
  const fat = nutrients.find(n => n.id === 1004);

  const formatValue = (n: NutrientValue | undefined) => {
    if (!n) return "—";
    return formatNutrientValue(n.value, n.unit, { showUnit: true });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs" data-testid="macro-grid-compact">
        <span className="font-semibold">{formatValue(calories)}</span>
        <span className="text-muted-foreground">
          P: {formatValue(protein)} | C: {formatValue(carbs)} | F: {formatValue(fat)}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2" data-testid="macro-grid">
      <MacroCard label="Calories" value={calories?.value} unit="kcal" highlight />
      <MacroCard label="Protein" value={protein?.value} unit="g" />
      <MacroCard label="Carbs" value={carbs?.value} unit="g" />
      <MacroCard label="Fat" value={fat?.value} unit="g" />
    </div>
  );
}

function MacroCard({ 
  label, 
  value, 
  unit, 
  highlight = false 
}: { 
  label: string; 
  value: number | null | undefined; 
  unit: string;
  highlight?: boolean;
}) {
  const displayValue = value !== null && value !== undefined 
    ? Math.round(value).toString() 
    : "—";
  
  return (
    <div 
      className={cn(
        "text-center p-2 rounded-md",
        highlight ? "bg-primary/10" : "bg-muted/50"
      )}
      data-testid={`macro-card-${label.toLowerCase()}`}
    >
      <div className={cn(
        "font-bold tabular-nums",
        highlight ? "text-lg" : "text-base"
      )}>
        {displayValue}
      </div>
      <div className="text-xs text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function NutrientSection({ 
  title,
  nutrients,
  compact = false,
  locked = false,
  feature,
  collapsible = false,
}: { 
  title: string;
  nutrients: NutrientValue[];
  compact?: boolean;
  locked?: boolean;
  feature?: FeatureCode;
  collapsible?: boolean;
}) {
  const sectionId = title.toLowerCase().replace(/\s+/g, '-');

  if (locked && feature) {
    return (
      <div className="mt-3" data-testid={`nutrient-section-locked-${sectionId}`}>
        <div className="text-sm font-medium mb-2 text-muted-foreground">{title}</div>
        <UpgradePrompt feature={feature} compact />
      </div>
    );
  }

  if (!hasNutrientsWithValues(nutrients) && nutrients.length === 0) {
    return null;
  }

  const content = (
    <div className={compact ? "space-y-0" : "space-y-1"}>
      {nutrients.map(nutrient => (
        <NutrientRow key={nutrient.id} nutrient={nutrient} compact={compact} />
      ))}
    </div>
  );

  if (collapsible) {
    return (
      <AccordionItem value={title} className="border-b-0">
        <AccordionTrigger 
          className="py-2 text-sm font-medium hover:no-underline"
          data-testid={`nutrient-section-trigger-${sectionId}`}
        >
          {title}
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          {content}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <div className="mt-3" data-testid={`nutrient-section-${sectionId}`}>
      <div className="text-sm font-medium mb-2">{title}</div>
      {content}
    </div>
  );
}

function LockedMicronutrients() {
  return (
    <div className="flex items-center justify-center py-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Micronutrient details
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upgrade to see vitamins and minerals
          </p>
        </div>
      </div>
    </div>
  );
}

export function NutrientPanel({ 
  snapshot,
  compact = false,
  collapsible = false,
  className = "",
  showEmptySections = false,
  expanded = true,
  onToggle,
}: NutrientPanelProps) {
  const { canUseFeature, isLoading: accessLoading } = useFeatureAccess();

  const access: NutrientSectionAccess = {
    hasFiberSugar: canUseFeature('fiber_sugar_display'),
    hasMicros: canUseFeature('micronutrients'),
    hasDetailedFats: canUseFeature('detailed_fats'),
  };

  const sections = useMemo(() => {
    return groupNutrientsBySection(snapshot);
  }, [snapshot]);

  if (accessLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!snapshot?.nutrients || snapshot.nutrients.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground text-center py-4", className)} data-testid="nutrient-panel-empty">
        No nutrition data available
      </div>
    );
  }

  const hasFiberSugarData = showEmptySections || hasNutrientsWithValues(sections.fiberSugar);
  const hasVitaminsData = showEmptySections || hasNutrientsWithValues(sections.vitamins);
  const hasMineralsData = showEmptySections || hasNutrientsWithValues(sections.minerals);
  const hasDetailedFatsData = showEmptySections || hasNutrientsWithValues(sections.detailedFats);
  const hasPremiumData = hasFiberSugarData || hasVitaminsData || hasMineralsData || hasDetailedFatsData;

  if (compact) {
    return (
      <div className={className} data-testid="nutrient-panel-compact">
        <MacroGrid nutrients={sections.coreMacros} compact />
      </div>
    );
  }

  const premiumSections = (
    <>
      {hasFiberSugarData && (
        <NutrientSection 
          title="Fiber & Sugar" 
          nutrients={sections.fiberSugar}
          compact={compact}
          locked={!access.hasFiberSugar}
          feature="fiber_sugar_display"
          collapsible={collapsible}
        />
      )}
      
      {hasDetailedFatsData && (
        <NutrientSection 
          title="Fats & Cholesterol" 
          nutrients={sections.detailedFats}
          compact={compact}
          locked={!access.hasDetailedFats}
          feature="detailed_fats"
          collapsible={collapsible}
        />
      )}
      
      {hasVitaminsData && (
        <NutrientSection 
          title="Vitamins" 
          nutrients={sections.vitamins}
          compact={compact}
          locked={!access.hasMicros}
          feature="micronutrients"
          collapsible={collapsible}
        />
      )}
      
      {hasMineralsData && (
        <NutrientSection 
          title="Minerals" 
          nutrients={sections.minerals}
          compact={compact}
          locked={!access.hasMicros}
          feature="micronutrients"
          collapsible={collapsible}
        />
      )}
    </>
  );

  return (
    <div className={className} data-testid="nutrient-panel">
      <MacroGrid nutrients={sections.coreMacros} />
      
      {hasPremiumData && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 mt-2"
          data-testid="button-toggle-nutrients"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show details
            </>
          )}
        </button>
      )}
      
      {expanded && (
        collapsible ? (
          <Accordion type="multiple" className="mt-3">
            {premiumSections}
          </Accordion>
        ) : (
          <div className="border-t mt-3 pt-3">
            {premiumSections}
          </div>
        )
      )}
    </div>
  );
}

export default function LegacyNutrientPanel({
  nutrients,
  expanded = false,
  onToggle,
  showMacrosOnly = false,
  compact = false,
}: LegacyNutrientPanelProps) {
  const snapshot: NutrientSnapshot = useMemo(() => ({
    nutrients: nutrients.map(n => ({
      id: n.id,
      name: n.name,
      unit: n.unit,
      value: n.value,
    })),
    fetchedAt: new Date().toISOString(),
  }), [nutrients]);

  if (showMacrosOnly) {
    return <NutrientPanel snapshot={snapshot} compact />;
  }

  return (
    <NutrientPanel 
      snapshot={snapshot} 
      expanded={expanded} 
      onToggle={onToggle}
      compact={compact}
    />
  );
}

export function NutrientPanelCard({
  nutrients,
  title,
  className,
}: {
  nutrients: Array<{ id: number; name: string; unit: string; value: number | null }>;
  title?: string;
  className?: string;
}) {
  const snapshot: NutrientSnapshot = useMemo(() => ({
    nutrients: nutrients.map(n => ({
      id: n.id,
      name: n.name,
      unit: n.unit,
      value: n.value,
    })),
    fetchedAt: new Date().toISOString(),
  }), [nutrients]);

  return (
    <Card className={cn("p-4", className)} data-testid="card-nutrient-panel">
      {title && (
        <h3 className="text-sm font-medium mb-3">{title}</h3>
      )}
      <NutrientPanel snapshot={snapshot} expanded />
    </Card>
  );
}

export function NutrientPanelCompact({ 
  snapshot,
  className = "" 
}: { 
  snapshot: NutrientSnapshot | null | undefined;
  className?: string;
}) {
  return <NutrientPanel snapshot={snapshot} compact className={className} />;
}

export function useNutrientSectionAccess(): NutrientSectionAccess & { isLoading: boolean } {
  const { canUseFeature, isLoading } = useFeatureAccess();
  
  return {
    hasFiberSugar: canUseFeature('fiber_sugar_display'),
    hasMicros: canUseFeature('micronutrients'),
    hasDetailedFats: canUseFeature('detailed_fats'),
    isLoading,
  };
}
