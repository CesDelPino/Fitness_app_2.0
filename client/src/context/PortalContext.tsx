import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { apiRequest, setPortalHeader, clearPortalScopedQueries } from "@/lib/queryClient";

export type PortalMode = "pro" | "client";
export type ProfileStatus = "active" | "pending_approval" | "suspended" | null;

export interface AvailableRolesResponse {
  availableRoles: PortalMode[];
  proProfileId: string | null;
  proProfileStatus: ProfileStatus;
  clientProfileId: string | null;
  clientProfileStatus: ProfileStatus;
}

export interface PortalContextResponse {
  hasContext: boolean;
  mode?: PortalMode;
  profileId?: string;
  requiresRoleSelection?: boolean;
  expires?: number;
}

interface PortalContextState {
  mode: PortalMode | null;
  profileId: string | null;
  availableRoles: AvailableRolesResponse | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  requiresRoleSelection: boolean;
  setPortalMode: (mode: PortalMode, profileId: string) => Promise<void>;
  clearPortal: () => Promise<void>;
  refreshPortal: () => Promise<void>;
  switchPortal: () => void;
}

const PortalContext = createContext<PortalContextState | null>(null);

const REFRESH_THRESHOLD_MS = 8 * 60 * 1000; // Refresh 8 minutes before expiry
const DEFAULT_COOKIE_MAX_AGE_MS = 60 * 60 * 1000; // Fallback: 1 hour
const PORTAL_SYNC_KEY = "loba_portal_mode"; // localStorage key for multi-tab sync

interface PortalProviderProps {
  children: ReactNode;
}

export function PortalProvider({ children }: PortalProviderProps) {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const queryClient = useQueryClient();
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);
  const [requiresRoleSelection, setRequiresRoleSelection] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const availableRolesQuery = useQuery<AvailableRolesResponse>({
    queryKey: ["/api/auth/available-roles"],
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const portalContextQuery = useQuery<PortalContextResponse>({
    queryKey: ["/api/auth/portal-context"],
    enabled: !!user && !authLoading && availableRolesQuery.isSuccess,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const setContextMutation = useMutation({
    mutationFn: async ({ mode, profileId }: { mode: PortalMode; profileId: string }) => {
      const res = await apiRequest("POST", "/api/auth/set-portal-context", { mode, profileId });
      return res.json() as Promise<{ expires?: number }>;
    },
    onSuccess: (data, variables) => {
      // Clear portal-scoped caches when switching portals
      clearPortalScopedQueries();
      setPortalHeader(variables.mode);
      // Store mode in localStorage for multi-tab sync
      localStorage.setItem(PORTAL_SYNC_KEY, variables.mode);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/portal-context"] });
      setRequiresRoleSelection(false);
      scheduleRefresh(data.expires);
    },
  });

  const clearContextMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/clear-portal-context");
    },
    onSuccess: () => {
      // Clear portal-scoped caches when clearing context
      clearPortalScopedQueries();
      setPortalHeader(null);
      // Remove mode from localStorage for multi-tab sync
      localStorage.removeItem(PORTAL_SYNC_KEY);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/portal-context"] });
      setRequiresRoleSelection(true);
    },
  });

  const refreshContextMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/refresh-portal-context");
      return res.json() as Promise<{ expires?: number }>;
    },
    onSuccess: (data) => {
      scheduleRefresh(data.expires);
    },
    onError: () => {
      setPortalHeader(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/portal-context"] });
      setRequiresRoleSelection(true);
    },
  });

  const scheduleRefresh = useCallback((expiresAt?: number) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    
    let delay: number;
    if (expiresAt) {
      delay = Math.max(0, expiresAt - Date.now() - REFRESH_THRESHOLD_MS);
    } else {
      delay = DEFAULT_COOKIE_MAX_AGE_MS - REFRESH_THRESHOLD_MS;
    }
    
    const timer = setTimeout(() => {
      refreshContextMutation.mutate();
    }, delay);
    setRefreshTimer(timer);
  }, [refreshTimer, refreshContextMutation]);

  useEffect(() => {
    if (!user) {
      setPortalHeader(null);
      setRequiresRoleSelection(false);
      setIsInitialized(false);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        setRefreshTimer(null);
      }
      return;
    }

    if (portalContextQuery.isSuccess && availableRolesQuery.isSuccess) {
      const context = portalContextQuery.data;
      const roles = availableRolesQuery.data;

      if (context?.hasContext && context.mode) {
        setPortalHeader(context.mode);
        setRequiresRoleSelection(false);
        scheduleRefresh(context.expires);
      } else if (roles.availableRoles.length === 1) {
        const singleRole = roles.availableRoles[0];
        const profileId = singleRole === "pro" ? roles.proProfileId : roles.clientProfileId;
        if (profileId) {
          setContextMutation.mutate({ mode: singleRole, profileId });
        }
      } else if (roles.availableRoles.length > 1) {
        setRequiresRoleSelection(true);
      } else {
        setRequiresRoleSelection(false);
      }
      setIsInitialized(true);
    }
  }, [user, portalContextQuery.isSuccess, portalContextQuery.data, availableRolesQuery.isSuccess, availableRolesQuery.data]);

  useEffect(() => {
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [refreshTimer]);

  // Multi-tab sync: Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== PORTAL_SYNC_KEY) return;
      
      const newMode = event.newValue as PortalMode | null;
      const currentMode = portalContextQuery.data?.mode;
      
      // Only sync if mode actually changed
      if (newMode !== currentMode) {
        // Clear portal-scoped caches and refetch context
        clearPortalScopedQueries();
        queryClient.invalidateQueries({ queryKey: ["/api/auth/portal-context"] });
        
        if (newMode) {
          setPortalHeader(newMode);
          setRequiresRoleSelection(false);
        } else {
          setPortalHeader(null);
          setRequiresRoleSelection(true);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient, portalContextQuery.data?.mode]);

  const setPortalMode = useCallback(async (mode: PortalMode, profileId: string) => {
    await setContextMutation.mutateAsync({ mode, profileId });
  }, [setContextMutation]);

  const clearPortal = useCallback(async () => {
    await clearContextMutation.mutateAsync();
  }, [clearContextMutation]);

  const refreshPortal = useCallback(async () => {
    await refreshContextMutation.mutateAsync();
  }, [refreshContextMutation]);

  const switchPortal = useCallback(() => {
    setRequiresRoleSelection(true);
  }, []);

  const currentMode = portalContextQuery.data?.hasContext ? portalContextQuery.data.mode ?? null : null;
  const currentProfileId = portalContextQuery.data?.hasContext ? portalContextQuery.data.profileId ?? null : null;

  const isLoading = authLoading || 
    availableRolesQuery.isLoading || 
    portalContextQuery.isLoading || 
    setContextMutation.isPending;

  const error = availableRolesQuery.error?.message || 
    portalContextQuery.error?.message || 
    setContextMutation.error?.message || 
    null;

  const value: PortalContextState = {
    mode: currentMode,
    profileId: currentProfileId,
    availableRoles: availableRolesQuery.data ?? null,
    isLoading,
    isInitialized,
    error,
    requiresRoleSelection,
    setPortalMode,
    clearPortal,
    refreshPortal,
    switchPortal,
  };

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortalContext(): PortalContextState {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortalContext must be used within a PortalProvider");
  }
  return context;
}

export function useRequirePortalMode(requiredMode: PortalMode): {
  isAllowed: boolean;
  isLoading: boolean;
} {
  const { mode, isLoading, isInitialized } = usePortalContext();
  
  return {
    isAllowed: mode === requiredMode,
    isLoading: isLoading || !isInitialized,
  };
}
