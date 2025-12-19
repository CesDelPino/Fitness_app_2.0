import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@shared/supabase-types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mghrhoqqpojdjsjptjfc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1naHJob3FxcG9qZGpzanB0amZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAyMjcsImV4cCI6MjA3OTkzNjIyN30.MGLYCOy0FjMDXeWYQOYQ-Cmdv0_E2hRWFCR4G0DGtHQ';

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

export const supabaseTyped = supabase;

// Use the same client instance to avoid "Multiple GoTrueClient instances" warning
// which can cause auth token conflicts and hanging requests
export const supabaseUntyped: SupabaseClient = supabase as SupabaseClient;
