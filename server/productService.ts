import { supabaseAdmin } from './supabase-admin';
import { stripeService } from './stripeService';
import type { 
  TrainerProduct, 
  InsertTrainerProduct, 
  UpdateTrainerProduct,
  ProductPricing, 
  InsertProductPricing,
  ProductPurchase,
  PurchaseAccess
} from '@shared/schema';

function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;

  const camelObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = snakeToCamel(obj[key]);
  }
  return camelObj;
}

function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;

  const snakeObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = camelToSnake(obj[key]);
  }
  return snakeObj;
}

export class ProductService {
  async createProduct(data: InsertTrainerProduct): Promise<TrainerProduct | null> {
    const { data: product, error } = await supabaseAdmin
      .from('trainer_products')
      .insert(camelToSnake(data))
      .select()
      .single();

    if (error) {
      console.error('Create product error:', error);
      return null;
    }

    return snakeToCamel(product);
  }

  async getProduct(productId: string): Promise<TrainerProduct | null> {
    const { data: product, error } = await supabaseAdmin
      .from('trainer_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return null;
    }

    return snakeToCamel(product);
  }

  async getProductWithPricing(productId: string): Promise<(TrainerProduct & { pricing: ProductPricing[] }) | null> {
    const { data: product, error } = await supabaseAdmin
      .from('trainer_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return null;
    }

    const { data: pricing } = await supabaseAdmin
      .from('product_pricing')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    return {
      ...snakeToCamel(product),
      pricing: (pricing || []).map(snakeToCamel),
    };
  }

  async getTrainerProducts(trainerId: string, includeArchived: boolean = false): Promise<(TrainerProduct & { pricing: ProductPricing[] })[]> {
    let query = supabaseAdmin
      .from('trainer_products')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.neq('status', 'archived');
    }

    const { data: products, error } = await query;

    if (error || !products) {
      return [];
    }

    const productIds = products.map(p => p.id);
    const { data: allPricing } = await supabaseAdmin
      .from('product_pricing')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    const pricingByProduct: Record<string, ProductPricing[]> = {};
    (allPricing || []).forEach(p => {
      const pricing = snakeToCamel(p) as ProductPricing;
      if (!pricingByProduct[pricing.productId]) {
        pricingByProduct[pricing.productId] = [];
      }
      pricingByProduct[pricing.productId].push(pricing);
    });

