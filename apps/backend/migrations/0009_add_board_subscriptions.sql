-- Board subscriptions for personalized feed
-- Users can subscribe to boards they're interested in

CREATE TABLE IF NOT EXISTS board_subscriptions (
  user_id INTEGER NOT NULL,
  board_id INTEGER NOT NULL,
  subscribed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, board_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- Index for getting user's subscribed boards
CREATE INDEX idx_board_subscriptions_user ON board_subscriptions(user_id);

-- Index for getting board's subscriber count
CREATE INDEX idx_board_subscriptions_board ON board_subscriptions(board_id);

-- Add subscriber_count to board_stats for caching
ALTER TABLE board_stats ADD COLUMN subscriber_count INTEGER DEFAULT 0;
