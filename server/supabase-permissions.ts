import { supabaseAdmin } from './supabase-admin';
import type { 
  PermissionSlug, 
  PermissionDefinition, 
  ClientPermission,
  ProfessionalRoleType 
} from '@shared/supabase-types';

const ROLE_PERMISSION_MAP: Record<ProfessionalRoleType, PermissionSlug[]> = {
  nutritionist: ['view_nutrition', 'view_weight', 'view_profile', 'set_nutrition_targets'],
  trainer: ['view_workouts', 'view_weight', 'view_profile', 'assign_programmes', 'assign_checkins'],
  coach: [
    'view_nutrition', 'view_workouts', 'view_weight', 'view_progress_photos', 
    'view_fasting', 'view_checkins', 'view_profile', 'set_nutrition_targets', 
    'set_weight_targets', 'assign_programmes', 'assign_checkins', 'set_fasting_schedule'
  ],
};

const EXCLUSIVE_PERMISSIONS: PermissionSlug[] = [
  'set_nutrition_targets',
  'set_weight_targets', 
  'assign_programmes',
  'assign_checkins',
  'set_fasting_schedule'
];

export async function getPermissionDefinitions(): Promise<PermissionDefinition[]> {
  const { data, error } = await supabaseAdmin
    .from('permission_definitions')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching permission definitions:', error);
    return [];
  }

  return data || [];
}

export async function getClientPermissions(relationshipId: string): Promise<ClientPermission[]> {
  const { data, error } = await supabaseAdmin
    .from('client_permissions')
    .select('*')
    .eq('relationship_id', relationshipId)
    .eq('status', 'granted');

  if (error) {
    console.error('Error fetching client permissions:', error);
    return [];
  }

  return data || [];
}

