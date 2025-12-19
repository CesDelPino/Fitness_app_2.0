import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { supabaseAdmin } from './supabase-admin';
import type Stripe from 'stripe';

export class StripeService {
  async createCustomer(email: string, userId: string, name?: string): Promise<Stripe.Customer> {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
  }

  async getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string> {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profile?.stripe_customer_id) {
      return profile.stripe_customer_id;
    }

    const customer = await this.createCustomer(email, userId, name);
    
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);
    
    return customer.id;
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    options: {
      userId: string;
      trialDays?: number;
      promoCode?: string;
    }
  ): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: options.userId,
      },
      subscription_data: {
        metadata: {
          userId: options.userId,
        },
      },
    };

    if (options.trialDays && options.trialDays > 0) {
      sessionParams.subscription_data!.trial_period_days = options.trialDays;
    }

    if (options.promoCode) {
      const { data: promo } = await supabaseAdmin
        .from('promo_codes')
        .select('stripe_coupon_id')
        .eq('code', options.promoCode.toUpperCase())
        .eq('is_active', true)
        .single();
      
      if (promo?.stripe_coupon_id) {
        sessionParams.discounts = [{ coupon: promo.stripe_coupon_id }];
      }
    }

    return await stripe.checkout.sessions.create(sessionParams);
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    const stripe = await getUncachableStripeClient();
    
    if (immediately) {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
    
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = await getUncachableStripeClient();
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const stripe = await getUncachableStripeClient();
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  }

  async getPublishableKey(): Promise<string> {
    return await getStripePublishableKey();
  }

  async createPromoCode(
    code: string,
    discountType: 'percent' | 'amount',
    discountValue: number,
    options: {
      maxRedemptions?: number;
      expiresAt?: Date;
      firstTimeOnly?: boolean;
    } = {}
  ): Promise<{ couponId: string; promoCodeId: string }> {
    const stripe = await getUncachableStripeClient();

    const couponParams: Stripe.CouponCreateParams = {
      duration: 'once',
      name: code,
    };

    if (discountType === 'percent') {
      couponParams.percent_off = discountValue;
    } else {
      couponParams.amount_off = discountValue;
      couponParams.currency = 'usd';
    }

    const coupon = await stripe.coupons.create(couponParams);

    return { couponId: coupon.id, promoCodeId: coupon.id };
  }

  async validatePromoCode(code: string): Promise<{
    valid: boolean;
    discountType?: 'percent' | 'amount';
    discountValue?: number;
    message?: string;
  }> {
    const { data: promo } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!promo) {
      return { valid: false, message: 'Invalid promo code' };
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return { valid: false, message: 'Promo code has expired' };
    }

    if (promo.max_redemptions && promo.redemption_count >= promo.max_redemptions) {
      return { valid: false, message: 'Promo code has reached maximum redemptions' };
    }

    return {
      valid: true,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
    };
  }

  async getPrice(priceId: string): Promise<Stripe.Price | null> {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.prices.retrieve(priceId);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async updatePrice(
    oldPriceId: string,
    newAmount: number,
    options: {
      nickname?: string;
    } = {}
  ): Promise<Stripe.Price> {
    const stripe = await getUncachableStripeClient();
    
    const oldPrice = await stripe.prices.retrieve(oldPriceId);
    if (!oldPrice) {
      throw new Error(`Price ${oldPriceId} not found`);
    }

    const newPrice = await stripe.prices.create({
      product: oldPrice.product as string,
      unit_amount: newAmount,
      currency: oldPrice.currency,
      recurring: oldPrice.recurring ? {
        interval: oldPrice.recurring.interval,
        interval_count: oldPrice.recurring.interval_count || 1,
      } : undefined,
      nickname: options.nickname || oldPrice.nickname || undefined,
      metadata: {
        ...oldPrice.metadata,
        replaced_price_id: oldPriceId,
        updated_at: new Date().toISOString(),
      },
    });

    await stripe.prices.update(oldPriceId, { active: false });

    return newPrice;
  }

  async togglePriceActive(priceId: string, active: boolean): Promise<Stripe.Price> {
    const stripe = await getUncachableStripeClient();
    
    // Check current state to avoid no-op calls
    const currentPrice = await stripe.prices.retrieve(priceId);
    if (currentPrice.active === active) {
      return currentPrice; // Already in desired state
    }

    // If deactivating, verify this isn't the last active price for the product
    if (!active) {
      const productId = currentPrice.product as string;
      // Fetch ALL prices (including inactive) for accurate counting
      const allPrices = await stripe.prices.list({
        product: productId,
        limit: 100,
      });
      
      // Count active prices excluding the one being deactivated
      const remainingActivePrices = allPrices.data.filter(p => p.id !== priceId && p.active);
      
      if (remainingActivePrices.length === 0) {
        throw new Error('Cannot deactivate the last active price for this product. At least one price tier must remain active for checkout to work.');
      }
    }

    return await stripe.prices.update(priceId, { active });
  }

  async listProductPrices(productId: string, includeInactive: boolean = false): Promise<Stripe.Price[]> {
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({
      product: productId,
      active: includeInactive ? undefined : true,
      limit: 100,
    });
    return prices.data;
  }

  async listProducts(): Promise<Stripe.Product[]> {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    });
    return products.data;
  }

  // ==================== STRIPE CONNECT METHODS ====================

  async createConnectAccount(
    userId: string,
    email: string,
    options: {
      country?: string;
      businessType?: 'individual' | 'company';
      firstName?: string;
      lastName?: string;
    } = {}
  ): Promise<Stripe.Account> {
    const stripe = await getUncachableStripeClient();
    
    const accountParams: Stripe.AccountCreateParams = {
      type: 'express',
      email,
      country: options.country || 'US',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        userId,
        platform: 'loba_tracker',
      },
    };

    if (options.businessType) {
      accountParams.business_type = options.businessType;
    }

    if (options.firstName || options.lastName) {
      accountParams.individual = {
        first_name: options.firstName,
        last_name: options.lastName,
        email,
      };
    }

    const account = await stripe.accounts.create(accountParams);

    await supabaseAdmin
      .from('connected_accounts')
      .upsert({
        user_id: userId,
        stripe_account_id: account.id,
        account_type: 'express',
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_complete: account.charges_enabled && account.payouts_enabled && account.details_submitted,
        country: options.country || 'US',
        default_currency: account.default_currency || 'usd',
      }, {
        onConflict: 'user_id',
      });

    return account;
  }

  async createAccountLink(
    stripeAccountId: string,
    refreshUrl: string,
    returnUrl: string,
    type: 'account_onboarding' | 'account_update' = 'account_onboarding'
  ): Promise<Stripe.AccountLink> {
    const stripe = await getUncachableStripeClient();
    
    return await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
      collect: 'eventually_due',
    });
  }

  async getConnectAccount(stripeAccountId: string): Promise<Stripe.Account | null> {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.accounts.retrieve(stripeAccountId);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async getConnectAccountByUserId(userId: string): Promise<{
    account: Stripe.Account;
    dbRecord: any;
  } | null> {
    const { data: dbRecord } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!dbRecord?.stripe_account_id) {
      return null;
    }

    const account = await this.getConnectAccount(dbRecord.stripe_account_id);
    if (!account) {
      return null;
    }

    return { account, dbRecord };
  }

  async updateConnectAccountFromWebhook(
    stripeAccountId: string,
    accountData: Stripe.Account
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('connected_accounts')
      .update({
        charges_enabled: accountData.charges_enabled,
        payouts_enabled: accountData.payouts_enabled,
        details_submitted: accountData.details_submitted,
        onboarding_complete: accountData.charges_enabled && accountData.payouts_enabled && accountData.details_submitted,
        requirements_disabled_reason: accountData.requirements?.disabled_reason || null,
        requirements_current_deadline: accountData.requirements?.current_deadline 
          ? new Date(accountData.requirements.current_deadline * 1000).toISOString()
          : null,
        default_currency: accountData.default_currency || 'usd',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', stripeAccountId);

    return !error;
  }

  async createLoginLink(stripeAccountId: string): Promise<Stripe.LoginLink> {
    const stripe = await getUncachableStripeClient();
    return await stripe.accounts.createLoginLink(stripeAccountId);
  }

  async listConnectedAccounts(options: {
    limit?: number;
    startingAfter?: string;
    onlyComplete?: boolean;
  } = {}): Promise<{ accounts: any[]; total: number }> {
    let query = supabaseAdmin
      .from('connected_accounts')
      .select('*', { count: 'exact' });

    if (options.onlyComplete) {
      query = query.eq('onboarding_complete', true);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(options.limit || 50);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to list connected accounts: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { accounts: [], total: count || 0 };
    }

    const userIds = data.map(account => account.user_id);
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, display_name')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, { email: p.email, display_name: p.display_name }])
    );

    const accountsWithProfiles = data.map(account => ({
      ...account,
      email: profileMap.get(account.user_id)?.email || null,
      display_name: profileMap.get(account.user_id)?.display_name || null,
    }));

    return {
      accounts: accountsWithProfiles,
      total: count || 0,
    };
  }

  async getConnectDashboardMetrics(): Promise<{
    total: number;
    onboardingComplete: number;
    onboardingPending: number;
    chargesEnabled: number;
    payoutsEnabled: number;
    restricted: number;
  }> {
    const { data: accounts } = await supabaseAdmin
      .from('connected_accounts')
      .select('onboarding_complete, charges_enabled, payouts_enabled, requirements_disabled_reason');

    if (!accounts) {
      return {
        total: 0,
        onboardingComplete: 0,
        onboardingPending: 0,
        chargesEnabled: 0,
        payoutsEnabled: 0,
        restricted: 0,
      };
    }

    return {
      total: accounts.length,
      onboardingComplete: accounts.filter(a => a.onboarding_complete).length,
      onboardingPending: accounts.filter(a => !a.onboarding_complete).length,
      chargesEnabled: accounts.filter(a => a.charges_enabled).length,
      payoutsEnabled: accounts.filter(a => a.payouts_enabled).length,
      restricted: accounts.filter(a => a.requirements_disabled_reason).length,
    };
  }

  // ============================================
  // Phase 3: Marketplace Products & Payments
  // ============================================

  async createStripeProduct(
    name: string,
    description: string | null,
    metadata: { trainerId: string; productId: string }
  ): Promise<Stripe.Product> {
    const stripe = await getUncachableStripeClient();
    return await stripe.products.create({
      name,
      description: description || undefined,
      metadata,
    });
  }

  async updateStripeProduct(
    stripeProductId: string,
    updates: { name?: string; description?: string | null; active?: boolean }
  ): Promise<Stripe.Product> {
    const stripe = await getUncachableStripeClient();
    return await stripe.products.update(stripeProductId, {
      name: updates.name,
      description: updates.description || undefined,
      active: updates.active,
    });
  }

  async createStripePrice(
    stripeProductId: string,
    amountCents: number,
    currency: string = 'usd',
    recurring?: { interval: 'day' | 'week' | 'month' | 'year'; interval_count?: number }
  ): Promise<Stripe.Price> {
    const stripe = await getUncachableStripeClient();
    
    const priceParams: Stripe.PriceCreateParams = {
      product: stripeProductId,
      unit_amount: amountCents,
      currency,
    };

    if (recurring) {
      priceParams.recurring = {
        interval: recurring.interval,
        interval_count: recurring.interval_count || 1,
      };
    }

    return await stripe.prices.create(priceParams);
  }

  async deactivateStripePrice(stripePriceId: string): Promise<Stripe.Price> {
    const stripe = await getUncachableStripeClient();
    return await stripe.prices.update(stripePriceId, { active: false });
  }

  async createProductCheckoutSession(
    customerId: string,
    priceId: string,
    connectedAccountId: string,
    successUrl: string,
    cancelUrl: string,
    options: {
      clientId: string;
      trainerId: string;
      productId: string;
      pricingId: string;
      isSubscription: boolean;
    }
  ): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: options.isSubscription ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clientId: options.clientId,
        trainerId: options.trainerId,
        productId: options.productId,
        pricingId: options.pricingId,
        type: 'product_purchase',
      },
      payment_intent_data: options.isSubscription ? undefined : {
        transfer_data: {
          destination: connectedAccountId,
        },
        on_behalf_of: connectedAccountId,
        metadata: {
          clientId: options.clientId,
          trainerId: options.trainerId,
          productId: options.productId,
          pricingId: options.pricingId,
          type: 'product_purchase',
        },
      },
      subscription_data: options.isSubscription ? {
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          clientId: options.clientId,
          trainerId: options.trainerId,
          productId: options.productId,
          pricingId: options.pricingId,
          type: 'product_purchase',
        },
      } : undefined,
    };

    return await stripe.checkout.sessions.create(sessionParams);
  }

  async refundProductPurchase(
    paymentIntentId: string,
    reason?: string
  ): Promise<Stripe.Refund> {
    const stripe = await getUncachableStripeClient();
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: { refund_reason: reason || 'admin_initiated' },
    });
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }
}

export const stripeService = new StripeService();
