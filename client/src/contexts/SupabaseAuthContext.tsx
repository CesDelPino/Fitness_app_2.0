import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, supabaseUntyped } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile, ProfessionalProfile } from "@shared/supabase-types";
import { useToast } from "@/hooks/use-toast";

interface ProfileUpdateData {
  display_name?: string | null;
  timezone?: string;
  current_weight_kg?: number | null;
  height_cm?: number | null;
  birthdate?: string | null;
  gender?: string | null;
  activity_multiplier?: number | null;
  daily_calorie_target?: number | null;
  manual_calorie_target?: number | null;
  protein_target_g?: number | null;
  carbs_target_g?: number | null;
  fat_target_g?: number | null;
  preferred_unit_system?: string;
  macro_input_type?: string;
  show_bmi_tape?: boolean;
}

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  professionalProfile: ProfessionalProfile | null;
  isLoading: boolean;
  isSigningOut: boolean;
  isProfessional: boolean;
  isProfessionalCandidate: boolean;
  isClient: boolean;
  signUp: (email: string, password: string, fullName: string, asProfessional?: boolean) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { toast } = useToast();

  const fetchProfile = async (userId: string, retryCount: number = 0) => {
    let profileData;
    let error;
    
    try {
      // Add timeout to prevent infinite hang on stale sessions
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );
      
      const queryPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      const result = await Promise.race([queryPromise, timeoutPromise]) as any;
      profileData = result.data;
      error = result.error;
    } catch (e) {
      error = { message: String(e), code: 'EXCEPTION' };
    }
    
    if (error || !profileData) {
      // Retry with increasing delays to wait for database trigger
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
        return fetchProfile(userId, retryCount + 1);
      }
      
      // All retries failed - call server-side API to ensure profile exists
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch('/api/auth/ensure-profile', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
          
          if (response.ok) {
            const { profile: createdProfile } = await response.json();
            if (createdProfile) {
              setProfile(createdProfile as Profile);
              return;
            }
          }
        }
      } catch (apiError) {
        console.error('Failed to ensure profile via API:', apiError);
      }
      
      setProfile(null);
      return;
    }
    
    const typedProfile = profileData as Profile;
    setProfile(typedProfile);

    if (typedProfile.role === "professional") {
      const { data: proProfile } = await supabase
        .from("professional_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      setProfessionalProfile(proProfile as ProfessionalProfile | null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Helper to forcefully clear all Supabase auth storage
    const clearSupabaseStorage = () => {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    };
    
    // Quick check if there's any session in localStorage (much faster than network call)
    const hasStoredSession = () => {
      const keys = Object.keys(localStorage);
      return keys.some(key => key.startsWith('sb-') && key.includes('auth-token'));
    };
    
    // Fetch session with retry logic and exponential backoff
    // Returns { session, error, isAuthError } where isAuthError indicates explicit auth failure vs timeout
    // Reduced timeout to 5s per attempt for faster initial load (total ~15s worst case)
    const fetchSessionWithRetry = async (
      maxAttempts: number = 3,
      timeoutMs: number = 5000
    ): Promise<{ session: Session | null; error: Error | null; isAuthError: boolean }> => {
      const backoffDelays = [0, 1000, 2000]; // No delay on first attempt, then 1s, 2s
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Wait for backoff delay (skip on first attempt)
        if (backoffDelays[attempt] > 0) {
          console.log(`[auth] Retry attempt ${attempt + 1}/${maxAttempts} after ${backoffDelays[attempt]}ms delay`);
          await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt]));
        }
        
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Session fetch timeout')), timeoutMs)
          );
          
          const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
          
          if (error) {
            // Check if this is an explicit auth error (invalid token, expired, etc.)
            const isAuthError = error.message?.includes('invalid') || 
                               error.message?.includes('expired') ||
                               error.message?.includes('unauthorized') ||
                               (error as any).status === 401 ||
                               (error as any).status === 403;
            
            if (isAuthError) {
              console.log('[auth] Explicit auth error - session invalid:', error.message);
              return { session: null, error, isAuthError: true };
            }
            
            // Non-auth error, continue to retry
            console.log(`[auth] Attempt ${attempt + 1}/${maxAttempts} failed with error:`, error.message);
            continue;
          }
          
          // Success!
          if (attempt > 0) {
            console.log(`[auth] Session fetched successfully on attempt ${attempt + 1}`);
          }
          return { session, error: null, isAuthError: false };
          
        } catch (e) {
          // Timeout or network error - retry unless last attempt
          console.log(`[auth] Attempt ${attempt + 1}/${maxAttempts} timed out or failed:`, e instanceof Error ? e.message : 'Unknown error');
          
          if (attempt === maxAttempts - 1) {
            // Last attempt failed
            return { session: null, error: e instanceof Error ? e : new Error('Session fetch failed'), isAuthError: false };
          }
        }
      }
      
      return { session: null, error: new Error('All retry attempts exhausted'), isAuthError: false };
    };
    
    const initializeAuth = async () => {
      // Fast path: if no session in localStorage, skip slow network call
      if (!hasStoredSession()) {
        console.log('[auth] No stored session found - finishing immediately');
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }
      
      console.log('[auth] Found stored session - validating...');
      const { session, error, isAuthError } = await fetchSessionWithRetry();
      
      if (error) {
        if (isAuthError) {
          // Explicit auth error - clear storage, state, and force re-login
          console.log('[auth] Clearing storage due to explicit auth error');
          clearSupabaseStorage();
          try { await supabase.auth.signOut(); } catch {}
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setProfessionalProfile(null);
            setIsLoading(false);
          }
        } else {
          // Timeout/network error - clear stale session and finish loading
          console.warn('[auth] Session fetch failed after retries - clearing stale session');
          clearSupabaseStorage();
          if (mounted) {
            setIsLoading(false);
          }
        }
        return;
      }
      
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setIsLoading(false);
      }
    };
    
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
          // Ensure loading is finished if auth state recovered
          setIsLoading(false);
        } else {
          setProfile(null);
          setProfessionalProfile(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, asProfessional: boolean = false) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: fullName,
          full_name: fullName,
          professional_signup: asProfessional,
        },
      },
    });

    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    setIsSigningOut(true);
    
    // Optimistic: Clear local state immediately for instant UI feedback
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfessionalProfile(null);
    
    try {
      // Race signOut against 12-second timeout (matches Phase 2 Supabase latency expectations)
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 12000)
      );
      
      const { error } = await Promise.race([signOutPromise, timeoutPromise]);
      
      if (error) {
        console.warn('[auth] Sign out completed with error:', error.message);
      }
    } catch (e) {
      // Timeout or network error - user is already logged out locally
      console.warn('[auth] Sign out timed out or failed:', e instanceof Error ? e.message : 'Unknown error');
      toast({
        title: "Sign out delayed",
        description: "You've been signed out locally. Server cleanup may still be in progress.",
        variant: "default",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const updateProfile = async (data: ProfileUpdateData) => {
    if (!user) {
      throw new Error("Must be logged in to update profile");
    }

    const { error } = await supabaseUntyped
      .from("profiles")
      .update(data)
      .eq("id", user.id);

    if (error) throw error;

    await fetchProfile(user.id);
  };

  const getAccessToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const isProfessional = profile?.role === "professional";
  const isProfessionalCandidate = !!(
    user?.user_metadata?.professional_signup === true && 
    profile?.role === "client" && 
    !professionalProfile
  );
  const isClient = profile?.role === "client" && !isProfessionalCandidate;

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        profile,
        professionalProfile,
        isLoading,
        isSigningOut,
        isProfessional,
        isProfessionalCandidate,
        isClient,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        updateProfile,
        getAccessToken,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
}
