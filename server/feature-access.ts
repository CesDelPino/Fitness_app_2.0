import { supabaseAdmin } from './supabase-admin';
import type { Request, Response, NextFunction } from 'express';
import type { AiUsageStatus, IncrementUsageResult } from '@shared/schema';

export type FeatureCode = 
  | 'basic_macros'
  | 'text_food_search'
  | 'barcode_scan'
  | 'ai_photo_recognition'
  | 'fiber_sugar_display'
  | 'micronutrients'
  | 'micronutrient_targets'
  | 'detailed_fats';

export type QuotaFeatureCode = 'ai_photo_recognition' | 'ai_workout_builder';

interface CachedFeatureAccess {
  features: Set<FeatureCode>;
  planCode: string;
  cachedAt: number;
  isOverride?: boolean;
  overrideExpiresAt?: string | null;
}

const CACHE_TTL_MS = 60 * 1000;
const featureCache = new Map<string, CachedFeatureAccess>();

function isCacheValid(cached: CachedFeatureAccess): boolean {
  // Base TTL check
  if (Date.now() - cached.cachedAt >= CACHE_TTL_MS) {
    return false;
  }
  
  // If this is an override cache entry, check if the override has expired
  if (cached.isOverride && cached.overrideExpiresAt) {
    const expiresAt = new Date(cached.overrideExpiresAt);
    if (expiresAt <= new Date()) {
      // Override has expired, invalidate cache
      return false;
    }
  }
  
  return true;
}

async function enforceGracePeriodExpiry(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('enforce_grace_period_expiry', {
    p_user_id: userId,
  });
  
  if (error) {
    console.error('[feature-access] RPC enforce_grace_period_expiry failed, falling back to manual updates:', error);
    return await manualGracePeriodEnforcement(userId);
  }
  
  if (data === true) {
    console.log(`[feature-access] User ${userId} downgraded to free due to expired grace period`);
    return true;
  }
  
  console.warn(`[feature-access] RPC returned false for user ${userId}, attempting manual enforcement`);
  return await manualGracePeriodEnforcement(userId);
}

