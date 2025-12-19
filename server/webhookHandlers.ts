import { getStripeSync, initializeStripeClient } from './stripeClient';
import { supabaseAdmin } from './supabase-admin';
import { invalidateFeatureCache } from './feature-access';
import Stripe from 'stripe';

async function findUserByEmailPaginated(email: string): Promise<{ id: string; email: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const matchingUsers: { id: string; email: string }[] = [];
  let page = 1;
  const perPage = 50;
  
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error) {
      console.error('[webhook] Error listing users page', page, error);
      break;
    }
    
    if (!data?.users || data.users.length === 0) {
      break;
    }
    
    for (const user of data.users) {
      if (user.email && user.email.toLowerCase().trim() === normalizedEmail) {
        matchingUsers.push({ id: user.id, email: user.email });
      }
    }
    
    if (data.users.length < perPage) {
      break;
    }
    
    page++;
    
    if (page > 100) {
      console.warn('[webhook] Reached max page limit during user search');
      break;
    }
  }
  
  if (matchingUsers.length === 1) {
    return matchingUsers[0];
  } else if (matchingUsers.length > 1) {
    console.warn(`[webhook] Multiple users found with email ${normalizedEmail}, skipping ambiguous match`);
    return null;
  } else {
    console.log(`[webhook] No user found with email ${normalizedEmail}`);
    return null;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    const webhookSecret = await sync.getWebhookSecret(uuid);
    const stripe = await initializeStripeClient();
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[webhook] Signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
    
    console.log(`[webhook] Processing event: ${event.type} (${event.id})`);
    
    try {
      await sync.processWebhook(payload, signature, uuid);
    } catch (syncErr: any) {
      console.error(`[webhook] Error syncing event ${event.type}:`, syncErr);
      const criticalEvents = [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_failed',
        'checkout.session.completed',
      ];
      if (criticalEvents.includes(event.type)) {
        throw new Error(`[webhook] Sync failed for critical event ${event.type}, aborting to trigger Stripe retry`);
      }
    }
    
    const alreadyProcessed = await WebhookHandlers.isEventProcessed(event.id);
    if (alreadyProcessed) {
      console.log(`[webhook] Event ${event.id} already processed for routing, skipping`);
      return;
    }
    
    try {
      await WebhookHandlers.routeEvent(event);
      await WebhookHandlers.markEventProcessed(event.id, event.type);
    } catch (err: any) {
      console.error(`[webhook] Error handling ${event.type}:`, err);
      throw err;
    }
  }
  
  private static async isEventProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('id')
      .eq('stripe_event_id', eventId)
      .maybeSingle();
    
    if (error) {
      console.error('[webhook] Error checking event processed status:', error);
      return false;
    }
    return !!data;
  }
  
  private static async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    await supabaseAdmin
      .from('stripe_webhook_events')
      .upsert(
        {
          stripe_event_id: eventId,
          event_type: eventType,
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_event_id' }
      );
  }

  private static async routeEvent(event: Stripe.Event): Promise<void> {
    const data = event.data.object as any;
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = data as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;
        const userId = session.metadata?.userId;
        
        if (session.metadata?.type === 'product_purchase') {
          await WebhookHandlers.handleProductPurchaseCompleted(session);
        } else if (customerId && subscriptionId) {
          await WebhookHandlers.handleCheckoutCompleted(session.id, customerId, subscriptionId, userId);
        }
        break;
      }
      
      case 'customer.subscription.created': {
        const subscription = data as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as any)?.id;
        if (customerId) {
          await WebhookHandlers.handleSubscriptionCreatedFull(subscription, customerId);
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = data as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionUpdatedFull(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = data as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionDeleted(subscription.id);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = data as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as any)?.id;
        if (subscriptionId) {
          await WebhookHandlers.handlePaymentFailed(subscriptionId);
        }
        break;
      }
      
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = data as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as any)?.id;
        if (subscriptionId && invoice.billing_reason !== 'subscription_create') {
          const periodStart = invoice.period_start || (invoice.lines?.data?.[0]?.period as any)?.start;
          const periodEnd = invoice.period_end || (invoice.lines?.data?.[0]?.period as any)?.end;
          if (periodStart && periodEnd) {
            await WebhookHandlers.handleInvoicePaid(subscriptionId, periodStart, periodEnd);
          }
        }
        break;
      }
      
      case 'customer.subscription.trial_will_end': {
        const subscription = data as Stripe.Subscription;
        await WebhookHandlers.handleTrialWillEnd(subscription.id);
        break;
      }

      // Stripe Connect events
      case 'account.updated': {
        const account = data as Stripe.Account;
        await WebhookHandlers.handleConnectAccountUpdated(account);
        break;
      }

      case 'account.application.deauthorized': {
        const application = data as any;
        if (application.account) {
          await WebhookHandlers.handleConnectAccountDeauthorized(application.account);
        }
        break;
      }
      
      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  }

  static async handleSubscriptionCreatedFull(subscription: Stripe.Subscription, customerId: string): Promise<void> {
    console.log(`[webhook] Subscription created: ${subscription.id} for customer ${customerId}, status=${subscription.status}`);
    
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (!profile && subscription.metadata?.userId) {
      const userId = subscription.metadata.userId;
      console.log(`[webhook] Looking up profile by userId from metadata: ${userId}`);
      
      const { data: profileByUserId } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (profileByUserId) {
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
        profile = profileByUserId;
        console.log(`[webhook] Updated profile ${userId} with stripe_customer_id ${customerId}`);
      }
    }
    
    if (!profile) {
      const stripe = await initializeStripeClient();
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted && 'email' in customer && customer.email) {
          const customerEmail = customer.email.toLowerCase().trim();
          console.log(`[webhook] Looking up profile by customer email: ${customerEmail}`);
          
          const matchingUser = await findUserByEmailPaginated(customerEmail);
          
          if (matchingUser) {
            const { data: profileByEmail } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', matchingUser.id)
              .maybeSingle();
            
            if (profileByEmail) {
              await supabaseAdmin
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', matchingUser.id);
              profile = profileByEmail;
              console.log(`[webhook] Updated profile ${matchingUser.id} with stripe_customer_id via email match`);
            }
          }
        }
      } catch (err) {
        console.error('[webhook] Error looking up customer by email:', err);
      }
    }
    
    if (profile) {
      const subscriptionData: Record<string, any> = {
        user_id: profile.id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: subscription.status,
        current_period_start: subscription.current_period_start 
          ? new Date(subscription.current_period_start * 1000).toISOString() 
          : null,
        current_period_end: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      };
      
      if (subscription.trial_start) {
        subscriptionData.trial_start = new Date(subscription.trial_start * 1000).toISOString();
      }
      if (subscription.trial_end) {
        subscriptionData.trial_end = new Date(subscription.trial_end * 1000).toISOString();
      }
      if (subscription.cancel_at) {
        subscriptionData.cancel_at = new Date(subscription.cancel_at * 1000).toISOString();
      }
      if (subscription.canceled_at) {
        subscriptionData.canceled_at = new Date(subscription.canceled_at * 1000).toISOString();
      }
      
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert(subscriptionData);
      
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await WebhookHandlers.upgradeToPremium(profile.id);
        
        if (subscription.status === 'trialing') {
          await supabaseAdmin
            .from('trial_history')
            .upsert({
              user_id: profile.id,
              trial_started_at: subscription.trial_start 
                ? new Date(subscription.trial_start * 1000).toISOString() 
                : new Date().toISOString(),
              converted_to_paid: false,
            });
        }
      }
      
      invalidateFeatureCache(profile.id);
    }
  }

  static async handleSubscriptionUpdatedFull(subscription: Stripe.Subscription): Promise<void> {
    console.log(`[webhook] Subscription updated: ${subscription.id} status=${subscription.status}`);
    
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : (subscription.customer as any)?.id;
    
    const { data: existingSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, status')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    if (existingSub) {
      const previousStatus = existingSub.status;
      const updateData: Record<string, any> = {
        status: subscription.status,
        current_period_start: subscription.current_period_start 
          ? new Date(subscription.current_period_start * 1000).toISOString() 
          : null,
        current_period_end: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      };
      
      if (subscription.trial_start) {
        updateData.trial_start = new Date(subscription.trial_start * 1000).toISOString();
      }
      if (subscription.trial_end) {
        updateData.trial_end = new Date(subscription.trial_end * 1000).toISOString();
      }
      if (subscription.cancel_at) {
        updateData.cancel_at = new Date(subscription.cancel_at * 1000).toISOString();
      } else {
        updateData.cancel_at = null;
      }
      if (subscription.canceled_at) {
        updateData.canceled_at = new Date(subscription.canceled_at * 1000).toISOString();
      }
      
      if (subscription.status === 'active' && previousStatus === 'past_due') {
        updateData.grace_period_end = null;
      }
      
      await supabaseAdmin
        .from('user_subscriptions')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id);

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await WebhookHandlers.upgradeToPremium(existingSub.user_id);
        
        if (previousStatus === 'trialing' && subscription.status === 'active') {
          await WebhookHandlers.handleTrialEnded(existingSub.user_id, true);
        }
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        await WebhookHandlers.downgradeToFree(existingSub.user_id);
        
        if (previousStatus === 'trialing' && subscription.status !== 'active') {
          await WebhookHandlers.handleTrialEnded(existingSub.user_id, false);
        }
      }
      
      invalidateFeatureCache(existingSub.user_id);
    }
  }

  static async handleSubscriptionDeleted(subscriptionId: string): Promise<void> {
    console.log(`[webhook] Subscription deleted: ${subscriptionId}`);
    
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (subscription) {
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);
      
      await WebhookHandlers.downgradeToFree(subscription.user_id);
      invalidateFeatureCache(subscription.user_id);
    }
  }

  static async handlePaymentFailed(subscriptionId: string): Promise<void> {
    console.log(`[webhook] Payment failed for subscription: ${subscriptionId}`);
    
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (subscription) {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);
      
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'past_due',
          grace_period_end: gracePeriodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);
      
      invalidateFeatureCache(subscription.user_id);
    }
  }

  static async handleCheckoutCompleted(
    sessionId: string,
    customerId: string,
    subscriptionId: string,
    userId?: string
  ): Promise<void> {
    console.log(`[webhook] Checkout completed: session=${sessionId}, customer=${customerId}, subscription=${subscriptionId}`);
    
    if (userId) {
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
      console.log(`[webhook] Updated profile ${userId} with stripe_customer_id ${customerId}`);
    } else {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      
      if (!existingProfile) {
        console.log(`[webhook] No user found with stripe_customer_id ${customerId} and no userId provided`);
      }
    }
  }

  static async handleProductPurchaseCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata || {};
    const { clientId, trainerId, productId, pricingId } = metadata;
    
    if (!clientId || !trainerId || !productId || !pricingId) {
      console.error('[webhook] Product purchase missing required metadata:', metadata);
      return;
    }

    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id;
    const amountTotal = session.amount_total || 0;
    const currency = session.currency || 'usd';

    console.log(`[webhook] Product purchase completed: product=${productId}, client=${clientId}, trainer=${trainerId}`);

    try {
      const { productService } = await import('./productService');
      const purchase = await productService.recordPurchase(
        productId,
        pricingId,
        clientId,
        trainerId,
        session.id,
        paymentIntentId || '',
        amountTotal,
        currency
      );

      if (purchase) {
        console.log(`[webhook] Product purchase recorded: ${purchase.id}`);
      } else {
        console.error('[webhook] Failed to record product purchase');
      }
    } catch (error) {
      console.error('[webhook] Error recording product purchase:', error);
      throw error;
    }
  }

  static async handleTrialStarted(subscriptionId: string, trialEnd: number): Promise<void> {
    console.log(`[webhook] Trial started for subscription: ${subscriptionId}, ends at ${new Date(trialEnd * 1000).toISOString()}`);
    
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (subscription) {
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'trialing',
          trial_start: new Date().toISOString(),
          trial_end: new Date(trialEnd * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);
      
      await supabaseAdmin
        .from('trial_history')
        .upsert({
          user_id: subscription.user_id,
          trial_started_at: new Date().toISOString(),
          converted_to_paid: false,
        });
      
      await WebhookHandlers.upgradeToPremium(subscription.user_id);
      invalidateFeatureCache(subscription.user_id);
    }
  }

  static async handleTrialWillEnd(subscriptionId: string): Promise<void> {
    console.log(`[webhook] Trial will end for subscription: ${subscriptionId}`);
  }

  static async handleTrialEnded(userId: string, convertedToPaid: boolean): Promise<void> {
    console.log(`[webhook] Trial ended for user: ${userId}, converted: ${convertedToPaid}`);
    
    await supabaseAdmin
      .from('trial_history')
      .update({
        trial_ended_at: new Date().toISOString(),
        converted_to_paid: convertedToPaid,
      })
      .eq('user_id', userId)
      .is('trial_ended_at', null);
  }

  static async handleInvoicePaid(subscriptionId: string, periodStart: number, periodEnd: number): Promise<void> {
    console.log(`[webhook] Invoice paid for subscription: ${subscriptionId}`);
    
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, status')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (subscription) {
      const previousStatus = subscription.status;
      
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'active',
          current_period_start: new Date(periodStart * 1000).toISOString(),
          current_period_end: new Date(periodEnd * 1000).toISOString(),
          grace_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);
      
      if (previousStatus === 'trialing') {
        await WebhookHandlers.handleTrialEnded(subscription.user_id, true);
      }
      
      await WebhookHandlers.upgradeToPremium(subscription.user_id);
      invalidateFeatureCache(subscription.user_id);
    }
  }

  private static async upgradeToPremium(userId: string): Promise<void> {
    const { data: premiumPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('code', 'premium')
      .single();
    
    if (premiumPlan) {
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_plan_id: premiumPlan.id })
        .eq('id', userId);
      
      console.log(`[webhook] User ${userId} upgraded to premium`);
      
      // Unfreeze user's product purchases when Premium reactivates
      await WebhookHandlers.unfreezeUserPurchases(userId);
    }
  }
  
  // Unfreeze all product purchases for a user when their Premium subscription reactivates
  private static async unfreezeUserPurchases(userId: string): Promise<void> {
    try {
      const { data, error } = await supabaseAdmin.rpc('unfreeze_user_purchases', {
        p_user_id: userId
      });
      
      if (error) {
        console.error(`[webhook] Error unfreezing purchases for user ${userId}:`, error);
        return;
      }
      
      if (data && data > 0) {
        console.log(`[webhook] Unfroze ${data} purchases for user ${userId}`);
      }
    } catch (err) {
      // Don't throw - this is a non-critical operation
      console.error(`[webhook] Failed to unfreeze purchases for user ${userId}:`, err);
    }
  }

  private static async downgradeToFree(userId: string): Promise<void> {
    const { data: freePlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('code', 'free')
      .single();
    
    if (freePlan) {
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_plan_id: freePlan.id })
        .eq('id', userId);
      
      console.log(`[webhook] User ${userId} downgraded to free`);
      
      // Freeze user's product purchases when Premium lapses
      await WebhookHandlers.freezeUserPurchases(userId);
    }
  }
  
  // Freeze all product purchases for a user when their Premium subscription lapses
  private static async freezeUserPurchases(userId: string): Promise<void> {
    try {
      const { data, error } = await supabaseAdmin.rpc('freeze_user_purchases', {
        p_user_id: userId
      });
      
      if (error) {
        console.error(`[webhook] Error freezing purchases for user ${userId}:`, error);
        return;
      }
      
      console.log(`[webhook] Froze ${data || 0} purchases for user ${userId}`);
    } catch (err) {
      // Don't throw - this is a non-critical operation
      console.error(`[webhook] Failed to freeze purchases for user ${userId}:`, err);
    }
  }

  // ==================== STRIPE CONNECT WEBHOOK HANDLERS ====================

  static async handleConnectAccountUpdated(account: Stripe.Account): Promise<void> {
    console.log(`[webhook] Connect account updated: ${account.id}, charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`);
    
    const { data: existingAccount } = await supabaseAdmin
      .from('connected_accounts')
      .select('user_id, onboarding_complete')
      .eq('stripe_account_id', account.id)
      .single();
    
    if (!existingAccount) {
      console.log(`[webhook] No connected_account record found for ${account.id}, skipping`);
      return;
    }

    const wasOnboardingComplete = existingAccount.onboarding_complete;
    const isNowComplete = account.charges_enabled && account.payouts_enabled && account.details_submitted;

    const { error } = await supabaseAdmin
      .from('connected_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_complete: isNowComplete,
        requirements_disabled_reason: account.requirements?.disabled_reason || null,
        requirements_current_deadline: account.requirements?.current_deadline 
          ? new Date(account.requirements.current_deadline * 1000).toISOString()
          : null,
        default_currency: account.default_currency || 'usd',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', account.id);

    if (error) {
      console.error(`[webhook] Error updating connected_account ${account.id}:`, error);
      throw error;
    }

    if (!wasOnboardingComplete && isNowComplete) {
      console.log(`[webhook] Trainer ${existingAccount.user_id} completed Connect onboarding!`);
    }

    if (account.requirements?.disabled_reason) {
      console.warn(`[webhook] Connect account ${account.id} has been restricted: ${account.requirements.disabled_reason}`);
    }
  }

  static async handleConnectAccountDeauthorized(stripeAccountId: string): Promise<void> {
    console.log(`[webhook] Connect account deauthorized: ${stripeAccountId}`);
    
    const { error } = await supabaseAdmin
      .from('connected_accounts')
      .update({
        charges_enabled: false,
        payouts_enabled: false,
        onboarding_complete: false,
        requirements_disabled_reason: 'application_deauthorized',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', stripeAccountId);

    if (error) {
      console.error(`[webhook] Error handling deauthorization for ${stripeAccountId}:`, error);
      throw error;
    }
  }

  // Process Connect-specific webhooks with separate idempotency tracking
  static async processConnectWebhook(payload: Buffer, signature: string, webhookSecret: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('STRIPE CONNECT WEBHOOK ERROR: Payload must be a Buffer.');
    }

    const stripe = await initializeStripeClient();
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[connect-webhook] Signature verification failed:', err.message);
      throw new Error(`Connect webhook signature verification failed: ${err.message}`);
    }
    
    console.log(`[connect-webhook] Processing event: ${event.type} (${event.id})`);
    
    // Check idempotency using connect-specific table
    const alreadyProcessed = await WebhookHandlers.isConnectEventProcessed(event.id);
    if (alreadyProcessed) {
      console.log(`[connect-webhook] Event ${event.id} already processed, skipping`);
      return;
    }
    
    try {
      await WebhookHandlers.routeEvent(event);
      await WebhookHandlers.markConnectEventProcessed(event.id, event.type, event.account || null);
    } catch (err: any) {
      console.error(`[connect-webhook] Error handling ${event.type}:`, err);
      throw err;
    }
  }

  private static async isConnectEventProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('stripe_connect_webhook_events')
      .select('id')
      .eq('stripe_event_id', eventId)
      .maybeSingle();
    
    if (error) {
      console.error('[connect-webhook] Error checking event processed status:', error);
      return false;
    }
    return !!data;
  }

  private static async markConnectEventProcessed(
    eventId: string, 
    eventType: string, 
    stripeAccountId: string | null
  ): Promise<void> {
    await supabaseAdmin
      .from('stripe_connect_webhook_events')
      .upsert(
        {
          stripe_event_id: eventId,
          event_type: eventType,
          stripe_account_id: stripeAccountId,
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_event_id' }
      );
  }
}
