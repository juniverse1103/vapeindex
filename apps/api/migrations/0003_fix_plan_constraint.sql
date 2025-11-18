-- Fix subscriptions table to support all 7 plan types
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Create new table with correct constraint
CREATE TABLE subscriptions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK(plan IN ('premium', 'pro', 'sponsor_basic', 'sponsor_premium', 'api_starter', 'api_professional', 'api_enterprise')),
  status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Copy existing data
INSERT INTO subscriptions_new SELECT * FROM subscriptions;

-- Drop old table
DROP TABLE subscriptions;

-- Rename new table
ALTER TABLE subscriptions_new RENAME TO subscriptions;

-- Recreate indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
