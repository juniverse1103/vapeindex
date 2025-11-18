// Subscription management endpoints
import { Hono } from 'hono';
import { createStripeClient, getOrCreateCustomer, PLANS, calculateMRR, formatCurrency, type PlanKey } from '../lib/stripe';
import { sendDiscordWebhook, DiscordNotifications } from '../lib/discord';

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  DISCORD_WEBHOOK_REVENUE: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Get available plans
app.get('/plans', (c) => {
  return c.json({
    plans: Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      price: plan.price,
      interval: plan.interval,
      features: plan.features,
      formattedPrice: formatCurrency(plan.price)
    }))
  });
});

// Create checkout session for subscription
app.post('/subscribe', async (c) => {
  const { userId, planKey } = await c.req.json();

  if (!PLANS[planKey as PlanKey]) {
    return c.json({ error: 'Invalid plan' }, 400);
  }

  // Get user from database
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const plan = PLANS[planKey as PlanKey];

  try {
    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(
      stripe,
      user.email as string,
      user.id as string,
      user.username as string
    );

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.features.join(', '),
            },
            unit_amount: plan.price,
            recurring: {
              interval: plan.interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${c.env.SITE_URL || 'http://localhost:4321'}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${c.env.SITE_URL || 'http://localhost:4321'}/upgrade`,
      metadata: {
        userId: user.id as string,
        username: user.username as string,
        planKey,
      },
    });

    return c.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('[Stripe] Error creating checkout session:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get user's subscription status
app.get('/subscription/:userId', async (c) => {
  const { userId } = c.req.param();

  const subscription = await c.env.DB.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND status IN ('active', 'trialing')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(userId).first();

  if (!subscription) {
    return c.json({ hasSubscription: false });
  }

  const plan = PLANS[subscription.plan as PlanKey];

  return c.json({
    hasSubscription: true,
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    planDetails: plan,
  });
});

// Cancel subscription
app.post('/subscription/:userId/cancel', async (c) => {
  const { userId } = c.req.param();

  const subscription = await c.env.DB.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND status = 'active'
    LIMIT 1
  `).bind(userId).first();

  if (!subscription) {
    return c.json({ error: 'No active subscription found' }, 404);
  }

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);

  try {
    // Cancel at period end (don't refund)
    await stripe.subscriptions.update(subscription.stripe_subscription_id as string, {
      cancel_at_period_end: true,
    });

    // Update database
    await c.env.DB.prepare(`
      UPDATE subscriptions
      SET cancel_at_period_end = TRUE, updated_at = ?
      WHERE id = ?
    `).bind(Date.now(), subscription.id).run();

    // Get user for notification
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();

    // Calculate new MRR (won't change until period ends)
    const allSubs = await c.env.DB.prepare(`
      SELECT plan FROM subscriptions WHERE status = 'active'
    `).all();
    const mrr = calculateMRR(allSubs.results);

    // Notify Discord
    await sendDiscordWebhook(
      c.env.DISCORD_WEBHOOK_REVENUE,
      DiscordNotifications.subscriptionCanceled(
        user?.username as string,
        subscription.plan as string,
        mrr
      )
    );

    return c.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      endsAt: subscription.current_period_end,
    });
  } catch (error: any) {
    console.error('[Stripe] Error canceling subscription:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Reactivate canceled subscription
app.post('/subscription/:userId/reactivate', async (c) => {
  const { userId } = c.req.param();

  const subscription = await c.env.DB.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND status = 'active' AND cancel_at_period_end = TRUE
    LIMIT 1
  `).bind(userId).first();

  if (!subscription) {
    return c.json({ error: 'No canceled subscription found' }, 404);
  }

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);

  try {
    // Reactivate subscription
    await stripe.subscriptions.update(subscription.stripe_subscription_id as string, {
      cancel_at_period_end: false,
    });

    // Update database
    await c.env.DB.prepare(`
      UPDATE subscriptions
      SET cancel_at_period_end = FALSE, updated_at = ?
      WHERE id = ?
    `).bind(Date.now(), subscription.id).run();

    return c.json({
      success: true,
      message: 'Subscription reactivated successfully',
    });
  } catch (error: any) {
    console.error('[Stripe] Error reactivating subscription:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get customer portal link (for managing subscription)
app.get('/customer-portal/:userId', async (c) => {
  const { userId } = c.req.param();

  const subscription = await c.env.DB.prepare(`
    SELECT stripe_customer_id FROM subscriptions
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!subscription) {
    return c.json({ error: 'No subscription found' }, 404);
  }

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id as string,
      return_url: `${c.env.SITE_URL || 'http://localhost:4321'}/account`,
    });

    return c.json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe] Error creating portal session:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
