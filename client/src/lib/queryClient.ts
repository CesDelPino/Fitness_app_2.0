import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Global 401 handler callback - set by AuthContext
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// Portal context header - set by PortalProvider
let portalContextHeader: string | null = null;

export function setPortalHeader(mode: string | null) {
  portalContextHeader = mode;
}

export function getPortalHeader(): string | null {
  return portalContextHeader;
}

// Helper to get current Supabase JWT token
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error("Error getting Supabase session:", error);
  }
  
  if (portalContextHeader) {
    headers["X-Portal-Context"] = portalContextHeader;
  }
  
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Trigger global 401 handling if set
    if (res.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  options?: {
    allow404?: boolean;
  }
): Promise<T | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    credentials: "include",
    headers: authHeaders,
  });

  if (options?.allow404 && res.status === 404) {
    return null;
  }

  await throwIfResNotOk(res);
  return await res.json();
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Portal-scoped query key patterns
const PORTAL_SCOPED_PATTERNS = [
  "/api/pro/",
  "/api/stripe/connect/",
  "/api/trainer/",
  "/api/messages/",
  "pro-relationships",
  "pro-invitations",
  "pro-client-",
];

// Auth-related query keys that should NOT be cleared on portal switch
const AUTH_QUERY_KEYS = [
  "/api/auth/available-roles",
  "/api/auth/portal-context",
  "user-profile",
];

/**
 * Clear portal-scoped queries when switching between portals.
 * This ensures stale data from one portal doesn't show in the other.
 */
export function clearPortalScopedQueries(): void {
  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();
  
  for (const query of queries) {
    const keyString = query.queryKey.join("/");
    
    // Skip auth-related queries
    if (AUTH_QUERY_KEYS.some(authKey => keyString.includes(authKey))) {
      continue;
    }
    
    // Check if this is a portal-scoped query
    const isPortalScoped = PORTAL_SCOPED_PATTERNS.some(pattern => 
      keyString.includes(pattern)
    );
    
    if (isPortalScoped) {
      queryClient.removeQueries({ queryKey: query.queryKey });
    }
  }
}
