import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@shared/supabase-types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

export const supabaseTyped = supabase;

// Use the same client instance to avoid "Multiple GoTrueClient instances" warning
// which can cause auth token conflicts and hanging requests
export const supabaseUntyped: SupabaseClient = supabase as SupabaseClient;
