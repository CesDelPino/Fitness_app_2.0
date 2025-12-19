/**
 * Stripe Products Seeding Script
 * 
 * Run this script to create Premium subscription products and prices in Stripe.
 * Usage: npx tsx server/seed-stripe-products.ts
 * 
 * This creates:
 * - LOBA Premium Monthly ($9.99/month)
 * - LOBA Premium Quarterly ($26.99/quarter - 10% off)
 * - LOBA Premium Semi-Annual ($53.99/6 months - 10% off)
 * - LOBA Premium Annual ($95.99/year - 20% off)
 */

import { getUncachableStripeClient } from './stripeClient';

interface PricingTier {
  name: string;
  interval: 'month' | 'year';
  intervalCount: number;
  amount: number;
  metadata: Record<string, string>;
}

const PRODUCT_NAME = 'LOBA Premium';
const PRODUCT_DESCRIPTION = 'Unlock AI-powered nutrition analysis, advanced micronutrient tracking, and trainer marketplace access.';

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Monthly',
    interval: 'month',
    intervalCount: 1,
    amount: 999,
    metadata: { tier: 'monthly', billing_cycle: '1_month' },
  },
  {
    name: 'Quarterly',
    interval: 'month',
    intervalCount: 3,
    amount: 2699,
    metadata: { tier: 'quarterly', billing_cycle: '3_months', discount: '10%' },
  },
  {
    name: 'Semi-Annual',
    interval: 'month',
    intervalCount: 6,
    amount: 5399,
    metadata: { tier: 'semi_annual', billing_cycle: '6_months', discount: '10%' },
  },
  {
    name: 'Annual',
    interval: 'year',
    intervalCount: 1,
    amount: 9599,
    metadata: { tier: 'annual', billing_cycle: '12_months', discount: '20%' },
  },
];

async function seedStripeProducts() {
  console.log('Starting Stripe product seeding...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}'`,
  });

  let product;
  if (existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    console.log(`Product already exists: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      metadata: {
        app: 'loba_tracker',
        type: 'subscription',
        plan_code: 'premium',
      },
    });
    console.log(`Created product: ${product.id}`);
  }

  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  const existingPriceMap = new Map<string, string>();
  for (const price of existingPrices.data) {
    const key = `${price.recurring?.interval}_${price.recurring?.interval_count}_${price.unit_amount}`;
    existingPriceMap.set(key, price.id);
  }

  for (const tier of PRICING_TIERS) {
    const key = `${tier.interval}_${tier.intervalCount}_${tier.amount}`;
    
    if (existingPriceMap.has(key)) {
      console.log(`Price already exists for ${tier.name}: ${existingPriceMap.get(key)}`);
      continue;
    }

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.amount,
      currency: 'usd',
      recurring: {
        interval: tier.interval,
        interval_count: tier.intervalCount,
      },
      metadata: {
        ...tier.metadata,
        display_name: `LOBA Premium ${tier.name}`,
      },
    });

    console.log(`Created price for ${tier.name}: ${price.id} ($${tier.amount / 100})`);
  }

  console.log('\nStripe product seeding complete!');
  console.log(`Product ID: ${product.id}`);
  console.log('\nPrices:');
  
  const allPrices = await stripe.prices.list({
    product: product.id,
    active: true,
  });
  
  for (const price of allPrices.data) {
    const tierName = price.metadata?.display_name || 'Unknown';
    console.log(`  - ${tierName}: ${price.id} ($${(price.unit_amount || 0) / 100}/${price.recurring?.interval})`);
  }
}

seedStripeProducts().catch(console.error);
