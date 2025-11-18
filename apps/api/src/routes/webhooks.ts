// Stripe webhook handler - handles all automated billing events
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createStripeClient, calculateMRR, formatCurrency, type PlanKey, PLANS } from '../lib/stripe';
import { sendDiscordWebhook, DiscordNotifications } from '../lib/discord';

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DISCORD_WEBHOOK_REVENUE: string;
  DISCORD_WEBHOOK_ALERTS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Stripe webhook endpoint - receives all payment/subscription events
app.post('/stripe-webhook', async (c) => {
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json({ error: 'No signature' }, 400);
  }

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const rawBody = await c.req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error('[Webhook] Signature verification failed:', error.message);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  console.log('[Webhook] Received event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, c.env);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, c.env);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, c.env);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, c.env);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, c.env);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, c.env);
        break;

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    return c.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error processing event:', error);
    await sendDiscordWebhook(
      c.env.DISCORD_WEBHOOK_ALERTS,
      DiscordNotifications.error('Webhook processing failed', error.message)
    );
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Handle checkout session completion
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, env: Bindings) {
  const userId = session.metadata?.userId;
  const planKey = session.metadata?.planKey as PlanKey;

  if (!userId || !planKey) {
    console.error('[Webhook] Missing metadata in checkout session');
    return;
  }

  console.log('[Webhook] Checkout completed for user:', userId, 'plan:', planKey);

  // Subscription will be created via customer.subscription.created event
  // Just log this for now
}

// Handle new subscription creation
async function handleSubscriptionCreated(subscription: Stripe.Subscription, env: Bindings) {
  const customerId = subscription.customer as string;
  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

  // Get customer to find userId
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
  const userId = customer.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] No userId in customer metadata');
    return;
  }

  // Determine plan from price amount
  const priceAmount = subscription.items.data[0].price.unit_amount || 0;
  let planKey: PlanKey = 'premium';
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.price === priceAmount) {
      planKey = key as PlanKey;
      break;
    }
  }

  // Get period dates from subscription item
  const subscriptionItem = subscription.items.data[0];
  const periodStart = subscriptionItem.current_period_start || subscription.billing_cycle_anchor || Math.floor(Date.now() / 1000);
  const periodEnd = subscriptionItem.current_period_end || (periodStart + 30 * 24 * 60 * 60); // Default to 30 days if missing

  // Save subscription to database
  const subscriptionId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO subscriptions (
      id, user_id, stripe_customer_id, stripe_subscription_id,
      plan, status, current_period_start, current_period_end,
      cancel_at_period_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    subscriptionId,
    userId,
    customerId,
    subscription.id,
    planKey,
    subscription.status,
    periodStart * 1000,
    periodEnd * 1000,
    subscription.cancel_at_period_end ? 1 : 0,
    Date.now(),
    Date.now()
  ).run();

  // Record transaction
  const transactionId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO transactions (
      id, user_id, type, amount, currency, stripe_payment_intent_id,
      description, status, created_at
    ) VALUES (?, ?, 'subscription', ?, 'usd', ?, ?, 'pending', ?)
  `).bind(
    transactionId,
    userId,
    priceAmount,
    subscription.latest_invoice as string,
    `${PLANS[planKey].name} subscription`,
    Date.now()
  ).run();

  // Get user for notification
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

  // Calculate new MRR
  const allSubs = await env.DB.prepare(`
    SELECT plan FROM subscriptions WHERE status = 'active'
  `).all();
  const mrr = calculateMRR(allSubs.results);

  // Notify Discord
  await sendDiscordWebhook(
    env.DISCORD_WEBHOOK_REVENUE,
    DiscordNotifications.newSubscription(
      user?.username as string,
      PLANS[planKey].name,
      priceAmount,
      mrr
    )
  );

  console.log('[Webhook] Subscription created for user:', userId);
}

// Handle subscription updates (plan changes, cancellations, etc.)
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, env: Bindings) {
  // Get period dates from subscription item
  const subscriptionItem = subscription.items.data[0];
  const periodStart = subscriptionItem.current_period_start || subscription.billing_cycle_anchor || Math.floor(Date.now() / 1000);
  const periodEnd = subscriptionItem.current_period_end || (periodStart + 30 * 24 * 60 * 60);

  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = ?,
        current_period_start = ?,
        current_period_end = ?,
        cancel_at_period_end = ?,
        updated_at = ?
    WHERE stripe_subscription_id = ?
  `).bind(
    subscription.status,
    periodStart * 1000,
    periodEnd * 1000,
    subscription.cancel_at_period_end ? 1 : 0,
    Date.now(),
    subscription.id
  ).run();

  console.log('[Webhook] Subscription updated:', subscription.id);
}

