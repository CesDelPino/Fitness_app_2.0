import { type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureAccess, type FeatureCode } from "@/hooks/useFeatureAccess";
import { UpgradePrompt } from "./UpgradePrompt";

interface FeatureGateProps {
  feature: FeatureCode;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  compactPrompt?: boolean;
  hiddenFallback?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true,
  compactPrompt = false,
  hiddenFallback = false
}: FeatureGateProps) {
  const { canUseFeature, isLoading } = useFeatureAccess();
  
  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }
  
  if (canUseFeature(feature)) {
    return <>{children}</>;
  }
  
  if (hiddenFallback) {
    return null;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgradePrompt) {
    return <UpgradePrompt feature={feature} compact={compactPrompt} />;
  }
  
  return null;
}

interface RequireFeatureProps {
  feature: FeatureCode;
  children: (hasAccess: boolean) => ReactNode;
}

export function RequireFeature({ feature, children }: RequireFeatureProps) {
  const { canUseFeature, isLoading } = useFeatureAccess();
  
  if (isLoading) {
    return <Skeleton className="h-8 w-full" />;
  }
  
  return <>{children(canUseFeature(feature))}</>;
}

interface FeatureIndicatorProps {
  feature: FeatureCode;
  showWhenAvailable?: boolean;
}

export function FeatureIndicator({ feature, showWhenAvailable = false }: FeatureIndicatorProps) {
  const { canUseFeature, isLoading } = useFeatureAccess();
  
  if (isLoading) {
    return null;
  }
  
  const hasAccess = canUseFeature(feature);
  
  if (hasAccess && !showWhenAvailable) {
    return null;
  }
  
  if (!hasAccess) {
    return (
      <span 
        className="inline-flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full"
        data-testid={`feature-indicator-locked-${feature}`}
      >
        Premium
      </span>
    );
  }
  
  return null;
}
