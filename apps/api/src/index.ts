import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  TRENDING: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for Astro frontend
app.use('/*', cors({
  origin: ['http://localhost:4321', 'https://vapeindex.io'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// API routes
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
