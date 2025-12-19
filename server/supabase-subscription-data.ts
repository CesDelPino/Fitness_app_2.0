import { supabaseAdmin } from './supabase-admin';

export interface UserSubscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  grace_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  stripe_coupon_id: string | null;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  max_redemptions: number | null;
  redemption_count: number;
  first_time_only: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface TrialHistory {
  id: string;
  user_id: string;
  trial_started_at: string;
  trial_ended_at: string | null;
  converted_to_paid: boolean;
  created_at: string;
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[subscription] Error fetching user subscription:', error);
    return null;
  }
  return data;
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[subscription] Error fetching subscription by Stripe ID:', error);
    return null;
  }
  return data;
}

export async function upsertSubscription(subscription: Partial<UserSubscription> & { user_id: string }): Promise<UserSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .upsert({
      ...subscription,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[subscription] Error upserting subscription:', error);
    return null;
  }
  return data;
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: UserSubscription['status'],
  additionalFields: Partial<UserSubscription> = {}
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status,
      ...additionalFields,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[subscription] Error updating subscription status:', error);
    return false;
  }
  return true;
}

export async function getActivePromoCode(code: string): Promise<PromoCode | null> {
  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[subscription] Error fetching promo code:', error);
    return null;
  }
  
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  if (data.max_redemptions && data.redemption_count >= data.max_redemptions) {
    return null;
  }

  return data;
}

export async function incrementPromoRedemption(promoId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc('increment_promo_redemption', {
    promo_id: promoId,
  });

  if (error) {
    console.error('[subscription] Error incrementing promo redemption:', error);
    const { error: updateError } = await supabaseAdmin
      .from('promo_codes')
      .update({ redemption_count: supabaseAdmin.rpc('increment', { x: 1 }) as any })
      .eq('id', promoId);
    
    if (updateError) {
      console.error('[subscription] Fallback increment also failed:', updateError);
      return false;
    }
  }
  return true;
}

export async function createPromoCode(promo: Omit<PromoCode, 'id' | 'redemption_count' | 'created_at'>): Promise<PromoCode | null> {
  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .insert({
      ...promo,
      code: promo.code.toUpperCase(),
      redemption_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[subscription] Error creating promo code:', error);
    return null;
  }
  return data;
}

export async function listPromoCodes(includeInactive = false): Promise<PromoCode[]> {
  let query = supabaseAdmin
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[subscription] Error listing promo codes:', error);
    return [];
  }
  return data || [];
}

export async function updatePromoCode(id: string, updates: Partial<PromoCode>): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('promo_codes')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[subscription] Error updating promo code:', error);
    return false;
  }
  return true;
}

export async function canUserStartTrial(userId: string): Promise<boolean> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data, error } = await supabaseAdmin
    .from('trial_history')
    .select('id')
    .eq('user_id', userId)
    .gte('trial_started_at', oneYearAgo.toISOString())
    .limit(1);

  if (error) {
    console.error('[subscription] Error checking trial eligibility:', error);
    return false;
  }

  return !data || data.length === 0;
}

export async function recordTrialStart(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('trial_history')
    .insert({
      user_id: userId,
      trial_started_at: new Date().toISOString(),
      converted_to_paid: false,
    });

  if (error) {
    console.error('[subscription] Error recording trial start:', error);
    return false;
  }
  return true;
}

export async function recordTrialConversion(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('trial_history')
    .update({
      trial_ended_at: new Date().toISOString(),
      converted_to_paid: true,
    })
    .eq('user_id', userId)
    .is('trial_ended_at', null);

  if (error) {
    console.error('[subscription] Error recording trial conversion:', error);
    return false;
  }
  return true;
}

export async function listSubscriptions(options: {
  status?: UserSubscription['status'];
  limit?: number;
  offset?: number;
} = {}): Promise<{ subscriptions: UserSubscription[]; total: number }> {
  let query = supabaseAdmin
    .from('user_subscriptions')
    .select('*, profiles!inner(email, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[subscription] Error listing subscriptions:', error);
    return { subscriptions: [], total: 0 };
  }

  return { subscriptions: data || [], total: count || 0 };
}

export async function getSubscriptionMetrics(): Promise<{
  totalActive: number;
  totalTrialing: number;
  totalCanceled: number;
  totalPastDue: number;
  newThisMonth: number;
  canceledThisMonth: number;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [activeResult, trialingResult, canceledResult, pastDueResult, newResult, canceledMonthResult] = await Promise.all([
    supabaseAdmin.from('user_subscriptions').select('id', { count: 'exact' }).eq('status', 'active'),
    supabaseAdmin.from('user_subscriptions').select('id', { count: 'exact' }).eq('status', 'trialing'),
    supabaseAdmin.from('user_subscriptions').select('id', { count: 'exact' }).eq('status', 'canceled'),
    supabaseAdmin.from('user_subscriptions').select('id', { count: 'exact' }).eq('status', 'past_due'),
    supabaseAdmin.from('user_subscriptions').select('id', { count: 'exact' }).gte('created_at', startOfMonth.toISOString()),
    supabaseAdmin.from('user_subscriptions').select('id', { count: 'exact' }).eq('status', 'canceled').gte('canceled_at', startOfMonth.toISOString()),
  ]);

  return {
    totalActive: activeResult.count || 0,
    totalTrialing: trialingResult.count || 0,
    totalCanceled: canceledResult.count || 0,
    totalPastDue: pastDueResult.count || 0,
    newThisMonth: newResult.count || 0,
    canceledThisMonth: canceledMonthResult.count || 0,
  };
}

export async function getUserByStripeCustomerId(customerId: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[subscription] Error fetching user by Stripe customer ID:', error);
    return null;
  }
  return data;
}

export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('id', userId);

  if (error) {
    console.error('[subscription] Error updating user Stripe customer ID:', error);
    return false;
  }
  return true;
}