export async function hasPermission(
  professionalId: string,
  clientId: string,
  permissionSlug: PermissionSlug
): Promise<boolean> {
  const { data: relationship, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id, status')
    .eq('professional_id', professionalId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();

  if (relError || !relationship) {
    return false;
  }

  const { data: permissionData } = await supabaseAdmin
    .from('client_permissions')
    .select('id')
    .eq('relationship_id', relationship.id)
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted')
    .single();

  return !!permissionData;
}

export async function getClientsWithPermission(
  professionalId: string,
  permissionSlug: PermissionSlug
): Promise<string[]> {
  const { data: relationships, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id, client_id')
    .eq('professional_id', professionalId)
    .eq('status', 'active');

  if (relError || !relationships) {
    console.error('Error fetching relationships:', relError);
    return [];
  }

  if (relationships.length === 0) {
    return [];
  }

  const relationshipIds = relationships.map(r => r.id);
  
  const { data: permissions, error: permError } = await supabaseAdmin
    .from('client_permissions')
    .select('relationship_id')
    .in('relationship_id', relationshipIds)
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted');

  if (permError) {
    console.error('Error fetching permissions:', permError);
    return [];
  }

  const grantedRelationshipIds = new Set((permissions || []).map(p => p.relationship_id));
  
  return relationships
    .filter(r => grantedRelationshipIds.has(r.id))
    .map(r => r.client_id);
}

async function isExclusivePermission(permissionSlug: PermissionSlug): Promise<boolean> {
  if (EXCLUSIVE_PERMISSIONS.includes(permissionSlug)) {
    return true;
  }
  
  const { data: permDef } = await supabaseAdmin
    .from('permission_definitions')
    .select('is_exclusive')
    .eq('slug', permissionSlug)
    .single();

  return permDef?.is_exclusive === true;
}

async function getClientIdFromRelationship(relationshipId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('client_id')
    .eq('id', relationshipId)
    .single();
  
  return data?.client_id || null;
}

export async function checkExclusivePermissionHolder(
  clientId: string,
  permissionSlug: PermissionSlug
): Promise<{ professionalId: string; professionalName: string; relationshipId: string } | null> {
  const isExclusive = await isExclusivePermission(permissionSlug);
  if (!isExclusive) {
    return null;
  }

  // Step 1: Get relationship IDs for this client
  const { data: relationships } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id, professional_id')
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (!relationships || relationships.length === 0) {
    return null;
  }

  const relationshipIds = relationships.map(r => r.id);
  const relMap = new Map(relationships.map(r => [r.id, r.professional_id]));

  // Step 2: Find the granted permission for this slug
  const { data: existingPerm } = await supabaseAdmin
    .from('client_permissions')
    .select('relationship_id')
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted')
    .in('relationship_id', relationshipIds)
    .single();

  if (!existingPerm) {
    return null;
  }

  const professionalId = relMap.get(existingPerm.relationship_id);
  if (!professionalId) {
    return null;
  }

  // Step 3: Get professional name from profiles table
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('id', professionalId)
    .single();

  return {
    professionalId,
    professionalName: profile?.display_name || 'Unknown',
    relationshipId: existingPerm.relationship_id,
  };
}

async function getClientRelationshipIds(clientId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'active');
  
  return (data || []).map(r => r.id);
}

async function countExclusiveHolders(
  clientId: string,
  permissionSlug: PermissionSlug
): Promise<number> {
  const relationshipIds = await getClientRelationshipIds(clientId);
  if (relationshipIds.length === 0) return 0;

  const { count } = await supabaseAdmin
    .from('client_permissions')
    .select('id', { count: 'exact', head: true })
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted')
    .in('relationship_id', relationshipIds);

  return count || 0;
}

export async function resolveExclusiveDuplicates(
  clientId: string,
  permissionSlug: PermissionSlug,
  keepRelationshipId: string
): Promise<{ resolved: number; winnerPreserved: boolean }> {
  const relationshipIds = await getClientRelationshipIds(clientId);
  if (relationshipIds.length === 0) return { resolved: 0, winnerPreserved: true };

  const { data: allGrants } = await supabaseAdmin
    .from('client_permissions')
    .select('relationship_id')
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted')
    .in('relationship_id', relationshipIds);

  const duplicates = (allGrants || []).filter(g => g.relationship_id !== keepRelationshipId);
  
  let resolved = 0;
  for (const dup of duplicates) {
    const success = await revokePermission(dup.relationship_id, permissionSlug);
    if (success) resolved++;
  }

  const { data: currentGrants } = await supabaseAdmin
    .from('client_permissions')
    .select('relationship_id')
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted')
    .in('relationship_id', relationshipIds);
  
  const winnerCurrentlyExists = (currentGrants || []).some(g => g.relationship_id === keepRelationshipId);
  let winnerPreserved = winnerCurrentlyExists;
  
  if (!winnerCurrentlyExists && keepRelationshipId) {
    const { error } = await supabaseAdmin
      .from('client_permissions')
      .upsert({
        relationship_id: keepRelationshipId,
        permission_slug: permissionSlug,
        status: 'granted',
        granted_by: 'system',
        granted_at: new Date().toISOString(),
        client_id: clientId,
      }, {
        onConflict: 'relationship_id,permission_slug',
      });
    winnerPreserved = !error;
    
    if (error) {
      console.error('Failed to preserve winner in exclusive permission resolution:', error);
    }
  }

  return { resolved, winnerPreserved };
}

export async function grantPermission(
  relationshipId: string,
  permissionSlug: PermissionSlug,
  grantedBy: 'client' | 'admin' | 'system' = 'client'
): Promise<{ success: boolean; error?: string; transferredFrom?: string }> {
  const isExclusive = await isExclusivePermission(permissionSlug);
  let transferredFrom: string | undefined;
  
  if (isExclusive) {
    const rpcResult = await supabaseAdmin.rpc('grant_exclusive_permission', {
      p_relationship_id: relationshipId,
      p_permission_slug: permissionSlug,
      p_granted_by: grantedBy,
    });
    
    if (!rpcResult.error && rpcResult.data) {
      const result = rpcResult.data as { 
        success: boolean; 
        error?: string; 
        previous_holder_revoked?: boolean;
        previous_holder_id?: string;
      };
      
      if (result.success) {
        if (result.previous_holder_revoked && result.previous_holder_id) {
          const { data: prevHolder } = await supabaseAdmin
            .from('professional_client_relationships')
            .select('professional_profiles(display_name)')
            .eq('id', result.previous_holder_id)
            .single();
          transferredFrom = (prevHolder?.professional_profiles as any)?.display_name || 'another professional';
        }
        return { success: true, transferredFrom };
      } else if (result.error) {
        return { success: false, error: result.error };
      }
    }
    
    const clientId = await getClientIdFromRelationship(relationshipId);
    if (!clientId) {
      return { success: false, error: 'Invalid relationship' };
    }

    const existingHolder = await checkExclusivePermissionHolder(clientId, permissionSlug);
    
    if (existingHolder && existingHolder.relationshipId !== relationshipId) {
      const revokeResult = await revokePermission(existingHolder.relationshipId, permissionSlug);
      if (!revokeResult) {
        return { success: false, error: 'Failed to revoke permission from previous holder' };
      }
      transferredFrom = existingHolder.professionalName;
    }

    const { error } = await supabaseAdmin
      .from('client_permissions')
      .upsert({
        relationship_id: relationshipId,
        permission_slug: permissionSlug,
        status: 'granted',
        granted_by: grantedBy,
        granted_at: new Date().toISOString(),
        client_id: clientId,
      }, {
        onConflict: 'relationship_id,permission_slug',
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Another professional already holds this exclusive permission. Please try again.' };
      }
      console.error('Error granting permission:', error);
      return { success: false, error: 'Failed to grant permission' };
    }

    const holderCount = await countExclusiveHolders(clientId, permissionSlug);
    if (holderCount > 1) {
      console.warn(`Race condition detected for exclusive permission ${permissionSlug}, resolving...`);
      await resolveExclusiveDuplicates(clientId, permissionSlug, relationshipId);
    }

    return { success: true, transferredFrom };
  }

  const rpcResult = await supabaseAdmin.rpc('grant_shared_permission', {
    p_relationship_id: relationshipId,
    p_permission_slug: permissionSlug,
    p_granted_by: grantedBy,
  });
  
  if (!rpcResult.error && rpcResult.data) {
    const result = rpcResult.data as { success: boolean; error?: string };
    if (result.success) {
      return { success: true };
    }
  }

  const clientId = await getClientIdFromRelationship(relationshipId);
  if (!clientId) {
    return { success: false, error: 'Invalid relationship' };
  }
  
  const { error } = await supabaseAdmin
    .from('client_permissions')
    .upsert({
      relationship_id: relationshipId,
      permission_slug: permissionSlug,
      status: 'granted',
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      client_id: clientId,
    }, {
      onConflict: 'relationship_id,permission_slug',
    });

  if (error) {
    console.error('Error granting permission:', error);
    return { success: false, error: 'Failed to grant permission' };
  }

  return { success: true };
}

export async function revokePermission(
  relationshipId: string,
  permissionSlug: PermissionSlug
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('client_permissions')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('relationship_id', relationshipId)
    .eq('permission_slug', permissionSlug);

  if (error) {
    console.error('Error revoking permission:', error);
    return false;
  }

  return true;
}

export async function migrateRelationshipToPermissions(
  relationshipId: string,
  roleType: ProfessionalRoleType,
  options?: { skipExclusiveCheck?: boolean }
): Promise<{ success: boolean; granted: string[]; skipped: string[]; errors: string[] }> {
  const permissions = ROLE_PERMISSION_MAP[roleType] || [];
  const granted: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const clientId = await getClientIdFromRelationship(relationshipId);
  if (!clientId) {
    return { success: false, granted: [], skipped: [], errors: ['Invalid relationship'] };
  }

  for (const permSlug of permissions) {
    const isExclusive = await isExclusivePermission(permSlug);
    
    if (isExclusive && !options?.skipExclusiveCheck) {
      const existingHolder = await checkExclusivePermissionHolder(clientId, permSlug);
      if (existingHolder && existingHolder.relationshipId !== relationshipId) {
        skipped.push(`${permSlug} (already held by ${existingHolder.professionalName})`);
        continue;
      }
    }

    const { error } = await supabaseAdmin
      .from('client_permissions')
      .upsert({
        relationship_id: relationshipId,
        permission_slug: permSlug,
        status: 'granted',
        granted_by: 'system',
        granted_at: new Date().toISOString(),
        client_id: clientId,
      }, {
        onConflict: 'relationship_id,permission_slug',
        ignoreDuplicates: true,
      });

    if (error) {
      if (error.code === '23505') {
        skipped.push(`${permSlug} (exclusive permission already held by another professional)`);
      } else {
        errors.push(`${permSlug}: ${error.message}`);
      }
    } else {
      granted.push(permSlug);
    }
  }

  return { 
    success: errors.length === 0, 
    granted, 
    skipped, 
    errors 
  };
}

export async function getAllPermissionsForRelationship(
  relationshipId: string
): Promise<{ granted: PermissionSlug[]; available: PermissionDefinition[] }> {
  const [permissionsResult, definitionsResult] = await Promise.all([
    supabaseAdmin
      .from('client_permissions')
      .select('permission_slug')
      .eq('relationship_id', relationshipId)
      .eq('status', 'granted'),
    supabaseAdmin
      .from('permission_definitions')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true }),
  ]);

  const granted = (permissionsResult.data || []).map(p => p.permission_slug as PermissionSlug);
  const available = definitionsResult.data || [];

  return { granted, available };
}

