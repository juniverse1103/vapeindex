// Moderation routes - moderator management, reports, bans
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const mod = new Hono<{ Bindings: Bindings }>();

// Helper function to check if user is board moderator or owner
async function isModerator(db: D1Database, userId: number, boardId: number): Promise<boolean> {
  const result = await db.prepare(`
    SELECT 1 FROM board_moderators
    WHERE user_id = ? AND board_id = ?
    UNION
    SELECT 1 FROM boards
    WHERE id = ? AND created_by = ?
  `).bind(userId, boardId, boardId, userId).first();

  return !!result;
}

/**
 * POST /api/moderation/reports
 * Report content (requires auth)
 */
mod.post('/reports', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { postId, commentId, reason } = await c.req.json();

    if (!postId && !commentId) {
      return c.json({ error: 'Either postId or commentId is required' }, 400);
    }

    if (!reason || reason.trim().length < 10) {
      return c.json({ error: 'Reason must be at least 10 characters' }, 400);
    }

    // Insert report
    await c.env.DB.prepare(`
      INSERT INTO reports (post_id, comment_id, reporter_id, reason)
      VALUES (?, ?, ?, ?)
    `).bind(postId || null, commentId || null, user.userId, reason).run();

    return c.json({ success: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Report error:', error);
    return c.json({ error: 'Failed to submit report' }, 500);
  }
});

/**
 * GET /api/moderation/reports
 * Get reports for boards the user moderates (requires auth + mod)
 */
mod.get('/reports', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const status = c.req.query('status') || 'pending';
    const boardSlug = c.req.query('board');

    let query = `
      SELECT
        r.id,
        r.reason,
        r.status,
        r.created_at,
        r.post_id,
        r.comment_id,
        p.title as post_title,
        c.content as comment_content,
        b.slug as board_slug,
        b.name as board_name,
        reporter.username as reporter,
        resolver.username as resolved_by
      FROM reports r
      LEFT JOIN posts p ON r.post_id = p.id
      LEFT JOIN comments c ON r.comment_id = c.id
      LEFT JOIN boards b ON (p.board_id = b.id OR c.post_id IN (SELECT id FROM posts WHERE board_id = b.id))
      JOIN users reporter ON r.reporter_id = reporter.id
      LEFT JOIN users resolver ON r.resolved_by = resolver.id
      WHERE r.status = ?
      AND (
        b.id IN (SELECT board_id FROM board_moderators WHERE user_id = ?)
        OR b.created_by = ?
      )
    `;

    const params: any[] = [status, user.userId, user.userId];

    if (boardSlug) {
      query += ` AND b.slug = ?`;
      params.push(boardSlug);
    }

    query += ` ORDER BY r.created_at DESC LIMIT 50`;

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({ reports: results || [] });
  } catch (error) {
    console.error('Get reports error:', error);
    return c.json({ error: 'Failed to get reports' }, 500);
  }
});

/**
 * PATCH /api/moderation/reports/:id
 * Resolve a report (requires auth + mod)
 */
mod.patch('/reports/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const reportId = c.req.param('id');
    const { action } = await c.req.json(); // 'resolved' or 'dismissed'

    if (!['resolved', 'dismissed'].includes(action)) {
      return c.json({ error: 'Action must be "resolved" or "dismissed"' }, 400);
    }

    // Get report details
    const report = await c.env.DB.prepare(`
      SELECT r.id, p.board_id, c.post_id
      FROM reports r
      LEFT JOIN posts p ON r.post_id = p.id
      LEFT JOIN comments c ON r.comment_id = c.id
      WHERE r.id = ?
    `).bind(reportId).first() as any;

    if (!report) {
      return c.json({ error: 'Report not found' }, 404);
    }

    // Get board_id from post or comment
    let boardId = report.board_id;
    if (!boardId && report.post_id) {
      const post = await c.env.DB.prepare(
        'SELECT board_id FROM posts WHERE id = ?'
      ).bind(report.post_id).first() as any;
      boardId = post?.board_id;
    }

    // Check if user is moderator
    if (boardId && !(await isModerator(c.env.DB, user.userId, boardId))) {
      return c.json({ error: 'Not authorized to resolve reports for this board' }, 403);
    }

    // Update report
    await c.env.DB.prepare(`
      UPDATE reports
      SET status = ?, resolved_by = ?, resolved_at = unixepoch()
      WHERE id = ?
    `).bind(action, user.userId, reportId).run();

    return c.json({ success: true, message: 'Report updated successfully' });
  } catch (error) {
    console.error('Resolve report error:', error);
    return c.json({ error: 'Failed to resolve report' }, 500);
  }
});

/**
 * POST /api/moderation/remove
 * Remove content (requires auth + mod)
 */
