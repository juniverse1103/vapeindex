// Board routes - manage board subscriptions
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const boards = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/boards/:slug/subscribe
 * Subscribe to a board (requires auth)
 */
boards.post('/:slug/subscribe', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const slug = c.req.param('slug');

    // Get board ID from slug
    const board = await c.env.DB.prepare(
      'SELECT id FROM boards WHERE slug = ?'
    ).bind(slug).first() as any;

    if (!board) {
      return c.json({ error: 'Board not found' }, 404);
    }

    // Check if already subscribed
    const existing = await c.env.DB.prepare(
      'SELECT 1 FROM board_subscriptions WHERE user_id = ? AND board_id = ?'
    ).bind(user.userId, board.id).first();

    if (existing) {
      return c.json({ error: 'Already subscribed to this board' }, 400);
    }

    // Subscribe
    await c.env.DB.prepare(`
      INSERT INTO board_subscriptions (user_id, board_id, subscribed_at)
      VALUES (?, ?, unixepoch())
    `).bind(user.userId, board.id).run();

    // Update subscriber count in board_stats
    await c.env.DB.prepare(`
      UPDATE board_stats
      SET subscriber_count = (
        SELECT COUNT(*) FROM board_subscriptions WHERE board_id = ?
      )
      WHERE board_id = ?
    `).bind(board.id, board.id).run();

    return c.json({
      success: true,
      message: 'Subscribed to board successfully'
    });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    return c.json({ error: 'Failed to subscribe to board' }, 500);
  }
});

/**
 * DELETE /api/boards/:slug/subscribe
 * Unsubscribe from a board (requires auth)
 */
boards.delete('/:slug/subscribe', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const slug = c.req.param('slug');

    // Get board ID from slug
    const board = await c.env.DB.prepare(
      'SELECT id FROM boards WHERE slug = ?'
    ).bind(slug).first() as any;

    if (!board) {
      return c.json({ error: 'Board not found' }, 404);
    }

    // Unsubscribe
    const result = await c.env.DB.prepare(`
      DELETE FROM board_subscriptions
      WHERE user_id = ? AND board_id = ?
    `).bind(user.userId, board.id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Not subscribed to this board' }, 400);
    }

    // Update subscriber count in board_stats
    await c.env.DB.prepare(`
      UPDATE board_stats
      SET subscriber_count = (
        SELECT COUNT(*) FROM board_subscriptions WHERE board_id = ?
      )
      WHERE board_id = ?
    `).bind(board.id, board.id).run();

    return c.json({
      success: true,
      message: 'Unsubscribed from board successfully'
    });
  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    return c.json({ error: 'Failed to unsubscribe from board' }, 500);
  }
});

/**
 * GET /api/boards/subscribed
 * Get user's subscribed boards (requires auth)
 */
boards.get('/subscribed', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const { results } = await c.env.DB.prepare(`
      SELECT
        b.id,
        b.slug,
        b.name,
        b.description,
        b.color,
        bs.subscribed_at,
        COALESCE(bstats.post_count, 0) as post_count,
        COALESCE(bstats.subscriber_count, 0) as subscriber_count
      FROM board_subscriptions bs
      JOIN boards b ON bs.board_id = b.id
      LEFT JOIN board_stats bstats ON b.id = bstats.board_id
      WHERE bs.user_id = ?
      ORDER BY b.name
    `).bind(user.userId).all();

    return c.json({
      boards: results?.map((b: any) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        color: b.color,
        subscribedAt: b.subscribed_at,
        postCount: b.post_count,
        subscriberCount: b.subscriber_count
      })) || []
    });
  } catch (error: any) {
    console.error('Get subscribed boards error:', error);
    return c.json({ error: 'Failed to fetch subscribed boards' }, 500);
  }
});

/**
 * GET /api/boards/:slug/subscription
 * Check if user is subscribed to a board (requires auth)
 */
boards.get('/:slug/subscription', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const slug = c.req.param('slug');

    // Get board ID from slug
    const board = await c.env.DB.prepare(
      'SELECT id FROM boards WHERE slug = ?'
    ).bind(slug).first() as any;

    if (!board) {
      return c.json({ error: 'Board not found' }, 404);
    }

    // Check subscription
    const subscription = await c.env.DB.prepare(
      'SELECT subscribed_at FROM board_subscriptions WHERE user_id = ? AND board_id = ?'
    ).bind(user.userId, board.id).first() as any;

    return c.json({
      subscribed: !!subscription,
      subscribedAt: subscription?.subscribed_at || null
    });
  } catch (error: any) {
    console.error('Check subscription error:', error);
    return c.json({ error: 'Failed to check subscription status' }, 500);
  }
});

export default boards;
