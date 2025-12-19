import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFeatureAccess, FEATURE_DESCRIPTIONS, type FeatureCode } from "@/hooks/useFeatureAccess";

interface UpgradePromptProps {
  feature?: FeatureCode;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}

export function UpgradePrompt({ 
  feature, 
  title, 
  description,
  compact = false,
  className = "" 
}: UpgradePromptProps) {
  const { planCode } = useFeatureAccess();
  
  const featureInfo = feature ? FEATURE_DESCRIPTIONS[feature] : null;
  const displayTitle = title || featureInfo?.name || "Premium Feature";
  const displayDescription = description || featureInfo?.description || "Upgrade to Premium to access this feature";
  
  if (compact) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 ${className}`}
        data-testid="upgrade-prompt-compact"
      >
        <Crown className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm text-amber-600 dark:text-amber-400">
          {displayTitle} - Premium only
        </span>
      </div>
    );
  }

  return (
    <Card className={`border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 ${className}`} data-testid="upgrade-prompt">
      <CardContent className="flex flex-col items-center justify-center py-8 px-6 text-center">
        <div className="p-3 rounded-full bg-amber-500/20 mb-4">
          <Crown className="h-8 w-8 text-amber-500" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2" data-testid="upgrade-prompt-title">
          {displayTitle}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-6 max-w-sm" data-testid="upgrade-prompt-description">
          {displayDescription}
        </p>
        
        <Button 
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
          data-testid="button-upgrade"
        >
          <Crown className="h-4 w-4 mr-2" />
          Upgrade to Premium
        </Button>
        
        {planCode === 'free' && (
          <p className="text-xs text-muted-foreground mt-4">
            You're currently on the Free plan
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function UpgradeInline({ feature }: { feature: FeatureCode }) {
  const featureInfo = FEATURE_DESCRIPTIONS[feature];
  
  return (
    <span 
      className="inline-flex items-center gap-1 text-amber-500"
      data-testid={`upgrade-inline-${feature}`}
    >
      <Crown className="h-3 w-3" />
      <span className="text-xs font-medium">Premium</span>
    </span>
  );
}
