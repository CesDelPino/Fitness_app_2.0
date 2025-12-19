import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, initializeStripeClient } from './stripeClient';

let stripeInitialized = false;
let webhookUuid: string | null = null;

export async function initStripe(): Promise<{ uuid: string }> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required for Stripe integration. ' +
      'Please create a PostgreSQL database first.'
    );
  }

  if (stripeInitialized && webhookUuid) {
    return { uuid: webhookUuid };
  }

  try {
    console.log('[stripe] Initializing Stripe client...');
    await initializeStripeClient();
    
    console.log('[stripe] Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('[stripe] Schema ready');

    const stripeSync = await getStripeSync();

    console.log('[stripe] Setting up managed webhook...');
    const replitDomains = process.env.REPLIT_DOMAINS?.split(',')[0];
    if (!replitDomains) {
      throw new Error('REPLIT_DOMAINS environment variable is required');
    }
    
    const webhookBaseUrl = `https://${replitDomains}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated', 
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed',
          'customer.subscription.trial_will_end',
          'invoice.payment_succeeded',
        ],
        description: 'LOBA Tracker subscription webhooks',
      }
    );
    console.log(`[stripe] Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    webhookUuid = uuid;

    console.log('[stripe] Syncing Stripe data in background...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('[stripe] Stripe data synced');
      })
      .catch((err: Error) => {
        console.error('[stripe] Error syncing Stripe data:', err);
      });

    stripeInitialized = true;
    return { uuid };
  } catch (error) {
    console.error('[stripe] Failed to initialize Stripe:', error);
    throw error;
  }
}

export function getWebhookUuid(): string | null {
  return webhookUuid;
}