export function getRoleDefaultPermissions(roleType: ProfessionalRoleType): PermissionSlug[] {
  return ROLE_PERMISSION_MAP[roleType] || [];
}

// ============================================================================
// INVITATION PERMISSION FUNCTIONS (Phase 3)
// ============================================================================

export async function fetchInvitationDetails(token: string): Promise<{
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
    category: string;
    permission_type: string;
    is_exclusive: boolean;
    requested_at: string;
  }>;
}> {
  const { data, error } = await supabaseAdmin.rpc('fetch_invitation_details', {
    p_token: token
  });

  if (error) {
    console.error('Error fetching invitation details:', error);
    return { success: false, error: error.message };
  }

  return data;
}

export async function finalizeInvitationPermissions(
  token: string,
  approved: PermissionSlug[],
  rejected: PermissionSlug[],
  userId: string
): Promise<{
  success: boolean;
  error?: string;
  relationship_id?: string;
  approved_count?: number;
  rejected_count?: number;
  transfers?: any[];
}> {
  // The RPC needs to run with the user's context, so we use a direct approach
  const { data, error } = await supabaseAdmin.rpc('finalize_invitation_permissions', {
    p_token: token,
    p_approved: approved,
    p_rejected: rejected
  });

  if (error) {
    console.error('Error finalizing invitation permissions:', error);
    return { success: false, error: error.message };
  }

  return data;
}

