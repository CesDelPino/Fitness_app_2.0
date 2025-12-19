import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { PermissionSlug, PermissionCategory } from "@shared/supabase-types";

export interface PermissionDefinition {
  id: string;
  slug: PermissionSlug;
  display_name: string;
  description: string | null;
  category: PermissionCategory;
  permission_type: 'read' | 'write';
  is_exclusive: boolean;
  is_enabled: boolean;
  sort_order: number;
}

export interface ProfessionalInfo {
  id: string;
  name: string;
  headline: string | null;
  avatar_url: string | null;
}

export interface RelationshipPermissions {
  relationship_id: string;
  professional_id: string;
  professional_name: string;
  professional_headline: string | null;
  professional_avatar: string | null;
  role_type: string;
  granted_permissions: PermissionSlug[];
}

export interface ClientPermissionsResponse {
  relationships: RelationshipPermissions[];
  permission_definitions: PermissionDefinition[];
}

export interface UpdatePermissionsRequest {
  grant?: PermissionSlug[];
  revoke?: PermissionSlug[];
}

export interface UpdatePermissionsResponse {
  message: string;
  granted_permissions: PermissionSlug[];
  transfers?: Array<{
    permission: PermissionSlug;
    previous_holder_id: string;
    previous_holder_name?: string;
  }>;
  errors?: string[];
}

export const PERMISSION_CATEGORIES: { key: PermissionCategory; label: string; icon: string }[] = [
  { key: 'nutrition', label: 'Nutrition', icon: 'Apple' },
  { key: 'workouts', label: 'Workouts', icon: 'Dumbbell' },
  { key: 'weight', label: 'Weight & Body', icon: 'Scale' },
  { key: 'photos', label: 'Progress Photos', icon: 'Camera' },
  { key: 'checkins', label: 'Check-ins', icon: 'ClipboardCheck' },
  { key: 'fasting', label: 'Fasting', icon: 'Clock' },
  { key: 'profile', label: 'Profile', icon: 'User' },
];

export function groupPermissionsByCategory(
  definitions: PermissionDefinition[]
): Map<PermissionCategory, PermissionDefinition[]> {
  const grouped = new Map<PermissionCategory, PermissionDefinition[]>();
  
  for (const category of PERMISSION_CATEGORIES) {
    grouped.set(category.key, []);
  }
  
  for (const def of definitions) {
    const existing = grouped.get(def.category) || [];
    existing.push(def);
    grouped.set(def.category, existing);
  }
  
  Array.from(grouped.entries()).forEach(([key, perms]) => {
    if (perms.length === 0) {
      grouped.delete(key);
    }
  });
  
  return grouped;
}

export function getCategoryLabel(category: PermissionCategory): string {
  return PERMISSION_CATEGORIES.find(c => c.key === category)?.label || category;
}

export function getCategoryIcon(category: PermissionCategory): string {
  return PERMISSION_CATEGORIES.find(c => c.key === category)?.icon || 'Settings';
}

export function countGrantedByCategory(
  category: PermissionCategory,
  definitions: PermissionDefinition[],
  grantedSlugs: PermissionSlug[]
): { granted: number; total: number } {
  const categoryPerms = definitions.filter(d => d.category === category);
  const granted = categoryPerms.filter(d => grantedSlugs.includes(d.slug)).length;
  return { granted, total: categoryPerms.length };
}

