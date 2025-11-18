// Stripe integration for VapeIndex
import Stripe from 'stripe';

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });
}

// Subscription plans configuration
export const PLANS = {
  premium: {
    name: 'Premium',
    price: 900, // $9.00
    interval: 'month' as const,
    features: [
      'Ad-free experience',
      'Price drop alerts',
      'Unlimited posting',
      'Premium badge',
      'Advanced search filters'
    ]
  },
  pro: {
    name: 'Pro',
    price: 2900, // $29.00
    interval: 'month' as const,
    features: [
      'Everything in Premium',
      'Verified badge',
      'Analytics dashboard',
      'Featured placement',
      'Priority support'
    ]
  },
  sponsor_basic: {
    name: 'Basic Sponsorship',
    price: 9900, // $99.00
    interval: 'month' as const,
    features: [
      'Featured badge',
      'Priority ranking',
      'Analytics dashboard'
    ]
  },
  sponsor_premium: {
    name: 'Premium Sponsorship',
    price: 29900, // $299.00
    interval: 'month' as const,
    features: [
      'Everything in Basic',
      'Homepage placement',
      'Weekly reports',
      'Dedicated support'
    ]
  },
  api_starter: {
    name: 'API Starter',
    price: 9900, // $99.00
    interval: 'month' as const,
    features: [
      'Read-only API access',
      '10,000 requests/month',
      'Email support'
    ]
  },
  api_professional: {
    name: 'API Professional',
    price: 29900, // $299.00
    interval: 'month' as const,
    features: [
      'Full API access',
      '100,000 requests/month',
      'Webhooks',
      'Priority support'
    ]
  },
  api_enterprise: {
    name: 'API Enterprise',
    price: 99900, // $999.00
    interval: 'month' as const,
    features: [
      'Unlimited requests',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated support'
    ]
  }
} as const;

export type PlanKey = keyof typeof PLANS;

// Helper to get or create Stripe customer
export async function getOrCreateCustomer(
  stripe: Stripe,
  email: string,
  userId: string,
  username: string
): Promise<Stripe.Customer> {
  // Search for existing customer
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return await stripe.customers.create({
    email,
    metadata: {
      userId,
      username,
      platform: 'vapeindex'
    }
  });
}

// Calculate MRR (Monthly Recurring Revenue)
export function calculateMRR(subscriptions: any[]): number {
  return subscriptions
    .filter(sub => sub.status === 'active')
    .reduce((total, sub) => {
      const plan = PLANS[sub.plan as PlanKey];
      return total + (plan?.price || 0);
    }, 0);
}

// Format currency
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}
