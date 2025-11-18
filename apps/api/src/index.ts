import { Hono } from 'hono';
import { cors } from 'hono/cors';
import subscriptions from './routes/subscriptions';
import webhooks from './routes/webhooks';

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  TRENDING: DurableObjectNamespace;
  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  // Discord webhooks
  DISCORD_WEBHOOK_REVENUE: string;
  DISCORD_WEBHOOK_ALERTS: string;
  DISCORD_WEBHOOK_ANALYTICS: string;
  DISCORD_WEBHOOK_MODERATION: string;
  DISCORD_WEBHOOK_GROWTH: string;
  DISCORD_WEBHOOK_BOT: string;
  // Optional
  MERCURY_API_KEY?: string;
  MERCURY_ACCOUNT_ID?: string;
  ANTHROPIC_API_KEY?: string;
  SITE_URL?: string;
  API_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for Astro frontend
app.use('/*', cors({
  origin: ['http://localhost:4321', 'https://vapeindex.io'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0'
  });
});

// Revenue routes (Stripe subscriptions)
app.route('/api/subscriptions', subscriptions);

// Webhook routes (Stripe events)
app.route('/webhooks', webhooks);

// Content API routes (to be implemented)
app.get('/api/products', async (c) => {
  // TODO: Implement product listing
  return c.json({ products: [] });
});

app.get('/api/strains', async (c) => {
  // TODO: Implement strain listing
  return c.json({ strains: [] });
});

app.post('/api/vote', async (c) => {
  // TODO: Implement voting system
  return c.json({ success: true });
});

// Durable Object for real-time trending calculations
export class TrendingCalculator {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    // TODO: Implement trending algorithm
    return new Response('Trending calculator');
  }
}

export default app;