async function manualGracePeriodEnforcement(userId: string): Promise<boolean> {
  const { data: freePlan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('code', 'free')
    .single();
  
  if (!freePlan) {
    console.error('[feature-access] Free plan not found for downgrade');
    return false;
  }
  
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ subscription_plan_id: freePlan.id })
    .eq('id', userId);
  
  const { error: subError } = await supabaseAdmin
    .from('user_subscriptions')
    .update({ 
      status: 'unpaid',
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', userId);
  
  if (profileError || subError) {
    console.error('[feature-access] Manual enforcement errors:', { profileError, subError });
    return false;
  }
  
  console.log(`[feature-access] User ${userId} manually downgraded to free`);
  return true;
}

// Helper function to get premium features for admin override users
async function getPremiumFeaturesForOverride(userId: string, overrideExpiresAt?: string | null): Promise<{ features: FeatureCode[]; planCode: string; adminOverride: boolean }> {
  const { data: premiumPlan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('code', 'premium')
    .single();

  if (!premiumPlan) {
    console.error('[feature-access] Premium plan not found for override');
    return { features: ['basic_macros', 'text_food_search', 'barcode_scan'], planCode: 'free', adminOverride: true };
  }

  const { data: planFeatures } = await supabaseAdmin
    .from('plan_features')
    .select(`
      feature_id,
      features (
        code,
        is_active
      )
    `)
    .eq('plan_id', premiumPlan.id);

  const features = new Set<FeatureCode>();
  for (const pf of planFeatures || []) {
    const feature = pf.features as any;
    if (feature && feature.is_active && feature.code) {
      features.add(feature.code as FeatureCode);
    }
  }

  featureCache.set(userId, {
    features,
    planCode: 'premium',
    cachedAt: Date.now(),
    isOverride: true,
    overrideExpiresAt,
  });

  return { features: Array.from(features), planCode: 'premium', adminOverride: true };
}

export async function getUserFeatures(userId: string): Promise<{ features: FeatureCode[]; planCode: string; adminOverride?: boolean }> {
  const cached = featureCache.get(userId);
  if (cached && isCacheValid(cached)) {
    return { features: Array.from(cached.features), planCode: cached.planCode };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('subscription_plan_id, admin_premium_override')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('[feature-access] Error fetching profile:', profileError);
    return { features: ['basic_macros', 'text_food_search', 'barcode_scan'], planCode: 'free' };
  }

  // Check for admin premium override first
  const adminOverride = profile.admin_premium_override as { 
    granted_by?: string; 
    granted_at?: string; 
    expires_at?: string; 
    reason?: string;
    active?: boolean;
  } | null;
  
  if (adminOverride?.active) {
    // Check if override has expired
    if (adminOverride.expires_at) {
      const expiresAt = new Date(adminOverride.expires_at);
      if (expiresAt > new Date()) {
        // Override is active and not expired - grant premium features
        console.log(`[feature-access] User ${userId} has active admin premium override`);
        return await getPremiumFeaturesForOverride(userId, adminOverride.expires_at);
      }
    } else {
      // No expiration - override is permanent until revoked
      console.log(`[feature-access] User ${userId} has permanent admin premium override`);
      return await getPremiumFeaturesForOverride(userId, null);
    }
  }

  const { data: subscription } = await supabaseAdmin
    .from('user_subscriptions')
    .select('status, grace_period_end')
    .eq('user_id', userId)
    .single();
  
  if (subscription) {
    const now = new Date();
    const isPastDue = subscription.status === 'past_due';
    const gracePeriodExpired = subscription.grace_period_end && new Date(subscription.grace_period_end) < now;
    
    if (isPastDue && gracePeriodExpired) {
      console.log(`[feature-access] Grace period expired for user ${userId}, enforcing downgrade synchronously`);
      
      try {
        await enforceGracePeriodExpiry(userId);
      } catch (err) {
        console.error(`[feature-access] Error enforcing grace period expiry for ${userId}:`, err);
      }
      
      featureCache.delete(userId);
      
      return { features: ['basic_macros', 'text_food_search', 'barcode_scan'], planCode: 'free' };
    }
  }

  const planId = profile.subscription_plan_id || 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('code')
    .eq('id', planId)
    .single();

  const planCode = plan?.code || 'free';

  const { data: planFeatures, error: planFeaturesError } = await supabaseAdmin
    .from('plan_features')
    .select(`
      feature_id,
      features (
        code,
        is_active
      )
    `)
    .eq('plan_id', planId);

  if (planFeaturesError) {
    console.error('[feature-access] Error fetching plan features:', planFeaturesError);
  }

  const features = new Set<FeatureCode>();
  for (const pf of planFeatures || []) {
    const feature = pf.features as any;
    if (feature && feature.is_active && feature.code) {
      features.add(feature.code as FeatureCode);
    }
  }

  const { data: overrides, error: overridesError } = await supabaseAdmin
    .from('user_feature_overrides')
    .select(`
      is_enabled,
      expires_at,
      features (
        code
      )
    `)
    .eq('user_id', userId);

  if (overridesError) {
    console.error('[feature-access] Error fetching overrides:', overridesError);
  }

  const now = new Date();
  for (const override of overrides || []) {
    const feature = override.features as any;
    if (!feature || !feature.code) continue;

    if (override.expires_at && new Date(override.expires_at) < now) {
      continue;
    }

    const code = feature.code as FeatureCode;
    if (override.is_enabled) {
      features.add(code);
    } else {
      features.delete(code);
    }
  }

  featureCache.set(userId, {
    features,
    planCode,
    cachedAt: Date.now(),
  });

  return { features: Array.from(features), planCode };
}

export async function hasFeature(userId: string, code: FeatureCode): Promise<boolean> {
  const { features } = await getUserFeatures(userId);
  return features.includes(code);
}

export function invalidateFeatureCache(userId: string): void {
  featureCache.delete(userId);
}

export function requireFeature(code: FeatureCode) {
  return async (req: any, res: Response, next: NextFunction) => {
    const userId = req.supabaseUser?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await hasFeature(userId, code);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Feature not available',
        feature: code,
        message: 'Upgrade to Premium to access this feature'
      });
    }

    next();
  };
}

