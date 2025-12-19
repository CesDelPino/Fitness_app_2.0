import { Badge } from "@/components/ui/badge";
import { Database, Bot, PencilLine, ShieldCheck } from "lucide-react";

export type DataSourceType = 
  | 'fda_foundation' 
  | 'fda_sr_legacy' 
  | 'fda_branded' 
  | 'ai_generated' 
  | 'user_manual' 
  | 'openfoodfacts'
  | 'Foundation'
  | 'SR Legacy'
  | 'Branded'
  | string;

interface DataSourceBadgeProps {
  dataType?: DataSourceType | null;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

interface BadgeConfig {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
  icon: typeof Database;
  colorClass: string;
}

function getBadgeConfig(dataType?: DataSourceType | null): BadgeConfig | null {
  switch (dataType) {
    case 'Foundation':
    case 'fda_foundation':
      return {
        label: 'FDA',
        variant: 'secondary',
        icon: ShieldCheck,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'SR Legacy':
    case 'fda_sr_legacy':
      return {
        label: 'USDA',
        variant: 'secondary',
        icon: Database,
        colorClass: 'text-blue-600 dark:text-blue-400',
      };
    case 'Branded':
    case 'fda_branded':
      return {
        label: 'Branded',
        variant: 'outline',
        icon: Database,
        colorClass: 'text-muted-foreground',
      };
    case 'ai_generated':
      return {
        label: 'AI',
        variant: 'outline',
        icon: Bot,
        colorClass: 'text-amber-600 dark:text-amber-400',
      };
    case 'user_manual':
      return {
        label: 'Manual',
        variant: 'outline',
        icon: PencilLine,
        colorClass: 'text-muted-foreground',
      };
    case 'openfoodfacts':
      return {
        label: 'OFF',
        variant: 'outline',
        icon: Database,
        colorClass: 'text-orange-600 dark:text-orange-400',
      };
    default:
      return null;
  }
}

export function DataSourceBadge({ 
  dataType, 
  size = 'sm', 
  showIcon = false,
  className = '' 
}: DataSourceBadgeProps) {
  const config = getBadgeConfig(dataType);
  
  if (!config) return null;
  
  const Icon = config.icon;
  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-1 py-0 h-4' 
    : 'text-xs px-1.5 py-0.5 h-5';
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  
  return (
    <Badge 
      variant={config.variant} 
      className={`${sizeClasses} gap-0.5 font-normal ${className}`}
      data-testid={`badge-source-${config.label.toLowerCase()}`}
    >
      {showIcon && <Icon className={`${iconSize} ${config.colorClass}`} />}
      <span className={config.colorClass}>{config.label}</span>
    </Badge>
  );
}

export function getDataSourceLabel(dataType?: DataSourceType | null): string | null {
  const config = getBadgeConfig(dataType);
  return config?.label ?? null;
}
