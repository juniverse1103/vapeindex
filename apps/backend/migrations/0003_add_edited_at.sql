-- Add edited_at column to posts and comments for tracking edits

ALTER TABLE posts ADD COLUMN edited_at INTEGER;
ALTER TABLE comments ADD COLUMN edited_at INTEGER;

-- Create index for better query performance
CREATE INDEX idx_posts_edited ON posts(edited_at) WHERE edited_at IS NOT NULL;
CREATE INDEX idx_comments_edited ON comments(edited_at) WHERE edited_at IS NOT NULL;
