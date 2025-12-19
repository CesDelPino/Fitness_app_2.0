import { supabaseAdmin } from "./supabase-admin";
import type {
  MarketplaceGmvMetrics,
  GmvDaily,
  TrainerEarningsSummary,
  ProductSalesMetrics,
  RecentPurchaseAdmin,
  CheckoutAbandonmentMetrics,
  WebhookEventSummary,
} from "@shared/schema";

function mapGmvMetrics(row: any): MarketplaceGmvMetrics {
  return {
    totalCompletedPurchases: parseInt(row.total_completed_purchases) || 0,
    totalRefundedPurchases: parseInt(row.total_refunded_purchases) || 0,
    totalPendingPurchases: parseInt(row.total_pending_purchases) || 0,
    totalGmvCents: parseInt(row.total_gmv_cents) || 0,
    totalRefundedCents: parseInt(row.total_refunded_cents) || 0,
    totalPlatformFeesCents: parseInt(row.total_platform_fees_cents) || 0,
    totalTrainerEarningsCents: parseInt(row.total_trainer_earnings_cents) || 0,
    uniquePayingClients: parseInt(row.unique_paying_clients) || 0,
    trainersWithSales: parseInt(row.trainers_with_sales) || 0,
    productsWithSales: parseInt(row.products_with_sales) || 0,
  };
}

function mapGmvDaily(row: any): GmvDaily {
  return {
    purchaseDate: row.purchase_date,
    completedCount: parseInt(row.completed_count) || 0,
    refundedCount: parseInt(row.refunded_count) || 0,
    gmvCents: parseInt(row.gmv_cents) || 0,
    refundedCents: parseInt(row.refunded_cents) || 0,
    platformFeesCents: parseInt(row.platform_fees_cents) || 0,
    uniqueClients: parseInt(row.unique_clients) || 0,
  };
}

function mapTrainerEarnings(row: any): TrainerEarningsSummary {
  return {
    trainerId: row.trainer_id,
    trainerName: row.trainer_name,
    totalSales: parseInt(row.total_sales) || 0,
    totalRefunds: parseInt(row.total_refunds) || 0,
    totalRevenueCents: parseInt(row.total_revenue_cents) || 0,
    totalEarningsCents: parseInt(row.total_earnings_cents) || 0,
    totalRefundedCents: parseInt(row.total_refunded_cents) || 0,
    uniqueClients: parseInt(row.unique_clients) || 0,
    productsSold: parseInt(row.products_sold) || 0,
    firstSaleAt: row.first_sale_at,
    lastSaleAt: row.last_sale_at,
  };
}

function mapProductSalesMetrics(row: any): ProductSalesMetrics {
  return {
    productId: row.product_id,
    trainerId: row.trainer_id,
    productName: row.product_name,
    productType: row.product_type,
    productStatus: row.product_status,
    trainerName: row.trainer_name,
    totalSales: parseInt(row.total_sales) || 0,
    totalRefunds: parseInt(row.total_refunds) || 0,
    totalRevenueCents: parseInt(row.total_revenue_cents) || 0,
    uniqueBuyers: parseInt(row.unique_buyers) || 0,
    lastSaleAt: row.last_sale_at,
  };
}

function mapRecentPurchase(row: any): RecentPurchaseAdmin {
  return {
    purchaseId: row.purchase_id,
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    clientId: row.client_id,
    clientName: row.client_name,
    trainerId: row.trainer_id,
    trainerName: row.trainer_name,
    amountTotalCents: parseInt(row.amount_total_cents) || 0,
    platformFeeCents: parseInt(row.platform_fee_cents) || 0,
    currency: row.currency,
    status: row.status,
    purchasedAt: row.purchased_at,
    fulfilledAt: row.fulfilled_at,
    frozenAt: row.frozen_at,
    refundedAt: row.refunded_at,
    refundReason: row.refund_reason,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
  };
}

function mapCheckoutAbandonmentMetrics(row: any): CheckoutAbandonmentMetrics {
  return {
    totalSessions: parseInt(row.total_sessions) || 0,
    completedSessions: parseInt(row.completed_sessions) || 0,
    abandonedSessions: parseInt(row.abandoned_sessions) || 0,
    pendingSessions: parseInt(row.pending_sessions) || 0,
    completionRatePercent: row.completion_rate_percent ? parseFloat(row.completion_rate_percent) : null,
    completedRevenueCents: parseInt(row.completed_revenue_cents) || 0,
    abandonedRevenueCents: parseInt(row.abandoned_revenue_cents) || 0,
  };
}

function mapWebhookEventSummary(row: any): WebhookEventSummary {
  return {
    eventType: row.event_type,
    totalEvents: parseInt(row.total_events) || 0,
    processedCount: parseInt(row.processed_count) || 0,
    pendingCount: parseInt(row.pending_count) || 0,
    lastEventAt: row.last_event_at,
  };
}

