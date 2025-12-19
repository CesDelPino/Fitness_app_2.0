import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProExpiredUpdates, type ExpiredUpdateNotification } from "@/lib/pro-routines";
import { AlertTriangle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Creates a unique dismissal key that includes both assignment_id and expired_at timestamp.
 * This ensures that if a new update expires for the same assignment, it will be shown again.
 */
function getDismissalKey(update: ExpiredUpdateNotification): string {
  return `${update.assignment_id}:${update.expired_at}`;
}

export function ExpiredUpdatesNotification() {
  const { data: expiredUpdates, isLoading } = useProExpiredUpdates();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('dismissed_expired_updates');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const visibleUpdates = (expiredUpdates || []).filter(
    (update) => !dismissedKeys.has(getDismissalKey(update))
  );

  const handleDismiss = (update: ExpiredUpdateNotification) => {
    const newDismissed = new Set(dismissedKeys);
    newDismissed.add(getDismissalKey(update));
    setDismissedKeys(newDismissed);
    localStorage.setItem('dismissed_expired_updates', JSON.stringify(Array.from(newDismissed)));
  };

  const handleDismissAll = () => {
    const allKeys = visibleUpdates.map(u => getDismissalKey(u));
    const combined = Array.from(dismissedKeys).concat(allKeys);
    const newDismissed = new Set(combined);
    setDismissedKeys(newDismissed);
    localStorage.setItem('dismissed_expired_updates', JSON.stringify(Array.from(newDismissed)));
  };

  // Clean up old dismissed keys (older than 7 days)
  useEffect(() => {
    const stored = localStorage.getItem('dismissed_expired_updates');
    if (stored) {
      try {
        const parsed: string[] = JSON.parse(stored);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const filtered = parsed.filter((key: string) => {
          // Key format is "assignmentId:expiredAt"
          const parts = key.split(':');
          if (parts.length < 2) return false;
          const expiredAt = parts.slice(1).join(':'); // Handle ISO dates with colons
          return new Date(expiredAt).getTime() > oneWeekAgo;
        });
        if (filtered.length !== parsed.length) {
          localStorage.setItem('dismissed_expired_updates', JSON.stringify(filtered));
          setDismissedKeys(new Set(filtered));
        }
      } catch (e) {
        localStorage.removeItem('dismissed_expired_updates');
      }
    }
  }, [expiredUpdates]);

  if (isLoading || visibleUpdates.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" data-testid="card-expired-updates">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200">
                Programme Updates Expired
              </h4>
              {visibleUpdates.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-amber-700 dark:text-amber-300"
                  onClick={handleDismissAll}
                  data-testid="button-dismiss-all-expired"
                >
                  Dismiss All
                </Button>
              )}
            </div>
            
            <p className="text-sm text-amber-700 dark:text-amber-300">
              The following updates were not acted upon by clients:
            </p>

            <div className="space-y-2">
              {visibleUpdates.map((update) => (
                <div 
                  key={getDismissalKey(update)}
                  className="flex items-center justify-between gap-2 bg-white/50 dark:bg-black/20 rounded-md p-2"
                  data-testid={`row-expired-update-${update.assignment_id}`}
                >
                  <div className="text-sm">
                    <span className="font-medium" data-testid={`text-programme-name-${update.assignment_id}`}>
                      {update.programme_name || 'Unknown Programme'}
                    </span>
                    <span className="text-muted-foreground"> for </span>
                    <span className="font-medium" data-testid={`text-client-name-${update.assignment_id}`}>
                      {update.client_name || 'Unknown Client'}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2" data-testid={`text-expired-time-${update.assignment_id}`}>
                      {formatDistanceToNow(new Date(update.expired_at), { addSuffix: true })}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleDismiss(update)}
                    data-testid={`button-dismiss-${update.assignment_id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