const CORE_MACRO_NUTRIENTS = ['Energy', 'Protein', 'Carbohydrate', 'Total Fat'];
const FIBER_SUGAR_NUTRIENTS = ['Fiber', 'Total Sugars'];
const DETAILED_FAT_NUTRIENTS = ['Saturated Fat', 'Trans Fat', 'Cholesterol'];
const MICRONUTRIENTS = [
  'Calcium', 'Iron', 'Magnesium', 'Phosphorus', 'Potassium', 'Sodium', 'Zinc',
  'Copper', 'Manganese', 'Selenium', 'Vitamin A', 'Vitamin C', 'Vitamin D',
  'Vitamin E', 'Vitamin K', 'Thiamin (B1)', 'Riboflavin (B2)', 'Niacin (B3)',
  'Pantothenic Acid (B5)', 'Vitamin B6', 'Folate (B9)', 'Vitamin B12'
];

export function filterNutrientsByFeatures(
  nutrients: Array<{ name: string; [key: string]: any }>,
  features: FeatureCode[]
): Array<{ name: string; [key: string]: any }> {
  const allowedNutrients = new Set<string>(CORE_MACRO_NUTRIENTS);

  if (features.includes('fiber_sugar_display')) {
    FIBER_SUGAR_NUTRIENTS.forEach(n => allowedNutrients.add(n));
  }

  if (features.includes('detailed_fats')) {
    DETAILED_FAT_NUTRIENTS.forEach(n => allowedNutrients.add(n));
  }

  if (features.includes('micronutrients')) {
    MICRONUTRIENTS.forEach(n => allowedNutrients.add(n));
  }

  return nutrients.filter(n => allowedNutrients.has(n.name));
}

export async function filterNutrientsForUser(
  nutrients: Array<{ name: string; [key: string]: any }>,
  userId: string
): Promise<Array<{ name: string; [key: string]: any }>> {
  const { features } = await getUserFeatures(userId);
  return filterNutrientsByFeatures(nutrients, features);
}

// ============================================================================
// AI USAGE QUOTA MANAGEMENT (Phase 6)
// ============================================================================

interface QuotaCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  error?: string;
}

export async function getQuotaStatus(
  userId: string,
  featureCode?: QuotaFeatureCode
): Promise<AiUsageStatus[]> {
  const { data, error } = await supabaseAdmin.rpc('get_ai_usage_status', {
    p_user_id: userId,
    p_feature_code: featureCode || null,
  });

  if (error) {
    console.error('[feature-access] Error getting quota status:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    featureCode: row.feature_code,
    usageCount: row.usage_count,
    monthlyLimit: row.monthly_limit,
    remaining: row.remaining,
    usagePercent: parseFloat(row.usage_percent) || 0,
    resetDate: row.reset_date,
  }));
}

export async function checkQuota(
  userId: string,
  featureCode: QuotaFeatureCode,
  requiredAmount: number = 1
): Promise<QuotaCheckResult> {
  const statuses = await getQuotaStatus(userId, featureCode);
  const status = statuses.find(s => s.featureCode === featureCode);

  if (!status) {
    console.warn(`[feature-access] No quota configured for feature: ${featureCode}`);
    return {
      allowed: false,
      currentCount: 0,
      limit: 0,
      remaining: 0,
      error: 'Feature quota not configured',
    };
  }

  const allowed = status.remaining >= requiredAmount;

  return {
    allowed,
    currentCount: status.usageCount,
    limit: status.monthlyLimit,
    remaining: status.remaining,
    error: allowed ? undefined : 'Monthly quota exceeded',
  };
}

export interface ExtendedQuotaResult extends IncrementUsageResult {
  isOperationalError?: boolean;
}

