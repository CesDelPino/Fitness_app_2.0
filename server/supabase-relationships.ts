import { supabaseAdmin } from './supabase-admin';
import type { PermissionSlug } from '@shared/supabase-types';

export async function getProfessionalProfileId(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('professional_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching professional profile:', error);
    return null;
  }

  return data?.id || null;
}

export async function hasActiveConnection(
  proUserId: string,
  clientId: string
): Promise<boolean> {
  const proProfileId = await getProfessionalProfileId(proUserId);
  if (!proProfileId) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', proProfileId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false;
    console.error('Error verifying relationship:', error);
    return false;
  }

  return !!data;
}

export async function hasActiveConnectionByProfileId(
  professionalProfileId: string,
  clientId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', professionalProfileId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false;
    console.error('Error verifying relationship:', error);
    return false;
  }

  return !!data;
}

export async function hasPermission(
  proUserId: string,
  clientId: string,
  permissionSlug: PermissionSlug
): Promise<boolean> {
  const proProfileId = await getProfessionalProfileId(proUserId);
  if (!proProfileId) {
    return false;
  }

  const { data: relationship, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', proProfileId)
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

export async function hasPermissionByProfileId(
  professionalProfileId: string,
  clientId: string,
  permissionSlug: PermissionSlug
): Promise<boolean> {
  const { data: relationship, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', professionalProfileId)
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

export async function getRelationshipId(
  proUserId: string,
  clientId: string
): Promise<string | null> {
  const proProfileId = await getProfessionalProfileId(proUserId);
  if (!proProfileId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', proProfileId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching relationship:', error);
    return null;
  }

  return data?.id || null;
}
