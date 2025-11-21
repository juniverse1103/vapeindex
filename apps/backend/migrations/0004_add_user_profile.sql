-- Add user profile fields
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN location TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Add user preferences (stored as JSON-like flags, or separate columns)
ALTER TABLE users ADD COLUMN show_nsfw INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN compact_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN profile_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN hide_online INTEGER NOT NULL DEFAULT 0;