export async function consumeQuota(
  userId: string,
  featureCode: QuotaFeatureCode,
  amount: number = 1
): Promise<ExtendedQuotaResult> {
  const { data, error } = await supabaseAdmin.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_feature_code: featureCode,
    p_increment: amount,
  });

  if (error) {
    console.error('[feature-access] Error incrementing quota:', error);
    return {
      success: false,
      currentCount: 0,
      limit: 0,
      remaining: 0,
      error: 'Service temporarily unavailable',
      isOperationalError: true,
    };
  }

  const result = data as any;
  
  return {
    success: result.success,
    currentCount: result.current_count,
    limit: result.limit,
    remaining: result.remaining,
    error: result.error,
    isOperationalError: false,
  };
}

export async function assertQuota(
  userId: string,
  featureCode: QuotaFeatureCode,
  amount: number = 1
): Promise<ExtendedQuotaResult> {
  const { planCode } = await getUserFeatures(userId);
  
  if (planCode === 'free') {
    return {
      success: false,
      currentCount: 0,
      limit: 0,
      remaining: 0,
      error: 'Premium subscription required for this feature',
      isOperationalError: false,
    };
  }

  return consumeQuota(userId, featureCode, amount);
}

export function requireQuota(featureCode: QuotaFeatureCode, amount: number = 1) {
  return async (req: any, res: Response, next: NextFunction) => {
    const userId = req.supabaseUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await assertQuota(userId, featureCode, amount);

    if (!result.success) {
      if (result.isOperationalError) {
        return res.status(500).json({
          error: 'Service error',
          feature: featureCode,
          message: result.error || 'Unable to verify quota. Please try again.',
        });
      }
      
      return res.status(403).json({
        error: 'Quota exceeded',
        feature: featureCode,
        message: result.error || 'Monthly usage limit reached',
        quota: {
          currentCount: result.currentCount,
          limit: result.limit,
          remaining: result.remaining,
        },
      });
    }

    req.quotaResult = result;
    next();
  };
}

// ============================================================================
// ACTIVE AI PROGRAM MANAGEMENT
// ============================================================================

