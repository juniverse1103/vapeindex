#!/usr/bin/env node
/**
 * Automated Stripe Setup Script for VapeIndex
 * Creates all products, prices, and webhook endpoints
 */

import Stripe from 'stripe';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .dev.vars
async function loadEnvVars() {
  const envPath = join(__dirname, '../.dev.vars');
  const envContent = await readFile(envPath, 'utf-8');

  const vars = {};
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      vars[key.trim()] = valueParts.join('=').trim();
    }
  });

  return vars;
}

// Product definitions
const PRODUCTS = [
  {
    key: 'premium',
    name: 'VapeIndex Premium',
    description: 'Ad-free experience, price alerts, unlimited posting, premium badge',
    price: 900, // $9.00
    features: [
      'Ad-free experience',
      'Price drop alerts',
      'Unlimited posting',
      'Premium badge',
      'Advanced search filters'
    ]
  },
  {
    key: 'pro',
    name: 'VapeIndex Pro',
    description: 'For influencers and brands - verified badge, analytics, featured placement',
    price: 2900, // $29.00
    features: [
      'Everything in Premium',
      'Verified badge',
      'Analytics dashboard',
      'Featured placement',
      'Priority support'
    ]
  },
  {
    key: 'sponsor_basic',
    name: 'Basic Sponsorship',
    description: 'Featured badge, priority ranking, analytics',
    price: 9900, // $99.00
    features: [
      'Featured badge on product page',
      'Priority ranking in search',
      'Analytics dashboard'
    ]
  },
  {
    key: 'sponsor_premium',
    name: 'Premium Sponsorship',
    description: 'Homepage placement, weekly reports, dedicated support',
    price: 29900, // $299.00
    features: [
      'Everything in Basic',
      'Homepage featured slot',
      'Weekly performance report',
      'Dedicated account manager'
    ]
  },
  {
    key: 'api_starter',
    name: 'API Starter',
    description: 'Read-only API access, 10k requests/month',
    price: 9900, // $99.00
    features: [
      'Read-only API access',
      'Product data sync',
      '10,000 requests/month',
      'Email support'
    ]
  },
  {
    key: 'api_professional',
    name: 'API Professional',
    description: 'Full API access, 100k requests/month, webhooks',
    price: 29900, // $299.00
    features: [
      'Everything in Starter',
      'Write access (add products)',
      '100,000 requests/month',
      'Webhook notifications',
      'Priority support'
    ]
  },
  {
    key: 'api_enterprise',
    name: 'API Enterprise',
    description: 'Unlimited requests, custom integrations, SLA',
    price: 99900, // $999.00
    features: [
      'Everything in Professional',
      'Unlimited requests',
      'Custom integrations',
      'Dedicated Slack channel',
      'SLA guarantee'
    ]
  }
];

async function createProduct(stripe, productDef) {
  console.log(`\n📦 Creating product: ${productDef.name}...`);

  // Create product
  const product = await stripe.products.create({
    name: productDef.name,
    description: productDef.description,
    metadata: {
      key: productDef.key,
      features: productDef.features.join(',')
    }
  });

  console.log(`   ✅ Product created: ${product.id}`);

  // Create price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: productDef.price,
    currency: 'usd',
    recurring: {
      interval: 'month'
    },
    lookup_key: `${productDef.key}_monthly`,
    metadata: {
      plan: productDef.key
    }
  });

  console.log(`   ✅ Price created: ${price.id} ($${(productDef.price / 100).toFixed(2)}/mo)`);

  return {
    key: productDef.key,
    productId: product.id,
    priceId: price.id,
    amount: productDef.price
  };
}

async function setupWebhook(stripe, apiUrl) {
  console.log(`\n🔗 Setting up webhook endpoint...`);

  const webhookUrl = `${apiUrl}/webhooks/stripe-webhook`;

  // Check if webhook already exists
  const existingWebhooks = await stripe.webhookEndpoints.list();
  const existing = existingWebhooks.data.find(wh => wh.url === webhookUrl);

  if (existing) {
    console.log(`   ⚠️  Webhook already exists: ${existing.id}`);
    console.log(`   Secret: ${existing.secret}`);
    return existing.secret;
  }

  // Create new webhook
  const webhook = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ],
    description: 'VapeIndex automated revenue system'
  });

  console.log(`   ✅ Webhook created: ${webhook.id}`);
  console.log(`   Secret: ${webhook.secret}`);

  return webhook.secret;
}

async function saveConfig(results, webhookSecret) {
  const config = {
    created_at: new Date().toISOString(),
    products: results,
    webhook_secret: webhookSecret,
    lookup_keys: results.reduce((acc, r) => {
      acc[r.key] = r.priceId;
      return acc;
    }, {})
  };

  const configPath = join(__dirname, '../stripe-config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`\n💾 Configuration saved to: stripe-config.json`);
}

async function main() {
  console.log('🚀 VapeIndex Stripe Setup\n');
  console.log('=' .repeat(50));

  // Load environment
  const env = await loadEnvVars();
  const stripeKey = env.STRIPE_SECRET_KEY;
  const apiUrl = env.API_URL || 'http://localhost:8787';

  if (!stripeKey || stripeKey.includes('YOUR')) {
    console.error('❌ Error: STRIPE_SECRET_KEY not configured in .dev.vars');
    process.exit(1);
  }

  const stripe = new Stripe(stripeKey);

  // Verify connection
  console.log('🔑 Connecting to Stripe...');
  const account = await stripe.accounts.retrieve();
  console.log(`   ✅ Connected to: ${account.business_profile?.name || account.id}`);
  console.log(`   Mode: ${stripeKey.startsWith('sk_test') ? '🧪 TEST' : '🔴 LIVE'}`);

  // Create all products
  console.log('\n📦 Creating products and prices...');
  const results = [];

  for (const productDef of PRODUCTS) {
    try {
      const result = await createProduct(stripe, productDef);
      results.push(result);
    } catch (error) {
      console.error(`   ❌ Failed to create ${productDef.name}:`, error.message);
    }
  }

  // Setup webhook (optional for local dev)
  let webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!apiUrl.includes('localhost')) {
    try {
      webhookSecret = await setupWebhook(stripe, apiUrl);
    } catch (error) {
      console.error(`   ⚠️  Webhook setup failed:`, error.message);
      console.log(`   For local dev, use: stripe listen --forward-to ${apiUrl}/webhooks/stripe-webhook`);
    }
  } else {
    console.log(`\n🔗 For local development, run:`);
    console.log(`   stripe listen --forward-to ${apiUrl}/webhooks/stripe-webhook`);
  }

  // Save configuration
  await saveConfig(results, webhookSecret);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Setup Complete!\n');
  console.log('Products created:');
  results.forEach(r => {
    console.log(`   • ${r.key.padEnd(20)} - $${(r.amount / 100).toFixed(2)}/mo`);
  });

  console.log('\n📝 Next steps:');
  console.log('   1. Update .dev.vars with webhook secret (if local dev)');
  console.log('   2. Start your API: wrangler dev');
  console.log('   3. Test subscription: npm run test:subscription');

  console.log('\n🎉 Your automated revenue system is ready!');
}

main().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});
