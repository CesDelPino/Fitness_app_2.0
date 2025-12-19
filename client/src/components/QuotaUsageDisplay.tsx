import { AlertCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuotaStatus, type QuotaFeatureCode, QUOTA_FEATURE_DESCRIPTIONS } from "@/hooks/useFeatureAccess";
import { useLocation } from "wouter";

interface QuotaUsageDisplayProps {
  featureCode: QuotaFeatureCode;
  showUpgradeButton?: boolean;
  compact?: boolean;
  className?: string;
}

export function QuotaUsageDisplay({ 
  featureCode, 
  showUpgradeButton = true,
  compact = false,
  className = "",
}: QuotaUsageDisplayProps) {
  const { getQuota, isLoading, isAtLimit, isNearLimit, hasError, hasQuotaData } = useQuotaStatus(featureCode);
  const [, setLocation] = useLocation();
  const quota = getQuota(featureCode);
  const featureInfo = QUOTA_FEATURE_DESCRIPTIONS[featureCode];

  if (isLoading) {
    return null;
  }

  if (hasError || !hasQuotaData || !quota) {
    return null;
  }

  const atLimit = isAtLimit(featureCode);
  const nearLimit = isNearLimit(featureCode);
  const progressColor = atLimit ? "bg-destructive" : nearLimit ? "bg-warning" : "bg-primary";

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid={`quota-compact-${featureCode}`}>
        {atLimit && <AlertCircle className="h-4 w-4 text-destructive" />}
        <span className={`text-sm ${atLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {quota.usageCount}/{quota.monthlyLimit}
        </span>
        {atLimit && showUpgradeButton && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setLocation("/subscribe")}
            data-testid="button-upgrade-quota"
          >
            Upgrade
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} data-testid={`quota-display-${featureCode}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{featureInfo.name}</span>
          {atLimit && (
            <Badge variant="destructive" className="text-xs" data-testid="badge-quota-limit">
              Limit Reached
            </Badge>
          )}
          {!atLimit && nearLimit && (
            <Badge variant="outline" className="text-xs border-warning text-warning" data-testid="badge-quota-warning">
              Running Low
            </Badge>
          )}
        </div>
        <span className={`text-sm ${atLimit ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-quota-count">
          {quota.usageCount} of {quota.monthlyLimit} used
        </span>
      </div>
      
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div 
          className={`h-full transition-all ${progressColor}`}
          style={{ width: `${Math.min(quota.usagePercent, 100)}%` }}
          data-testid="progress-quota"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground" data-testid="text-quota-reset">
          {quota.resetDate ? `Resets ${new Date(quota.resetDate).toLocaleDateString()}` : 'Monthly reset'}
        </span>
        {atLimit && showUpgradeButton && (
          <Button 
            size="sm" 
            onClick={() => setLocation("/subscribe")}
            data-testid="button-upgrade-quota-full"
          >
            Upgrade for More
          </Button>
        )}
      </div>
    </div>
  );
}

interface QuotaWarningBannerProps {
  featureCode: QuotaFeatureCode;
  onDismiss?: () => void;
}

export function QuotaWarningBanner({ featureCode, onDismiss }: QuotaWarningBannerProps) {
  const { getQuota, isAtLimit, isNearLimit, hasError, hasQuotaData, isLoading } = useQuotaStatus(featureCode);
  const [, setLocation] = useLocation();
  const quota = getQuota(featureCode);
  const featureInfo = QUOTA_FEATURE_DESCRIPTIONS[featureCode];

  if (isLoading || hasError || !hasQuotaData || !quota) return null;

  const atLimit = isAtLimit(featureCode);
  const nearLimit = isNearLimit(featureCode);

  if (!atLimit && !nearLimit) return null;

  return (
    <div 
      className={`p-4 rounded-lg border ${
        atLimit 
          ? "bg-destructive/10 border-destructive/20" 
          : "bg-warning/10 border-warning/20"
      }`}
      data-testid="banner-quota-warning"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={`h-5 w-5 mt-0.5 ${atLimit ? "text-destructive" : "text-warning"}`} />
        <div className="flex-1">
          <p className={`font-medium ${atLimit ? "text-destructive" : "text-warning"}`}>
            {atLimit 
              ? `${featureInfo.name} Limit Reached` 
              : `${featureInfo.name} Running Low`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {atLimit 
              ? `You've used all ${quota.monthlyLimit} ${featureInfo.name.toLowerCase()} this month. Upgrade to Premium for unlimited access.`
              : `You've used ${quota.usageCount} of ${quota.monthlyLimit} ${featureInfo.name.toLowerCase()} this month.`}
          </p>
          <div className="flex gap-2 mt-3">
            <Button 
              size="sm" 
              onClick={() => setLocation("/subscribe")}
              data-testid="button-upgrade-banner"
            >
              Upgrade Now
            </Button>
            {onDismiss && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={onDismiss}
                data-testid="button-dismiss-warning"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
