// Posts routes - create, vote, comment

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const posts = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/posts
 * Create a new post (requires auth)
 */
posts.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { title, url, content, boardSlug } = await c.req.json();

    // Validate input
    if (!title || !boardSlug) {
      return c.json({ error: 'Title and board are required' }, 400);
    }

    if (title.length < 3 || title.length > 300) {
      return c.json({ error: 'Title must be between 3 and 300 characters' }, 400);
    }

    // Must have either URL or content, not both
    if (url && content) {
      return c.json({ error: 'Post can have either URL or content, not both' }, 400);
    }

    if (!url && !content) {
      return c.json({ error: 'Post must have either URL or content' }, 400);
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return c.json({ error: 'Invalid URL format' }, 400);
      }
    }

    // Get board ID
    const board = await c.env.DB.prepare(
      'SELECT id FROM boards WHERE slug = ?'
    ).bind(boardSlug).first() as any;

    if (!board) {
      return c.json({ error: 'Board not found' }, 404);
    }

    // Create post
    const result = await c.env.DB.prepare(`
      INSERT INTO posts (title, url, content, board_id, author_id, score, comment_count, view_count)
      VALUES (?, ?, ?, ?, ?, 1, 0, 0)
    `).bind(title, url || null, content || null, board.id, user.userId).run();

    const postId = result.meta.last_row_id;

    // Auto-upvote own post
    await c.env.DB.prepare(`
      INSERT INTO votes (user_id, post_id, value)
      VALUES (?, ?, 1)
    `).bind(user.userId, postId).run();

    return c.json({
      success: true,
      postId,
      message: 'Post created successfully',
    }, 201);
  } catch (error) {
    console.error('Create post error:', error);
    return c.json({ error: 'Failed to create post' }, 500);
  }
});

/**
 * POST /api/posts/:id/vote
 * Vote on a post (requires auth)
 */
posts.post('/:id/vote', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const postId = c.req.param('id');
    const { value } = await c.req.json();

    // Validate vote value
    if (value !== 1 && value !== -1 && value !== 0) {
      return c.json({ error: 'Vote value must be 1 (upvote), -1 (downvote), or 0 (remove)' }, 400);
    }

    // Check if post exists
    const post = await c.env.DB.prepare(
      'SELECT id, author_id FROM posts WHERE id = ?'
    ).bind(postId).first() as any;

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Check existing vote
    const existingVote = await c.env.DB.prepare(
      'SELECT value FROM votes WHERE user_id = ? AND post_id = ?'
    ).bind(user.userId, postId).first() as any;

    if (value === 0) {
      // Remove vote
      if (existingVote) {
        await c.env.DB.prepare(
          'DELETE FROM votes WHERE user_id = ? AND post_id = ?'
        ).bind(user.userId, postId).run();

        // Update post score
        await c.env.DB.prepare(
          'UPDATE posts SET score = score - ? WHERE id = ?'
        ).bind(existingVote.value, postId).run();

        // Update author karma
        await c.env.DB.prepare(
          'UPDATE users SET karma = karma - ? WHERE id = ?'
        ).bind(existingVote.value, post.author_id).run();
      }
    } else if (existingVote) {
      // Update existing vote
      const scoreDiff = value - existingVote.value;

      await c.env.DB.prepare(
        'UPDATE votes SET value = ? WHERE user_id = ? AND post_id = ?'
      ).bind(value, user.userId, postId).run();

      // Update post score
      await c.env.DB.prepare(
        'UPDATE posts SET score = score + ? WHERE id = ?'
      ).bind(scoreDiff, postId).run();

      // Update author karma
      await c.env.DB.prepare(
        'UPDATE users SET karma = karma + ? WHERE id = ?'
      ).bind(scoreDiff, post.author_id).run();
    } else {
      // Create new vote
      await c.env.DB.prepare(
        'INSERT INTO votes (user_id, post_id, value) VALUES (?, ?, ?)'
      ).bind(user.userId, postId, value).run();

      // Update post score
      await c.env.DB.prepare(
        'UPDATE posts SET score = score + ? WHERE id = ?'
      ).bind(value, postId).run();

      // Update author karma
      await c.env.DB.prepare(
        'UPDATE users SET karma = karma + ? WHERE id = ?'
      ).bind(value, post.author_id).run();
    }

    // Get updated score
    const updatedPost = await c.env.DB.prepare(
      'SELECT score FROM posts WHERE id = ?'
    ).bind(postId).first() as any;

    return c.json({
      success: true,
      score: updatedPost.score,
      userVote: value,
    });
  } catch (error) {
    console.error('Vote error:', error);
    return c.json({ error: 'Failed to vote' }, 500);
  }
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post (requires auth)
 */