mod.post('/remove', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { postId, commentId, reason } = await c.req.json();

    if (!postId && !commentId) {
      return c.json({ error: 'Either postId or commentId is required' }, 400);
    }

    let boardId: number | null = null;
    let targetType: string;
    let targetId: number;

    if (postId) {
      const post = await c.env.DB.prepare(
        'SELECT board_id FROM posts WHERE id = ?'
      ).bind(postId).first() as any;

      if (!post) {
        return c.json({ error: 'Post not found' }, 404);
      }

      boardId = post.board_id;
      targetType = 'post';
      targetId = parseInt(postId);

      // Check if moderator
      if (!(await isModerator(c.env.DB, user.userId, boardId))) {
        return c.json({ error: 'Not authorized' }, 403);
      }

      // Delete post
      await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();
    } else {
      const comment = await c.env.DB.prepare(`
        SELECT c.id, p.board_id
        FROM comments c
        JOIN posts p ON c.post_id = p.id
        WHERE c.id = ?
      `).bind(commentId).first() as any;

      if (!comment) {
        return c.json({ error: 'Comment not found' }, 404);
      }

      boardId = comment.board_id;
      targetType = 'comment';
      targetId = parseInt(commentId);

      // Check if moderator
      if (!(await isModerator(c.env.DB, user.userId, boardId))) {
        return c.json({ error: 'Not authorized' }, 403);
      }

      // Delete comment
      await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
    }

    // Log moderation action
    await c.env.DB.prepare(`
      INSERT INTO mod_log (board_id, moderator_id, action, target_type, target_id, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      boardId,
      user.userId,
      `remove_${targetType}`,
      targetType,
      targetId,
      reason || 'No reason provided'
    ).run();

    return c.json({ success: true, message: `${targetType} removed successfully` });
  } catch (error) {
    console.error('Remove content error:', error);
    return c.json({ error: 'Failed to remove content' }, 500);
  }
});

/**
 * POST /api/moderation/ban
 * Ban user from board (requires auth + mod)
 */
mod.post('/ban', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { userId, boardSlug, reason, duration } = await c.req.json(); // duration in days, null for permanent

    if (!userId || !boardSlug) {
      return c.json({ error: 'userId and boardSlug are required' }, 400);
    }

    // Get board
    const board = await c.env.DB.prepare(
      'SELECT id FROM boards WHERE slug = ?'
    ).bind(boardSlug).first() as any;

    if (!board) {
      return c.json({ error: 'Board not found' }, 404);
    }

    // Check if moderator
    if (!(await isModerator(c.env.DB, user.userId, board.id))) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    // Calculate expiration
    const expiresAt = duration ? Math.floor(Date.now() / 1000) + (duration * 86400) : null;

    // Insert or update ban
    await c.env.DB.prepare(`
      INSERT INTO banned_users (user_id, board_id, reason, banned_by, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, board_id) DO UPDATE SET
        reason = excluded.reason,
        banned_by = excluded.banned_by,
        expires_at = excluded.expires_at,
        created_at = unixepoch()
    `).bind(userId, board.id, reason || 'No reason provided', user.userId, expiresAt).run();

    // Log action
    await c.env.DB.prepare(`
      INSERT INTO mod_log (board_id, moderator_id, action, target_type, target_id, reason)
      VALUES (?, ?, 'ban_user', 'user', ?, ?)
    `).bind(board.id, user.userId, userId, reason || 'No reason provided').run();

    return c.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    return c.json({ error: 'Failed to ban user' }, 500);
  }
});

/**
 * DELETE /api/moderation/ban/:userId/:boardSlug
 * Unban user from board (requires auth + mod)
 */
mod.delete('/ban/:userId/:boardSlug', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = c.req.param('userId');
    const boardSlug = c.req.param('boardSlug');

    // Get board
    const board = await c.env.DB.prepare(
      'SELECT id FROM boards WHERE slug = ?'
    ).bind(boardSlug).first() as any;

    if (!board) {
      return c.json({ error: 'Board not found' }, 404);
    }

    // Check if moderator
    if (!(await isModerator(c.env.DB, user.userId, board.id))) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    // Remove ban
    await c.env.DB.prepare(
      'DELETE FROM banned_users WHERE user_id = ? AND board_id = ?'
    ).bind(userId, board.id).run();

    // Log action
    await c.env.DB.prepare(`
      INSERT INTO mod_log (board_id, moderator_id, action, target_type, target_id, reason)
      VALUES (?, ?, 'unban_user', 'user', ?, 'Unbanned')
    `).bind(board.id, user.userId, userId).run();

    return c.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    return c.json({ error: 'Failed to unban user' }, 500);
  }
});

/**
 * GET /api/moderation/log
 * Get moderation log (requires auth + mod)
 */
mod.get('/log', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const boardSlug = c.req.query('board');
    const limit = parseInt(c.req.query('limit') || '50');

    let query = `
      SELECT
        ml.id,
        ml.action,
        ml.target_type,
        ml.target_id,
        ml.reason,
        ml.created_at,
        b.slug as board_slug,
        b.name as board_name,
        m.username as moderator
      FROM mod_log ml
      JOIN boards b ON ml.board_id = b.id
      JOIN users m ON ml.moderator_id = m.id
      WHERE (
        b.id IN (SELECT board_id FROM board_moderators WHERE user_id = ?)
        OR b.created_by = ?
      )
    `;

    const params: any[] = [user.userId, user.userId];

    if (boardSlug) {
      query += ` AND b.slug = ?`;
      params.push(boardSlug);
    }

    query += ` ORDER BY ml.created_at DESC LIMIT ?`;
    params.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({ log: results || [] });
  } catch (error) {
    console.error('Get mod log error:', error);
    return c.json({ error: 'Failed to get moderation log' }, 500);
  }
});

export default mod;
