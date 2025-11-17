-- VapeIndex.io Database Schema
-- Designed for viral growth with network effects

-- Users (Discord OAuth)
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Discord user ID
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  karma INTEGER DEFAULT 0, -- Reputation score (network effect)
  joined_at INTEGER NOT NULL, -- Unix timestamp
  last_seen INTEGER NOT NULL,
  is_moderator BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  referral_code TEXT UNIQUE, -- Viral growth mechanic
  referred_by TEXT, -- Who invited them
  FOREIGN KEY (referred_by) REFERENCES users(id)
);

CREATE INDEX idx_users_karma ON users(karma DESC);
CREATE INDEX idx_users_referral ON users(referral_code);

-- Strains (Namuwiki-style expandable wiki)
CREATE TABLE strains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('indica', 'sativa', 'hybrid')),
  description TEXT,
  effects TEXT, -- JSON array
  flavors TEXT, -- JSON array
  thc_range TEXT, -- e.g., "18-24%"
  cbd_range TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  edit_count INTEGER DEFAULT 0, -- Track community contributions
  view_count INTEGER DEFAULT 0, -- Engagement metric
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_strains_slug ON strains(slug);
CREATE INDEX idx_strains_type ON strains(type);
CREATE INDEX idx_strains_views ON strains(view_count DESC);

-- Products (carts, batteries, disposables)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('cart', 'battery', 'disposable')),
  brand TEXT NOT NULL,
  strain_id TEXT, -- Optional link to strain
  thc_percentage REAL,
  cbd_percentage REAL,
  size_ml REAL, -- Cartridge/disposable size
  battery_mah INTEGER, -- Battery capacity
  description TEXT,
  image_url TEXT,
  avg_rating REAL DEFAULT 0, -- Cached average
  review_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  view_count INTEGER DEFAULT 0,
  FOREIGN KEY (strain_id) REFERENCES strains(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_strain ON products(strain_id);
CREATE INDEX idx_products_rating ON products(avg_rating DESC);

-- Product Reviews
CREATE TABLE product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  pros TEXT, -- JSON array
  cons TEXT, -- JSON array
  verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0, -- Upvotes
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(product_id, user_id) -- One review per user per product
);

CREATE INDEX idx_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_reviews_user ON product_reviews(user_id);
CREATE INDEX idx_reviews_rating ON product_reviews(rating DESC);
CREATE INDEX idx_reviews_helpful ON product_reviews(helpful_count DESC);

-- Posts (HackerNews-style discussions)
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT, -- Optional external link
  content TEXT, -- Self-post content
  author_id TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK(post_type IN ('link', 'text', 'ask', 'show')),
  score INTEGER DEFAULT 0, -- Net votes (upvotes - downvotes)
  comment_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  trending_score REAL DEFAULT 0, -- Calculated by Durable Object
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_posts_score ON posts(score DESC);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_trending ON posts(trending_score DESC);
CREATE INDEX idx_posts_author ON posts(author_id);

-- Comments (Reddit-style threaded discussions)
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT, -- NULL for top-level comments
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0, -- Nesting level
  path TEXT NOT NULL, -- Materialized path for ordering (e.g., "001.002.001")
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_comments_post ON comments(post_id, path);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_score ON comments(score DESC);

-- Votes (for posts and comments)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment', 'review')),
  target_id TEXT NOT NULL,
  vote_type INTEGER NOT NULL CHECK(vote_type IN (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, target_type, target_id) -- One vote per user per item
);

CREATE INDEX idx_votes_target ON votes(target_type, target_id);
CREATE INDEX idx_votes_user ON votes(user_id);

-- Dispensary Prices (for future price tracking)
CREATE TABLE dispensary_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  dispensary_name TEXT NOT NULL,
  dispensary_location TEXT, -- e.g., "Venice, LA"
  price_usd REAL NOT NULL,
  available BOOLEAN DEFAULT TRUE,
  last_updated INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_prices_product ON dispensary_prices(product_id);
CREATE INDEX idx_prices_location ON dispensary_prices(dispensary_location);
CREATE INDEX idx_prices_updated ON dispensary_prices(last_updated DESC);

-- Moderation Flags
CREATE TABLE moderation_flags (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment', 'review', 'user')),
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('spam', 'harassment', 'misinformation', 'illegal', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE INDEX idx_flags_status ON moderation_flags(status);
CREATE INDEX idx_flags_target ON moderation_flags(target_type, target_id);
CREATE INDEX idx_flags_created ON moderation_flags(created_at DESC);

-- Referrals (viral growth tracking)
CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referee_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  reward_given BOOLEAN DEFAULT FALSE, -- Track if referrer got reward
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referee_id) REFERENCES users(id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_created ON referrals(created_at DESC);