    return products.map(product => ({
      ...snakeToCamel(product),
      pricing: pricingByProduct[product.id] || [],
    }));
  }

  async getApprovedProducts(limit: number = 50): Promise<TrainerProduct[]> {
    const { data: products, error } = await supabaseAdmin
      .from('trainer_products')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(limit);

    if (error || !products) {
      return [];
    }

    return products.map(snakeToCamel);
  }

  async getPendingProducts(): Promise<(TrainerProduct & { pricing: ProductPricing[]; trainerName?: string; trainerEmail?: string })[]> {
    const { data: products, error } = await supabaseAdmin
      .from('trainer_products')
      .select('*')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true });

    if (error || !products) {
      return [];
    }

    const productIds = products.map(p => p.id);
    const trainerIds = products.map(p => p.trainer_id);

    const [pricingResult, profilesResult] = await Promise.all([
      supabaseAdmin
        .from('product_pricing')
        .select('*')
        .in('product_id', productIds),
      supabaseAdmin
        .from('profiles')
        .select('id, display_name, email')
        .in('id', trainerIds)
    ]);

    const pricingByProduct: Record<string, ProductPricing[]> = {};
    (pricingResult.data || []).forEach(p => {
      const pricing = snakeToCamel(p) as ProductPricing;
      if (!pricingByProduct[pricing.productId]) {
        pricingByProduct[pricing.productId] = [];
      }
      pricingByProduct[pricing.productId].push(pricing);
    });

    const profilesById: Record<string, { display_name?: string; email?: string }> = {};
    (profilesResult.data || []).forEach(p => {
      profilesById[p.id] = { display_name: p.display_name, email: p.email };
    });

    return products.map(product => ({
      ...snakeToCamel(product),
      pricing: pricingByProduct[product.id] || [],
      trainerName: profilesById[product.trainer_id]?.display_name,
      trainerEmail: profilesById[product.trainer_id]?.email,
    }));
  }

  async updateProduct(
    productId: string, 
    trainerId: string, 
    updates: UpdateTrainerProduct
  ): Promise<TrainerProduct | null> {
    const { data: existing } = await supabaseAdmin
      .from('trainer_products')
      .select('status, trainer_id')
      .eq('id', productId)
      .single();

    if (!existing || existing.trainer_id !== trainerId) {
      return null;
    }

    if (!['draft', 'pending_review', 'rejected'].includes(existing.status)) {
      throw new Error('Cannot edit product in current status');
    }

    const updateData = {
      ...camelToSnake(updates),
      updated_at: new Date().toISOString(),
    };

    if (existing.status === 'approved') {
      updateData.status = 'pending_review';
    }

    const { data: product, error } = await supabaseAdmin
      .from('trainer_products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Update product error:', error);
      return null;
    }

    return snakeToCamel(product);
  }

  async submitForReview(productId: string, trainerId: string): Promise<boolean> {
    const { data: product } = await supabaseAdmin
      .from('trainer_products')
      .select('status, trainer_id')
      .eq('id', productId)
      .single();

    if (!product || product.trainer_id !== trainerId) {
      throw new Error('Product not found');
    }

    if (!['draft', 'rejected'].includes(product.status)) {
      throw new Error('Product cannot be submitted from current status');
    }

    const { data: connectAccount } = await supabaseAdmin
      .from('connected_accounts')
      .select('charges_enabled, payouts_enabled')
      .eq('user_id', trainerId)
      .single();

    if (!connectAccount?.charges_enabled || !connectAccount?.payouts_enabled) {
      throw new Error('Complete Stripe Connect onboarding before submitting products');
    }

    const { error } = await supabaseAdmin
      .from('trainer_products')
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    return !error;
  }

  async approveProduct(productId: string, approvedBy: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('trainer_products')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('status', 'pending_review');

    return !error;
  }

  async rejectProduct(productId: string, reason: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('trainer_products')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('status', 'pending_review');

    return !error;
  }

  async archiveProduct(productId: string, trainerId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('trainer_products')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('trainer_id', trainerId);

    return !error;
  }

  async addPricing(data: InsertProductPricing): Promise<ProductPricing | null> {
    const { data: pricing, error } = await supabaseAdmin
      .from('product_pricing')
      .insert(camelToSnake(data))
      .select()
      .single();

    if (error) {
      console.error('Add pricing error:', error);
      return null;
    }

    return snakeToCamel(pricing);
  }

  async getProductPricing(productId: string, activeOnly: boolean = true): Promise<ProductPricing[]> {
    let query = supabaseAdmin
      .from('product_pricing')
      .select('*')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: pricing, error } = await query;

    if (error || !pricing) {
      return [];
    }

    return pricing.map(snakeToCamel);
  }

  async updatePricingStatus(pricingId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('product_pricing')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', pricingId);

    return !error;
  }

  async setPrimaryPricing(productId: string, pricingId: string): Promise<boolean> {
    await supabaseAdmin
      .from('product_pricing')
      .update({ is_primary: false })
      .eq('product_id', productId);

    const { error } = await supabaseAdmin
      .from('product_pricing')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', pricingId);

    return !error;
  }

  async createProductWithStripe(
    data: InsertTrainerProduct,
    pricingData: Omit<InsertProductPricing, 'productId'>
  ): Promise<{ product: TrainerProduct; pricing: ProductPricing } | null> {
    const product = await this.createProduct(data);
    if (!product) return null;

    try {
      const stripeProduct = await stripeService.createStripeProduct(
        product.name,
        product.description,
        { trainerId: product.trainerId, productId: product.id }
      );

      await supabaseAdmin
        .from('trainer_products')
        .update({ stripe_product_id: stripeProduct.id })
        .eq('id', product.id);

      product.stripeProductId = stripeProduct.id;

      const recurring = pricingData.billingInterval ? {
        interval: pricingData.billingInterval as 'day' | 'week' | 'month' | 'year',
        interval_count: pricingData.intervalCount || 1,
      } : undefined;

      const stripePrice = await stripeService.createStripePrice(
        stripeProduct.id,
        pricingData.amountCents,
        pricingData.currency || 'usd',
        recurring
      );

      const pricing = await this.addPricing({
        productId: product.id,
        amountCents: pricingData.amountCents,
        currency: pricingData.currency || 'usd',
        billingInterval: pricingData.billingInterval,
        intervalCount: pricingData.intervalCount,
        isPrimary: true,
      });

      if (pricing) {
        await supabaseAdmin
          .from('product_pricing')
          .update({ stripe_price_id: stripePrice.id })
          .eq('id', pricing.id);

        pricing.stripePriceId = stripePrice.id;
      }

      return { product, pricing: pricing! };
    } catch (error) {
      console.error('Error creating product with Stripe:', error);
      await supabaseAdmin.from('trainer_products').delete().eq('id', product.id);
      throw error;
    }
  }

  async recordPurchase(
    productId: string,
    pricingId: string,
    clientId: string,
    trainerId: string,
    checkoutSessionId: string,
    paymentIntentId: string,
    amountCents: number,
    currency: string = 'usd'
  ): Promise<ProductPurchase | null> {
    const { data: purchase, error } = await supabaseAdmin
      .from('product_purchases')
      .upsert({
        product_id: productId,
        pricing_id: pricingId,
        client_id: clientId,
        trainer_id: trainerId,
        stripe_checkout_session_id: checkoutSessionId,
        stripe_payment_intent_id: paymentIntentId,
        amount_total_cents: amountCents,
        currency,
        status: 'completed',
        fulfilled_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_checkout_session_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Record purchase error:', error);
      return null;
    }

    return snakeToCamel(purchase);
  }

  async getClientPurchases(clientId: string): Promise<PurchaseAccess[]> {
    const { data: purchases, error } = await supabaseAdmin
      .from('purchase_access')
      .select('*')
      .eq('client_id', clientId)
      .order('purchased_at', { ascending: false });

    if (error || !purchases) {
      return [];
    }

    return purchases.map(snakeToCamel);
  }

  async getTrainerSales(trainerId: string): Promise<ProductPurchase[]> {
    const { data: purchases, error } = await supabaseAdmin
      .from('product_purchases')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('purchased_at', { ascending: false });

    if (error || !purchases) {
      return [];
    }

    return purchases.map(snakeToCamel);
  }

  async checkProductAccess(clientId: string, productId: string): Promise<boolean> {
    const { data: access } = await supabaseAdmin
      .from('purchase_access')
      .select('has_access')
      .eq('client_id', clientId)
      .eq('product_id', productId)
      .order('purchased_at', { ascending: false })
      .limit(1)
      .single();

    return access?.has_access === true;
  }

  async getProductMetrics(): Promise<{
    totalProducts: number;
    pendingReview: number;
    approved: number;
    totalPurchases: number;
    totalRevenue: number;
  }> {
    const [productsResult, pendingResult, approvedResult, purchasesResult] = await Promise.all([
      supabaseAdmin.from('trainer_products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('trainer_products').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabaseAdmin.from('trainer_products').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabaseAdmin.from('product_purchases').select('amount_total_cents').eq('status', 'completed'),
    ]);

    const totalRevenue = (purchasesResult.data || []).reduce(
      (sum, p) => sum + (p.amount_total_cents || 0), 
      0
    );

    return {
      totalProducts: productsResult.count || 0,
      pendingReview: pendingResult.count || 0,
      approved: approvedResult.count || 0,
      totalPurchases: purchasesResult.data?.length || 0,
      totalRevenue,
    };
  }

  async refundPurchase(purchaseId: string, reason?: string): Promise<boolean> {
    const { data: purchase } = await supabaseAdmin
      .from('product_purchases')
      .select('stripe_payment_intent_id, status')
      .eq('id', purchaseId)
      .single();

    if (!purchase || purchase.status !== 'completed' || !purchase.stripe_payment_intent_id) {
      return false;
    }

    try {
      await stripeService.refundProductPurchase(purchase.stripe_payment_intent_id, reason);

      await supabaseAdmin
        .from('product_purchases')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);

      return true;
    } catch (error) {
      console.error('Refund error:', error);
      return false;
    }
  }
}

export const productService = new ProductService();
