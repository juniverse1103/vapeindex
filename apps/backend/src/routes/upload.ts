// Upload routes - handle image uploads to R2
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  IMAGES: R2Bucket;
};

const upload = new Hono<{ Bindings: Bindings }>();

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/upload/image
 * Upload an image to R2 (requires auth)
 */
upload.post('/image', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const formData = await c.req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return c.json({ error: 'No image file provided' }, 400);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'
      }, 400);
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return c.json({
        error: 'File too large. Maximum size is 10MB'
      }, 400);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${user.userId}/${timestamp}-${randomId}.${extension}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.IMAGES.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        uploadedBy: user.userId.toString(),
        uploadedAt: timestamp.toString(),
        originalName: file.name,
      },
    });

    // Return the image URL
    const imageUrl = `/api/images/${filename}`;

    return c.json({
      success: true,
      url: imageUrl,
      filename,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return c.json({ error: 'Failed to upload image' }, 500);
  }
});

/**
 * GET /api/images/:key
 * Serve image from R2
 */
upload.get('/images/*', async (c) => {
  try {
    const key = c.req.path.replace('/api/images/', '');

    const object = await c.env.IMAGES.get(key);

    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error('Image serve error:', error);
    return c.json({ error: 'Failed to serve image' }, 500);
  }
});

/**
 * DELETE /api/upload/image/:key
 * Delete an image from R2 (requires auth, must be uploader or mod)
 */
upload.delete('/image/:key', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const key = c.req.param('key');

    // Get image metadata to check ownership
    const object = await c.env.IMAGES.head(key);

    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Check if user uploaded this image
    const uploadedBy = object.customMetadata?.uploadedBy;
    if (uploadedBy !== user.userId.toString()) {
      return c.json({ error: 'Not authorized to delete this image' }, 403);
    }

    // Delete from R2
    await c.env.IMAGES.delete(key);

    return c.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Image delete error:', error);
    return c.json({ error: 'Failed to delete image' }, 500);
  }
});

export default upload;
