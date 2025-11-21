// Notifications routes - get, mark read
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const notifications = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/notifications
 * Get user notifications (requires auth)
 */
notifications.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const { results } = await c.env.DB.prepare(`
      SELECT
        id,
        type,
        content,
        link,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.userId, limit, offset).all();

    return c.json({ notifications: results || [] });
  } catch (error) {
    console.error('Get notifications error:', error);
    return c.json({ error: 'Failed to get notifications' }, 500);
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications (requires auth)
 */
notifications.get('/unread-count', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const result = await c.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(user.userId).first() as any;

    return c.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    return c.json({ error: 'Failed to get unread count' }, 500);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read (requires auth)
 */
notifications.patch('/:id/read', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const notificationId = c.req.param('id');

    // Verify notification belongs to user
    const notification = await c.env.DB.prepare(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
    ).bind(notificationId, user.userId).first();

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    // Mark as read
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).bind(notificationId).run();

    return c.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read (requires auth)
 */
notifications.patch('/mark-all-read', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).bind(user.userId).run();

    return c.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    return c.json({ error: 'Failed to mark all as read' }, 500);
  }
});

export default notifications;
