#!/usr/bin/env node
/**
 * Check Stripe Account Readiness for Production Revenue
 */

import Stripe from 'stripe';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function checkMark(condition) {
  return condition ? '✅' : '❌';
}

async function main() {
  console.log('🔍 VapeIndex Stripe Status Check\n');
  console.log('='.repeat(60));

  const env = await loadEnvVars();

  // Check both test and live keys
  const testKey = env.STRIPE_SECRET_KEY;

  // Extract live key from commented line in .dev.vars
  const liveKeyLine = envContent.split('\n').find(line =>
    line.includes('sk_live') && line.includes('STRIPE_SECRET_KEY')
  );
  const liveKey = liveKeyLine ? liveKeyLine.split('=')[1].trim().replace(/^#\s*/, '') : null;

  console.log('\n📋 Environment Check:');
  console.log(`   ${checkMark(testKey.startsWith('sk_test'))} Test key configured`);
  console.log(`   ${checkMark(liveKey && liveKey.startsWith('sk_live'))} Live key available`);

  // Check TEST account
  console.log('\n🧪 TEST MODE Status:');
  const testStripe = new Stripe(testKey);

  try {
    const account = await testStripe.accounts.retrieve();
    console.log(`   ${checkMark(true)} Connected to Stripe`);
    console.log(`   Account: ${account.id}`);
    console.log(`   Name: ${account.business_profile?.name || 'Not set'}`);
    console.log(`   Email: ${account.email || 'Not set'}`);

    // Check products
    const products = await testStripe.products.list({ limit: 10 });
    console.log(`   ${checkMark(products.data.length > 0)} Products created: ${products.data.length}`);

    if (products.data.length > 0) {
      console.log('\n   Products:');
      for (const product of products.data) {
        const prices = await testStripe.prices.list({ product: product.id, limit: 1 });
        const price = prices.data[0];
        console.log(`   • ${product.name}: $${(price.unit_amount / 100).toFixed(2)}/mo`);
      }
    }

    // Check webhooks
    const webhooks = await testStripe.webhookEndpoints.list();
    console.log(`\n   ${checkMark(webhooks.data.length > 0)} Webhooks configured: ${webhooks.data.length}`);

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Check LIVE account (for production readiness)
  console.log('\n\n🔴 LIVE MODE Status (Production Readiness):');
  console.log('   Note: Using live key to check account status\n');

  if (!liveKey) {
    console.log('   ⚠️  No live key found in .dev.vars');
    console.log('   Live key should be in commented line: # STRIPE_SECRET_KEY=sk_live_...');
    return;
  }

  const liveStripe = new Stripe(liveKey);

  try {
    const account = await liveStripe.accounts.retrieve();

    console.log(`   ${checkMark(true)} Stripe account exists`);
    console.log(`   Account ID: ${account.id}`);
    console.log(`   ${checkMark(account.charges_enabled)} Charges enabled: ${account.charges_enabled}`);
    console.log(`   ${checkMark(account.payouts_enabled)} Payouts enabled: ${account.payouts_enabled}`);
    console.log(`   ${checkMark(account.details_submitted)} Details submitted: ${account.details_submitted}`);

    // Check capabilities
    console.log('\n   Capabilities:');
    if (account.capabilities) {
      for (const [cap, status] of Object.entries(account.capabilities)) {
        console.log(`   • ${cap}: ${status}`);
      }
    }

    // Check external accounts (bank accounts)
    const externalAccounts = await liveStripe.accounts.listExternalAccounts(account.id, {
      object: 'bank_account',
      limit: 5
    });

    console.log(`\n   ${checkMark(externalAccounts.data.length > 0)} Bank accounts: ${externalAccounts.data.length}`);

    if (externalAccounts.data.length > 0) {
      for (const bank of externalAccounts.data) {
        console.log(`   • ${bank.bank_name || 'Unknown'} ****${bank.last4} (${bank.status})`);
      }
    } else {
      console.log('   ⚠️  No bank account connected - add Mercury account!');
    }

    // Check requirements
    if (account.requirements) {
      const hasRequirements =
        (account.requirements.currently_due?.length > 0) ||
        (account.requirements.eventually_due?.length > 0) ||
        (account.requirements.past_due?.length > 0);

      console.log(`\n   ${checkMark(!hasRequirements)} Account fully verified`);

      if (account.requirements.currently_due?.length > 0) {
        console.log('   \n   ⚠️  Currently due:');
        account.requirements.currently_due.forEach(req => {
          console.log(`      • ${req}`);
        });
      }

      if (account.requirements.eventually_due?.length > 0) {
        console.log('   \n   ℹ️  Eventually due:');
        account.requirements.eventually_due.forEach(req => {
          console.log(`      • ${req}`);
        });
      }
    }

    // Check products in live mode
    const liveProducts = await liveStripe.products.list({ limit: 10 });
    console.log(`\n   ${checkMark(liveProducts.data.length > 0)} Live products created: ${liveProducts.data.length}`);

    if (liveProducts.data.length === 0) {
      console.log('   ⚠️  No products in live mode - run setup script with live keys!');
    }

  } catch (error) {
    console.log(`   ❌ Error checking live account: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📝 What You Need to Do:\n');

  console.log('1️⃣  Complete Stripe Onboarding:');
  console.log('   → https://dashboard.stripe.com/account/onboarding');
  console.log('   • Submit business info (Delaware C-corp)');
  console.log('   • Add representative details');
  console.log('   • Verify tax ID (EIN)\n');

  console.log('2️⃣  Connect Mercury Bank Account:');
  console.log('   → https://dashboard.stripe.com/settings/payouts');
  console.log('   • Add Mercury routing & account numbers');
  console.log('   • Verify micro-deposits\n');

  console.log('3️⃣  Create Products in Live Mode:');
  console.log('   • Switch .dev.vars to use live keys');
  console.log('   • Run: npm run setup:stripe');
  console.log('   • Switch back to test keys for development\n');

  console.log('4️⃣  Deploy Frontend:');
  console.log('   • Deploy vapeindex.io to Cloudflare Pages');
  console.log('   • Users need a public URL to subscribe\n');

  console.log('5️⃣  Set Up Webhooks in Live Mode:');
  console.log('   • Add webhook endpoint in Stripe dashboard');
  console.log('   • Point to: https://vapeindex-api.workers.dev/webhooks/stripe-webhook\n');

  console.log('='.repeat(60));
  console.log('\n💡 Once complete, you can accept REAL payments → Mercury! 💰\n');
}

main().catch(error => {
  console.error('\n❌ Check failed:', error.message);
  process.exit(1);
});