export async function getMarketplaceGmvMetrics(): Promise<MarketplaceGmvMetrics> {
  const { data, error } = await supabaseAdmin
    .from('marketplace_gmv_metrics')
    .select('*')
    .single();

  if (error) {
    console.error('Error fetching GMV metrics:', error);
    return {
      totalCompletedPurchases: 0,
      totalRefundedPurchases: 0,
      totalPendingPurchases: 0,
      totalGmvCents: 0,
      totalRefundedCents: 0,
      totalPlatformFeesCents: 0,
      totalTrainerEarningsCents: 0,
      uniquePayingClients: 0,
      trainersWithSales: 0,
      productsWithSales: 0,
    };
  }

  return mapGmvMetrics(data);
}

export async function getGmvDaily(days: number = 30): Promise<GmvDaily[]> {
  const { data, error } = await supabaseAdmin
    .from('marketplace_gmv_daily')
    .select('*')
    .limit(days);

  if (error) {
    console.error('Error fetching daily GMV:', error);
    return [];
  }

  return (data || []).map(mapGmvDaily);
}

export async function getTrainerEarnings(): Promise<TrainerEarningsSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('trainer_earnings_summary')
    .select('*')
    .order('total_earnings_cents', { ascending: false });

  if (error) {
    console.error('Error fetching trainer earnings:', error);
    return [];
  }

  return (data || []).map(mapTrainerEarnings);
}

export async function getProductSalesMetrics(options: {
  status?: string;
  trainerId?: string;
  search?: string;
}): Promise<ProductSalesMetrics[]> {
  let query = supabaseAdmin
    .from('product_sales_metrics')
    .select('*')
    .order('total_revenue_cents', { ascending: false });

  if (options.status) {
    query = query.eq('product_status', options.status);
  }
  if (options.trainerId) {
    query = query.eq('trainer_id', options.trainerId);
  }
  if (options.search) {
    query = query.ilike('product_name', `%${options.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching product sales metrics:', error);
    return [];
  }

  return (data || []).map(mapProductSalesMetrics);
}

export async function getRecentPurchases(options: {
  limit?: number;
  status?: string;
  trainerId?: string;
  clientId?: string;
}): Promise<RecentPurchaseAdmin[]> {
  let query = supabaseAdmin
    .from('recent_purchases_admin')
    .select('*')
    .order('purchased_at', { ascending: false })
    .limit(options.limit || 50);

  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.trainerId) {
    query = query.eq('trainer_id', options.trainerId);
  }
  if (options.clientId) {
    query = query.eq('client_id', options.clientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching recent purchases:', error);
    return [];
  }

  return (data || []).map(mapRecentPurchase);
}

export async function getCheckoutAbandonmentMetrics(): Promise<CheckoutAbandonmentMetrics> {
  const { data, error } = await supabaseAdmin
    .from('checkout_abandonment_metrics')
    .select('*')
    .single();

  if (error) {
    console.error('Error fetching checkout abandonment metrics:', error);
    return {
      totalSessions: 0,
      completedSessions: 0,
      abandonedSessions: 0,
      pendingSessions: 0,
      completionRatePercent: null,
      completedRevenueCents: 0,
      abandonedRevenueCents: 0,
    };
  }

  return mapCheckoutAbandonmentMetrics(data);
}

export async function getWebhookEventsSummary(): Promise<WebhookEventSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('webhook_events_summary')
    .select('*');

  if (error) {
    console.error('Error fetching webhook events summary:', error);
    return [];
  }

  return (data || []).map(mapWebhookEventSummary);
}

export async function getPendingWebhookEvents(): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('webhook_events_requiring_attention')
    .select('*');

  if (error) {
    console.error('Error fetching pending webhook events:', error);
    return [];
  }

  return data || [];
}

export async function logCheckoutSession(session: {
  stripeSessionId: string;
  clientId: string;
  productId?: string;
  trainerId?: string;
  amountCents: number;
  currency: string;
  sessionType: 'product' | 'subscription';
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('checkout_sessions_log')
    .insert({
      stripe_session_id: session.stripeSessionId,
      client_id: session.clientId,
      product_id: session.productId,
      trainer_id: session.trainerId,
      amount_cents: session.amountCents,
      currency: session.currency,
      session_type: session.sessionType,
      status: 'created',
    });

  if (error) {
    console.error('Error logging checkout session:', error);
  }
}

export async function markCheckoutSessionCompleted(stripeSessionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('checkout_sessions_log')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', stripeSessionId);

  if (error) {
    console.error('Error marking checkout session completed:', error);
  }
}

export async function markCheckoutSessionExpired(stripeSessionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('checkout_sessions_log')
    .update({
      status: 'expired',
      expired_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', stripeSessionId);

  if (error) {
    console.error('Error marking checkout session expired:', error);
  }
}