export function useClientPermissions() {
  return useQuery<ClientPermissionsResponse>({
    queryKey: ['/api/client/permissions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/permissions');
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdatePermissions(relationshipId: string) {
  return useMutation<UpdatePermissionsResponse, Error, UpdatePermissionsRequest>({
    mutationFn: async (data) => {
      const res = await apiRequest('PUT', `/api/client/permissions/${relationshipId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/permissions'] });
    },
  });
}

export function isExclusivePermission(
  slug: PermissionSlug,
  definitions: PermissionDefinition[]
): boolean {
  return definitions.find(d => d.slug === slug)?.is_exclusive === true;
}

export function findExclusiveHolder(
  slug: PermissionSlug,
  relationships: RelationshipPermissions[],
  excludeRelationshipId?: string
): RelationshipPermissions | null {
  for (const rel of relationships) {
    if (excludeRelationshipId && rel.relationship_id === excludeRelationshipId) {
      continue;
    }
    if (rel.granted_permissions.includes(slug)) {
      return rel;
    }
  }
  return null;
}

// ============================================================================
// INVITATION PERMISSION HOOKS (Phase 3)
// ============================================================================

export interface InvitationDetails {
  success: boolean;
  error?: string;
  invitation?: {
    id: string;
    client_email: string;
    role_type: string;
    created_at: string;
  };
  professional?: {
    id: string;
    user_id: string;
    name: string;
  };
  permissions?: Array<{
    slug: PermissionSlug;
    display_name: string;
    description: string | null;
    category: PermissionCategory;
    permission_type: 'read' | 'write';
    is_exclusive: boolean;
    requested_at: string;
  }>;
}

export interface PermissionRequestDetails {
  id: string;
  relationship_id: string;
  permission_slug: PermissionSlug;
  permission_name: string;
  permission_description: string | null;
  category: PermissionCategory;
  is_exclusive: boolean;
  requested_at: string;
  status: 'pending' | 'approved' | 'denied';
  professional_name: string;
}

export function useInvitationDetails(token: string | null) {
  return useQuery<InvitationDetails>({
    queryKey: ['/api/invitations', token],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch invitation');
      }
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useClientPermissionRequests() {
  return useQuery<{ success: boolean; requests: PermissionRequestDetails[] }>({
    queryKey: ['/api/client/permission-requests'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/client/permission-requests');
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

export function useRespondToPermissionRequest() {
  return useMutation<
    { success: boolean; action: string },
    Error,
    { requestId: string; action: 'approve' | 'deny' }
  >({
    mutationFn: async ({ requestId, action }) => {
      const res = await apiRequest('PATCH', `/api/client/permission-requests/${requestId}`, { action });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/permission-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/permissions'] });
    },
  });
}

export function useAcceptInvitation(token: string | null) {
  return useMutation<
    { success: boolean; relationship_id?: string; approved_count?: number; rejected_count?: number },
    Error,
    { approved: PermissionSlug[]; rejected: PermissionSlug[] }
  >({
    mutationFn: async (data) => {
      const res = await apiRequest('POST', `/api/invitations/${token}/accept`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/permissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/assignments'] });
    },
  });
}

// ============================================================================
// PROFESSIONAL PERMISSION HOOKS (For requesting permissions from clients)
// ============================================================================

export interface ProClientPermissionsResponse {
  relationship_id: string;
  role_type: string;
  relationship_status: string; // 'active', future: 'no_payment', 'expired', 'trial', 'suspended'
  granted_permissions: PermissionSlug[];
  pending_permissions: PermissionSlug[];
  pending_requests: Array<{
    permission_slug: PermissionSlug;
    requested_at: string;
    message?: string;
  }>;
  permission_definitions: PermissionDefinition[];
}

export function useProClientPermissions(clientId: string | undefined) {
  return useQuery<ProClientPermissionsResponse>({
    queryKey: ['/api/pro/clients', clientId, 'permissions'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/pro/clients/${clientId}/permissions`);
      return res.json();
    },
    enabled: !!clientId,
    staleTime: 30 * 1000,
  });
}

export interface CreatePermissionRequestsInput {
  relationship_id: string;
  permission_slugs: PermissionSlug[];
  message?: string;
}

export interface CreatePermissionRequestsResponse {
  success: boolean;
  created_count: number;
  failed_count: number;
  results: Array<{
    slug: string;
    success: boolean;
    error?: string;
    request_id?: string;
  }>;
}

export function useCreatePermissionRequests(clientId: string | undefined) {
  return useMutation<CreatePermissionRequestsResponse, Error, CreatePermissionRequestsInput>({
    mutationFn: async (data) => {
      const res = await apiRequest('POST', '/api/pro/permission-requests', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', clientId, 'permissions'] });
    },
  });
}

// ============================================================================
// QUICK ACTION PERMISSION HELPERS
// ============================================================================

export type QuickActionPermissionState = 'granted' | 'pending' | 'missing';

export interface QuickActionConfig {
  slug: PermissionSlug;
  label: string;
  icon: string;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  { slug: 'assign_programmes', label: 'Assign Programme', icon: 'ClipboardList' },
  { slug: 'set_nutrition_targets', label: 'Set Macros', icon: 'Apple' },
  { slug: 'assign_checkins', label: 'Assign Check-in', icon: 'CalendarCheck' },
];

export function getQuickActionState(
  slug: PermissionSlug,
  grantedPermissions: PermissionSlug[],
  pendingPermissions: PermissionSlug[]
): QuickActionPermissionState {
  if (grantedPermissions.includes(slug)) return 'granted';
  if (pendingPermissions.includes(slug)) return 'pending';
  return 'missing';
}