export async function getActiveAiProgram(userId: string): Promise<{ blueprintId: string; activatedAt: string } | null> {
  const { data, error } = await supabaseAdmin.rpc('get_active_ai_program', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[feature-access] Error getting active AI program:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return {
    blueprintId: data[0].blueprint_id,
    activatedAt: data[0].activated_at,
  };
}

export async function setActiveAiProgram(
  userId: string,
  blueprintId: string
): Promise<{ success: boolean; message: string; previousDeactivated?: boolean }> {
  const { data, error } = await supabaseAdmin.rpc('set_active_ai_program', {
    p_user_id: userId,
    p_blueprint_id: blueprintId,
  });

  if (error) {
    console.error('[feature-access] Error setting active AI program:', error);
    return {
      success: false,
      message: 'Failed to activate AI program',
    };
  }

  const result = data as any;
  return {
    success: result.success,
    message: result.message,
    previousDeactivated: result.previous_deactivated,
  };
}

// ============================================================================
// TEASER MESSAGING QUOTA (Phase 7)
// ============================================================================

export interface TeaserUsageStatus {
  isPremium: boolean;
  clientMessagesSent: number;
  clientLimit: number;
  clientRemaining: number;
  trainerMessagesSent: number;
  trainerLimit: number;
  trainerRemaining: number;
  isClientBlocked: boolean;
  isTrainerBlocked: boolean;
  error?: string;
}

export interface IncrementTeaserResult {
  success: boolean;
  messagesSent: number;
  limit: number;
  remaining: number;
  bypassed: boolean;
  error?: string;
}

/**
 * Get teaser usage status for a conversation
 * @param userId - The user making the request
 * @param professionalId - The professional_id from the conversation
 * @param clientId - The client_id from the conversation
 */
export async function getTeaserUsageStatus(
  userId: string,
  professionalId: string,
  clientId: string
): Promise<TeaserUsageStatus> {
  const { data, error } = await supabaseAdmin.rpc('get_teaser_usage_status', {
    p_user_id: userId,
    p_conversation_pro_id: professionalId,
    p_conversation_client_id: clientId,
  });

  if (error) {
    console.error('[feature-access] Error getting teaser usage status:', error);
    return {
      isPremium: false,
      clientMessagesSent: 0,
      clientLimit: 4,
      clientRemaining: 4,
      trainerMessagesSent: 0,
      trainerLimit: 4,
      trainerRemaining: 4,
      isClientBlocked: false,
      isTrainerBlocked: false,
      error: 'Failed to get teaser usage status',
    };
  }

  const result = data as any;
  
  if (result.error) {
    return {
      isPremium: false,
      clientMessagesSent: 0,
      clientLimit: 4,
      clientRemaining: 4,
      trainerMessagesSent: 0,
      trainerLimit: 4,
      trainerRemaining: 4,
      isClientBlocked: false,
      isTrainerBlocked: false,
      error: result.error,
    };
  }

  return {
    isPremium: result.is_premium,
    clientMessagesSent: result.client_messages_sent,
    clientLimit: result.client_limit,
    clientRemaining: result.client_remaining,
    trainerMessagesSent: result.trainer_messages_sent,
    trainerLimit: result.trainer_limit,
    trainerRemaining: result.trainer_remaining,
    isClientBlocked: result.is_client_blocked,
    isTrainerBlocked: result.is_trainer_blocked,
  };
}

/**
 * Check if a user can send a teaser message (without incrementing)
 * @param senderId - The user trying to send a message
 * @param professionalId - The professional_id from the conversation
 * @param clientId - The client_id from the conversation
 */
export async function canSendTeaserMessage(
  senderId: string,
  professionalId: string,
  clientId: string
): Promise<{ canSend: boolean; reason?: string; isPremium?: boolean }> {
  const status = await getTeaserUsageStatus(senderId, professionalId, clientId);
  
  if (status.error) {
    console.error('[feature-access] Error checking teaser status:', status.error);
    return { canSend: true };
  }

  if (status.isPremium) {
    return { canSend: true, isPremium: true };
  }

  const isClient = senderId === clientId;
  const isTrainer = senderId === professionalId;

  if (isClient && status.isClientBlocked) {
    return { 
      canSend: false, 
      reason: 'You have reached your teaser message limit. Upgrade to Premium to continue messaging.',
      isPremium: false,
    };
  }

  if (isTrainer && status.isTrainerBlocked) {
    return { 
      canSend: false, 
      reason: 'This client has reached their teaser message limit. They need to upgrade to Premium to continue.',
      isPremium: false,
    };
  }

  return { canSend: true, isPremium: false };
}

/**
 * Increment teaser message count atomically
 * Should be called BEFORE actually sending the message
 * @param senderId - The user sending the message
 * @param professionalId - The professional_id from the conversation
 * @param clientId - The client_id from the conversation
 */
export async function incrementTeaserMessage(
  senderId: string,
  professionalId: string,
  clientId: string
): Promise<IncrementTeaserResult> {
  const { data, error } = await supabaseAdmin.rpc('increment_teaser_message', {
    p_sender_id: senderId,
    p_conversation_pro_id: professionalId,
    p_conversation_client_id: clientId,
  });

  if (error) {
    console.error('[feature-access] Error incrementing teaser message:', error);
    return {
      success: false,
      messagesSent: 0,
      limit: 4,
      remaining: 0,
      bypassed: false,
      error: 'Failed to track message usage',
    };
  }

  const result = data as any;
  
  return {
    success: result.success,
    messagesSent: result.messages_sent,
    limit: result.limit,
    remaining: result.remaining,
    bypassed: result.bypassed,
    error: result.error,
  };
}

/**
 * Assert that teaser quota allows sending (throws on failure)
 * Use in API routes before sending messages
 */
export async function assertTeaserQuota(
  senderId: string,
  professionalId: string,
  clientId: string
): Promise<IncrementTeaserResult> {
  const result = await incrementTeaserMessage(senderId, professionalId, clientId);
  
  if (!result.success && !result.bypassed) {
    const error = new Error(result.error || 'Teaser message limit exceeded') as any;
    error.statusCode = 403;
    error.code = 'TEASER_LIMIT_EXCEEDED';
    error.data = {
      messagesSent: result.messagesSent,
      limit: result.limit,
      remaining: result.remaining,
    };
    throw error;
  }
  
  return result;
}