// Handle subscription deletion/cancellation
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, env: Bindings) {
  // Update subscription status
  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = 'canceled', updated_at = ?
    WHERE stripe_subscription_id = ?
  `).bind(Date.now(), subscription.id).run();

  // Get subscription details for notification
  const sub = await env.DB.prepare(`
    SELECT s.*, u.username
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    WHERE s.stripe_subscription_id = ?
  `).bind(subscription.id).first();

  if (sub) {
    // Calculate new MRR
    const allSubs = await env.DB.prepare(`
      SELECT plan FROM subscriptions WHERE status = 'active'
    `).all();
    const mrr = calculateMRR(allSubs.results);

    // Notify Discord
    await sendDiscordWebhook(
      env.DISCORD_WEBHOOK_REVENUE,
      DiscordNotifications.subscriptionCanceled(
        sub.username as string,
        sub.plan as string,
        mrr
      )
    );
  }

  console.log('[Webhook] Subscription deleted:', subscription.id);
}

// Handle successful payment
async function handlePaymentSucceeded(invoice: Stripe.Invoice, env: Bindings) {
  const customerId = invoice.customer as string;
  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

  // Get customer to find userId
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
  const userId = customer.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] No userId in customer metadata');
    return;
  }

  // Update transaction status
  await env.DB.prepare(`
    UPDATE transactions
    SET status = 'succeeded'
    WHERE stripe_payment_intent_id = ? OR stripe_invoice_id = ?
  `).bind(invoice.payment_intent as string || null, invoice.id).run();

  // Record new transaction if it doesn't exist
  const existing = await env.DB.prepare(`
    SELECT id FROM transactions WHERE stripe_invoice_id = ?
  `).bind(invoice.id).first();

  if (!existing) {
    const transactionId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO transactions (
        id, user_id, type, amount, currency,
        stripe_invoice_id, stripe_payment_intent_id,
        description, status, created_at
      ) VALUES (?, ?, 'subscription', ?, 'usd', ?, ?, ?, 'succeeded', ?)
    `).bind(
      transactionId,
      userId,
      invoice.amount_paid,
      invoice.id,
      invoice.payment_intent as string || null,
      'Subscription payment',
      Date.now()
    ).run();
  }

  // Get user for notification
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

  // Notify Discord
  await sendDiscordWebhook(
    env.DISCORD_WEBHOOK_REVENUE,
    DiscordNotifications.paymentSucceeded(
      user?.username as string,
      invoice.amount_paid
    )
  );

  console.log('[Webhook] Payment succeeded:', formatCurrency(invoice.amount_paid));
}

// Handle failed payment
async function handlePaymentFailed(invoice: Stripe.Invoice, env: Bindings) {
  const customerId = invoice.customer as string;
  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

  // Get customer to find userId
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
  const userId = customer.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] No userId in customer metadata');
    return;
  }

  // Get user for notification
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

  // Notify Discord with alert
  await sendDiscordWebhook(
    env.DISCORD_WEBHOOK_ALERTS,
    DiscordNotifications.paymentFailed(
      user?.username as string,
      invoice.amount_due,
      invoice.last_finalization_error?.message || 'Unknown error'
    )
  );

  console.log('[Webhook] Payment failed for user:', userId);
}

export default app;
