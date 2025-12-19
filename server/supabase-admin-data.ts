/**
 * Supabase Admin Data Operations
 * 
 * This module handles admin user authentication and management
 * using Supabase instead of the legacy Neon database.
 * 
 * All operations use the service role key to bypass RLS.
 */

import { supabaseAdmin } from './supabase-admin';
import bcrypt from 'bcrypt';

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

/**
 * Get admin user by username
 */
export async function getAdminByUsername(username: string): Promise<AdminUser | null> {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('username', username)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user not found
      return null;
    }
    console.error('Error fetching admin by username:', error);
    return null;
  }

  return data;
}

/**
 * Get admin user by ID
 */
export async function getAdminById(id: string): Promise<AdminUser | null> {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching admin by id:', error);
    return null;
  }

  return data;
}

/**
 * Create a new admin user
 */
export async function createAdminUser(
  username: string,
  password: string
): Promise<AdminUser | null> {
  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      username,
      password_hash: passwordHash,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating admin user:', error);
    return null;
  }

  return data;
}

/**
 * Verify admin password
 */
export async function verifyAdminPassword(
  username: string,
  password: string
): Promise<AdminUser | null> {
  const admin = await getAdminByUsername(username);
  
  if (!admin) {
    return null;
  }

  const isValid = await bcrypt.compare(password, admin.password_hash);
  
  if (!isValid) {
    return null;
  }

  return admin;
}

/**
 * Seed the LOBAFIT admin user if it doesn't exist
 * Uses ADMIN_PASSWORD from environment
 */
export async function seedLobafitAdmin(): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.warn('[admin] ADMIN_PASSWORD not set, skipping LOBAFIT seed');
    return;
  }

  const existing = await getAdminByUsername('LOBAFIT');
  
  if (existing) {
    console.log('[admin] LOBAFIT admin already exists');
    return;
  }

  const admin = await createAdminUser('LOBAFIT', adminPassword);
  
  if (admin) {
    console.log('[admin] Created LOBAFIT admin user');
  } else {
    console.error('[admin] Failed to create LOBAFIT admin user');
  }
}

/**
 * Check if admin_users table exists and has the LOBAFIT user
 */
export async function checkAdminSetup(): Promise<boolean> {
  const admin = await getAdminByUsername('LOBAFIT');
  return admin !== null;
}
