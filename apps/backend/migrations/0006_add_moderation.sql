-- Board moderators table
CREATE TABLE board_moderators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  permissions TEXT NOT NULL DEFAULT 'all', -- 'all', 'posts', 'comments', 'users'
  assigned_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE(board_id, user_id)
);

CREATE INDEX idx_board_moderators_board ON board_moderators(board_id);
CREATE INDEX idx_board_moderators_user ON board_moderators(user_id);

-- Reported content table
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  comment_id INTEGER,
  reporter_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  resolved_by INTEGER,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE INDEX idx_reports_post ON reports(post_id);
CREATE INDEX idx_reports_comment ON reports(comment_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created ON reports(created_at DESC);

-- Banned users table
CREATE TABLE banned_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  board_id INTEGER, -- NULL for global ban
  reason TEXT NOT NULL,
  banned_by INTEGER NOT NULL,
  expires_at INTEGER, -- NULL for permanent ban
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id),
  UNIQUE(user_id, board_id)
);

CREATE INDEX idx_banned_users_user ON banned_users(user_id);
CREATE INDEX idx_banned_users_board ON banned_users(board_id);
CREATE INDEX idx_banned_users_expires ON banned_users(expires_at);

-- Moderation log table
CREATE TABLE mod_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER,
  moderator_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'remove_post', 'remove_comment', 'ban_user', 'unban_user', etc.
  target_type TEXT NOT NULL, -- 'post', 'comment', 'user'
  target_id INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_id) REFERENCES users(id)
);

CREATE INDEX idx_mod_log_board ON mod_log(board_id);
CREATE INDEX idx_mod_log_moderator ON mod_log(moderator_id);
CREATE INDEX idx_mod_log_created ON mod_log(created_at DESC);

-- Add created_by column to boards if not exists (for board ownership)
ALTER TABLE boards ADD COLUMN created_by INTEGER REFERENCES users(id);
