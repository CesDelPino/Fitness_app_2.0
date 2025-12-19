import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn('SUPABASE_URL not set. Supabase admin features will not work.');
}

if (!supabaseServiceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set. JWT validation will not work.');
}

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
  user_metadata?: Record<string, any>;
}

export async function validateSupabaseToken(token: string): Promise<SupabaseUser | null> {
  if (!supabaseServiceRoleKey) {
    console.error('Cannot validate token: SUPABASE_SERVICE_ROLE_KEY not set');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Token validation failed:', error?.message || 'No user found');
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      user_metadata: user.user_metadata
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

export interface CreateUserData {
  email: string;
  password: string;
  displayName?: string;
  gender?: string;
  birthdate?: string;
  heightCm?: number;
  currentWeightKg?: number;
  activityMultiplier?: number;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  createdAt: string;
  lastSignIn?: string;
}

export async function createAuthUser(data: CreateUserData): Promise<{ user: AdminUserInfo | null; error: string | null }> {
  if (!supabaseServiceRoleKey) {
    return { user: null, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' };
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.displayName
      }
    });

    if (authError || !authData.user) {
      return { user: null, error: authError?.message || 'Failed to create user' };
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        display_name: data.displayName,
        gender: data.gender,
        birthdate: data.birthdate,
        height_cm: data.heightCm,
        current_weight_kg: data.currentWeightKg,
        activity_multiplier: data.activityMultiplier || 1.55,
        role: 'client'
      });

    if (profileError) {
      console.error('Profile creation error (user created but profile failed):', profileError);
    }

    return {
      user: {
        id: userId,
        email: authData.user.email || data.email,
        displayName: data.displayName,
        role: 'client',
        createdAt: authData.user.created_at
      },
      error: null
    };
  } catch (error: any) {
    console.error('Create user error:', error);
    return { user: null, error: error.message || 'Unknown error creating user' };
  }
}

export async function updateAuthUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  if (!supabaseServiceRoleKey) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' };
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Update password error:', error);
    return { success: false, error: error.message || 'Unknown error updating password' };
  }
}

export async function listAuthUsers(): Promise<{ users: AdminUserInfo[]; error: string | null }> {
  if (!supabaseServiceRoleKey) {
    return { users: [], error: 'SUPABASE_SERVICE_ROLE_KEY not configured' };
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      return { users: [], error: authError.message };
    }

    const userIds = authData.users.map(u => u.id);
    
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, role')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const users: AdminUserInfo[] = authData.users.map(user => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email || '',
        displayName: profile?.display_name || user.user_metadata?.display_name,
        role: profile?.role || 'client',
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at
      };
    });

    return { users, error: null };
  } catch (error: any) {
    console.error('List users error:', error);
    return { users: [], error: error.message || 'Unknown error listing users' };
  }
}
