-- Revenue System Schema
-- Tracks subscriptions, transactions, and automated billing

-- Subscriptions (Premium/Pro users)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK(plan IN ('premium', 'pro')),
  status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Transactions (all revenue events)
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('subscription', 'sponsorship', 'affiliate', 'api_access', 'one_time')),
  amount INTEGER NOT NULL, -- In cents
  currency TEXT DEFAULT 'usd',
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'succeeded', 'failed', 'refunded')),
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- Sponsorships (brands paying for featured placement)
CREATE TABLE sponsorships (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('basic', 'premium')),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'past_due')),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_sponsorships_product ON sponsorships(product_id);
CREATE INDEX idx_sponsorships_status ON sponsorships(status);
CREATE INDEX idx_sponsorships_ends_at ON sponsorships(ends_at);

-- API Keys (dispensary/brand API access)
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, -- Customer/company name
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK(plan IN ('starter', 'professional', 'enterprise')),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  rate_limit INTEGER NOT NULL, -- Requests per month (-1 = unlimited)
  status TEXT NOT NULL CHECK(status IN ('active', 'suspended', 'canceled')),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- Affiliate Clicks (track outbound product clicks)
CREATE TABLE affiliate_clicks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  referrer TEXT, -- URL they came from
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_affiliate_clicks_product ON affiliate_clicks(product_id);
CREATE INDEX idx_affiliate_clicks_created ON affiliate_clicks(created_at DESC);

-- Affiliate Conversions (tracked sales)
CREATE TABLE affiliate_conversions (
  id TEXT PRIMARY KEY,
  click_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  order_value INTEGER NOT NULL, -- In cents
  commission INTEGER NOT NULL, -- In cents
  partner TEXT NOT NULL, -- 'eaze', 'weedmaps', 'dutchie', etc.
  partner_order_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'paid_out')),
  confirmed_at INTEGER,
  paid_out_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (click_id) REFERENCES affiliate_clicks(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_affiliate_conversions_click ON affiliate_conversions(click_id);
CREATE INDEX idx_affiliate_conversions_status ON affiliate_conversions(status);
CREATE INDEX idx_affiliate_conversions_created ON affiliate_conversions(created_at DESC);

-- Revenue Analytics (cached daily stats)
CREATE TABLE revenue_stats (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  new_subscriptions INTEGER DEFAULT 0,
  canceled_subscriptions INTEGER DEFAULT 0,
  subscription_revenue INTEGER DEFAULT 0, -- In cents
  sponsorship_revenue INTEGER DEFAULT 0,
  affiliate_revenue INTEGER DEFAULT 0,
  api_revenue INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  mrr INTEGER DEFAULT 0, -- Monthly Recurring Revenue
  active_subscribers INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_revenue_stats_date ON revenue_stats(date DESC);
