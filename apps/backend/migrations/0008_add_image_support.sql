-- Add image support to posts
-- Posts can now have an image instead of URL or content

ALTER TABLE posts ADD COLUMN image_url TEXT;

-- Index for image posts
CREATE INDEX idx_posts_image ON posts(image_url) WHERE image_url IS NOT NULL;