posts.post('/:id/comments', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const postId = c.req.param('id');
    const { content, parentId } = await c.req.json();

    // Validate input
    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Comment content is required' }, 400);
    }

    if (content.length > 10000) {
      return c.json({ error: 'Comment is too long (max 10000 characters)' }, 400);
    }

    // Check if post exists
    const post = await c.env.DB.prepare(
      'SELECT id FROM posts WHERE id = ?'
    ).bind(postId).first();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // If replying to a comment, check if parent exists
    if (parentId) {
      const parentComment = await c.env.DB.prepare(
        'SELECT id FROM comments WHERE id = ? AND post_id = ?'
      ).bind(parentId, postId).first();

      if (!parentComment) {
        return c.json({ error: 'Parent comment not found' }, 404);
      }
    }

    // Create comment
    const result = await c.env.DB.prepare(`
      INSERT INTO comments (post_id, parent_id, author_id, content, score)
      VALUES (?, ?, ?, ?, 1)
    `).bind(postId, parentId || null, user.userId, content).run();

    const commentId = result.meta.last_row_id;

    // Auto-upvote own comment
    await c.env.DB.prepare(`
      INSERT INTO votes (user_id, comment_id, value)
      VALUES (?, ?, 1)
    `).bind(user.userId, commentId).run();

    // Update post comment count
    await c.env.DB.prepare(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?'
    ).bind(postId).run();

    return c.json({
      success: true,
      commentId,
      message: 'Comment added successfully',
    }, 201);
  } catch (error) {
    console.error('Add comment error:', error);
    return c.json({ error: 'Failed to add comment' }, 500);
  }
});

/**
 * GET /api/posts/:id/comments
 * Get all comments for a post
 */
posts.get('/:id/comments', async (c) => {
  try {
    const postId = c.req.param('id');

    // Check if post exists
    const post = await c.env.DB.prepare(
      'SELECT id FROM posts WHERE id = ?'
    ).bind(postId).first();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Get all comments for the post
    const { results } = await c.env.DB.prepare(`
      SELECT
        c.id,
        c.parent_id,
        c.content,
        c.score,
        c.created_at,
        u.username as author,
        u.karma as author_karma
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).bind(postId).all();

    // Build nested comment tree
    const commentsById = new Map();
    const rootComments: any[] = [];

    // First pass: create all comment objects
    results?.forEach((row: any) => {
      const comment = {
        id: row.id,
        parentId: row.parent_id,
        content: row.content,
        score: row.score,
        author: row.author,
        authorKarma: row.author_karma,
        createdAt: row.created_at,
        replies: [],
      };
      commentsById.set(row.id, comment);
    });

    // Second pass: build tree structure
    commentsById.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentsById.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    return c.json({ comments: rootComments });
  } catch (error) {
    console.error('Get comments error:', error);
    return c.json({ error: 'Failed to get comments' }, 500);
  }
});

/**
 * POST /api/comments/:id/vote
 * Vote on a comment (requires auth)
 */
posts.post('/comments/:id/vote', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const commentId = c.req.param('id');
    const { value } = await c.req.json();

    // Validate vote value
    if (value !== 1 && value !== -1 && value !== 0) {
      return c.json({ error: 'Vote value must be 1 (upvote), -1 (downvote), or 0 (remove)' }, 400);
    }

    // Check if comment exists
    const comment = await c.env.DB.prepare(
      'SELECT id, author_id FROM comments WHERE id = ?'
    ).bind(commentId).first() as any;

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    // Check existing vote
    const existingVote = await c.env.DB.prepare(
      'SELECT value FROM votes WHERE user_id = ? AND comment_id = ?'
    ).bind(user.userId, commentId).first() as any;

    if (value === 0) {
      // Remove vote
      if (existingVote) {
        await c.env.DB.prepare(
          'DELETE FROM votes WHERE user_id = ? AND comment_id = ?'
        ).bind(user.userId, commentId).run();

        // Update comment score
        await c.env.DB.prepare(
          'UPDATE comments SET score = score - ? WHERE id = ?'
        ).bind(existingVote.value, commentId).run();

        // Update author karma
        await c.env.DB.prepare(
          'UPDATE users SET karma = karma - ? WHERE id = ?'
        ).bind(existingVote.value, comment.author_id).run();
      }
    } else if (existingVote) {
      // Update existing vote
      const scoreDiff = value - existingVote.value;

      await c.env.DB.prepare(
        'UPDATE votes SET value = ? WHERE user_id = ? AND comment_id = ?'
      ).bind(value, user.userId, commentId).run();

      // Update comment score
      await c.env.DB.prepare(
        'UPDATE comments SET score = score + ? WHERE id = ?'
      ).bind(scoreDiff, commentId).run();

      // Update author karma
      await c.env.DB.prepare(
        'UPDATE users SET karma = karma + ? WHERE id = ?'
      ).bind(scoreDiff, comment.author_id).run();
    } else {
      // Create new vote
      await c.env.DB.prepare(
        'INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)'
      ).bind(user.userId, commentId, value).run();

      // Update comment score
      await c.env.DB.prepare(
        'UPDATE comments SET score = score + ? WHERE id = ?'
      ).bind(value, commentId).run();

      // Update author karma
      await c.env.DB.prepare(
        'UPDATE users SET karma = karma + ? WHERE id = ?'
      ).bind(value, comment.author_id).run();
    }

    // Get updated score
    const updatedComment = await c.env.DB.prepare(
      'SELECT score FROM comments WHERE id = ?'
    ).bind(commentId).first() as any;

    return c.json({
      success: true,
      score: updatedComment.score,
      userVote: value,
    });
  } catch (error) {
    console.error('Vote error:', error);
    return c.json({ error: 'Failed to vote' }, 500);
  }
});

export default posts;