export async function getClientPermissionRequests(clientId: string): Promise<{
  success: boolean;
  error?: string;
  requests?: Array<{
    id: string;
    relationship_id: string;
    permission_slug: PermissionSlug;
    permission_name: string;
    permission_description: string | null;
    category: string;
    is_exclusive: boolean;
    requested_at: string;
    status: string;
    professional_name: string;
  }>;
}> {
  // Step 1: Get permission requests with permission definitions (FK exists)
  const { data: requests, error } = await supabaseAdmin
    .from('permission_requests')
    .select(`
      id,
      relationship_id,
      permission_slug,
      requested_at,
      status,
      permission_definitions!inner (
        display_name,
        description,
        category,
        is_exclusive
      )
    `)
    .eq('client_id', clientId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching permission requests:', error);
    return { success: false, error: error.message };
  }

  if (!requests || requests.length === 0) {
    return { success: true, requests: [] };
  }

  // Step 2: Get relationship IDs to fetch professional info
  const relationshipIds = Array.from(new Set(requests.map(r => r.relationship_id)));
  const { data: relationships } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id, professional_id')
    .in('id', relationshipIds);

  // Step 3: Get professional profiles for display names
  const professionalIds = Array.from(new Set((relationships || []).map(r => r.professional_id)));
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .in('id', professionalIds);

  // Create lookup maps
  const relMap = new Map((relationships || []).map(r => [r.id, r.professional_id]));
  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]));

  const formattedRequests = requests.map((req: any) => {
    const professionalId = relMap.get(req.relationship_id);
    const professionalName = professionalId ? profileMap.get(professionalId) : null;
    
    return {
      id: req.id,
      relationship_id: req.relationship_id,
      permission_slug: req.permission_slug,
      permission_name: req.permission_definitions?.display_name || req.permission_slug,
      permission_description: req.permission_definitions?.description || null,
      category: req.permission_definitions?.category || 'unknown',
      is_exclusive: req.permission_definitions?.is_exclusive || false,
      requested_at: req.requested_at,
      status: req.status,
      professional_name: professionalName || 'Unknown',
    };
  });

  return { success: true, requests: formattedRequests };
}

export async function respondToPermissionRequest(
  requestId: string,
  clientId: string,
  action: 'approve' | 'deny'
): Promise<{
  success: boolean;
  error?: string;
  action?: string;
}> {
  // First verify the request belongs to this client
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('permission_requests')
    .select('id, relationship_id, permission_slug, status')
    .eq('id', requestId)
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Request not found or already processed' };
  }

  if (action === 'approve') {
    // Get permission definition to check if exclusive
    const { data: permDef } = await supabaseAdmin
      .from('permission_definitions')
      .select('is_exclusive')
      .eq('slug', request.permission_slug)
      .single();

    // Grant the permission
    const grantResult = await grantPermission(
      request.relationship_id,
      request.permission_slug as PermissionSlug,
      'client'
    );

    if (!grantResult.success) {
      return { success: false, error: grantResult.error };
    }

    // Update request status
    await supabaseAdmin
      .from('permission_requests')
      .update({ 
        status: 'approved', 
        responded_at: new Date().toISOString() 
      })
      .eq('id', requestId);

    return { success: true, action: 'approved' };
  } else {
    // Deny - just update the status
    await supabaseAdmin
      .from('permission_requests')
      .update({ 
        status: 'denied', 
        responded_at: new Date().toISOString() 
      })
      .eq('id', requestId);

    return { success: true, action: 'denied' };
  }
}

export async function createPermissionRequestForPro(
  relationshipId: string,
  permissionSlug: PermissionSlug,
  professionalUserId: string,
  message?: string
): Promise<{
  success: boolean;
  error?: string;
  request_id?: string;
}> {
  // Verify professional owns this relationship
  // Step 1: Get relationship details
  const { data: relationship, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id, client_id, professional_id')
    .eq('id', relationshipId)
    .eq('status', 'active')
    .single();

  if (relError || !relationship) {
    return { success: false, error: 'Relationship not found or inactive' };
  }

  // professional_id now stores auth user ID directly
  if (relationship.professional_id !== professionalUserId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if permission already granted
  const { data: existingPerm } = await supabaseAdmin
    .from('client_permissions')
    .select('id')
    .eq('relationship_id', relationshipId)
    .eq('permission_slug', permissionSlug)
    .eq('status', 'granted')
    .single();

  if (existingPerm) {
    return { success: false, error: 'Permission already granted' };
  }

  // Check if request already pending
  const { data: existingReq } = await supabaseAdmin
    .from('permission_requests')
    .select('id')
    .eq('relationship_id', relationshipId)
    .eq('permission_slug', permissionSlug)
    .eq('status', 'pending')
    .single();

  if (existingReq) {
    return { success: false, error: 'Request already pending' };
  }

  // Create the request with optional message
  const insertData: {
    relationship_id: string;
    permission_slug: PermissionSlug;
    client_id: string;
    status: string;
    message?: string;
  } = {
    relationship_id: relationshipId,
    permission_slug: permissionSlug,
    client_id: relationship.client_id,
    status: 'pending',
  };
  
  if (message && message.trim()) {
    insertData.message = message.trim();
  }

  const { data: newRequest, error: insertError } = await supabaseAdmin
    .from('permission_requests')
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) {
    console.error('Error creating permission request:', insertError);
    return { success: false, error: 'Failed to create request' };
  }

  return { success: true, request_id: newRequest.id };
}
