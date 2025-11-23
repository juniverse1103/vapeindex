import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import boardsRoutes from './routes/boards';
import moderationRoutes from './routes/moderation';
import notificationsRoutes from './routes/notifications';
import uploadRoutes from './routes/upload';
import { authMiddleware } from './middleware/auth';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  IMAGES: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend
app.use('/*', cors({
  origin: [
    'http://localhost:4322',
    'http://localhost:4321',
    'https://vapeindex.io',
    /^https:\/\/[a-zA-Z0-9-]+\.vapeindex\.pages\.dev$/
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  exposeHeaders: ['X-Session-ID'],
}));

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/posts', postsRoutes);
app.route('/api/boards', boardsRoutes);
app.route('/api/moderation', moderationRoutes);
app.route('/api/notifications', notificationsRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api', uploadRoutes); // For /api/images/:key route

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'VapeIndex API' });
});

// Get all boards
app.get('/api/boards', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      b.*,
      COALESCE(bs.post_count, 0) as posts,
      COALESCE(bs.member_count, 0) as members,
      COALESCE(bs.subscriber_count, 0) as subscribers
    FROM boards b
    LEFT JOIN board_stats bs ON b.id = bs.board_id
    ORDER BY b.name
  `).all();

  return c.json(results?.map(b => ({
    name: b.name,
    slug: b.slug,
    description: b.description,
    color: b.color,
    posts: b.posts,
    members: b.members,
    subscribers: b.subscribers
  })) || []);
});

// Create a new board
app.post('/api/boards', authMiddleware, async (c) => {
  const user = c.get('user');
  const { name, slug, description, color } = await c.req.json();

  // Validate required fields
  if (!name || !slug || !description) {
    return c.json({ error: 'Missing required fields: name, slug, description' }, 400);
  }

  // Validate slug format (lowercase, alphanumeric, hyphens only)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return c.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
  }

  // Check if slug already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM boards WHERE slug = ?'
  ).bind(slug).first();

  if (existing) {
    return c.json({ error: 'A board with this slug already exists' }, 409);
  }

  // Insert new board
  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO boards (name, slug, description, color, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
    `).bind(
      name,
      slug,
      description,
      color || '#7C3AED',
      user.userId
    ).run();

    return c.json({
      success: true,
      message: 'Board created successfully',
      board: {
        id: result.meta.last_row_id,
        name,
        slug,
        description,
        color: color || '#7C3AED'
      }
    }, 201);
  } catch (error: any) {
    console.error('Create board error:', error);
    return c.json({ error: 'Failed to create board' }, 500);
  }
});

// Get posts with filters
app.get('/api/posts', async (c) => {
  const sort = c.req.query('sort') || 'hot'; // hot, new, top, rising
  const board = c.req.query('board');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  let query = `
    SELECT
      p.id,
      p.title,
      p.url,
      p.image_url,
      p.score,
      p.comment_count as comments,
      p.view_count as views,
      p.created_at,
      b.slug as board_slug,
      b.name as board,
      b.color as board_color,
      u.username as author,
      u.karma as author_karma
    FROM posts p
    JOIN boards b ON p.board_id = b.id
    JOIN users u ON p.author_id = u.id
  `;

  if (board) {
    query += ` WHERE b.slug = ?`;
  }

  // Sorting logic
  switch (sort) {
    case 'new':
      query += ` ORDER BY p.created_at DESC`;
      break;
    case 'top':
      query += ` ORDER BY p.score DESC`;
      break;
    case 'rising':
      // Simple rising algorithm: recent posts with growing engagement
      query += ` ORDER BY (p.score * 1.0 / (CAST((unixepoch() - p.created_at) AS REAL) / 3600 + 2)) DESC`;
      break;
    case 'hot':
    default:
      // Hot algorithm: score adjusted by time (simplified for D1)
      const hoursFactor = 1.5;
      query += ` ORDER BY (p.score - 1) / ((CAST((unixepoch() - p.created_at) AS REAL) / 3600) + 2) DESC`;
  }

  query += ` LIMIT ? OFFSET ?`;

  const stmt = board
    ? c.env.DB.prepare(query).bind(board, limit, offset)
    : c.env.DB.prepare(query).bind(limit, offset);

  const { results } = await stmt.all();

  // Convert timestamps to relative time
  const now = Math.floor(Date.now() / 1000);
  const posts = results?.map(p => {
    const age = now - p.created_at;
    let time = '';
    if (age < 3600) time = `${Math.floor(age / 60)}m`;
    else if (age < 86400) time = `${Math.floor(age / 3600)}h`;
    else if (age < 2592000) time = `${Math.floor(age / 86400)}d`;
    else if (age < 31536000) time = `${Math.floor(age / 2592000)}mo`;
    else time = `${Math.floor(age / 31536000)}y`;

    return {
      id: p.id.toString(),
      title: p.title,
      url: p.url,
      imageUrl: p.image_url,
      board: p.board,
      boardSlug: p.board_slug,
      boardColor: p.board_color,
      score: p.score,
      comments: p.comments,
      views: p.views,
      author: p.author,
      authorKarma: p.author_karma,
      time,
      hot: sort === 'hot',
      awarded: p.score > 1000
    };
  }) || [];

  return c.json(posts);
});

// Get personalized feed from subscribed boards (requires auth)
app.get('/api/feed', authMiddleware, async (c) => {
  const user = c.get('user');
  const sort = c.req.query('sort') || 'hot';
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  // Get user's subscribed board IDs
  const { results: subscriptions } = await c.env.DB.prepare(`
    SELECT board_id FROM board_subscriptions WHERE user_id = ?
  `).bind(user.userId).all();

  if (!subscriptions || subscriptions.length === 0) {
    // No subscriptions, return empty feed
    return c.json([]);
  }

  const boardIds = subscriptions.map((s: any) => s.board_id);
  const placeholders = boardIds.map(() => '?').join(',');

  let query = `
    SELECT
      p.id,
      p.title,
      p.url,
      p.image_url,
      p.score,
      p.comment_count as comments,
      p.view_count as views,
      p.created_at,
      b.slug as board_slug,
      b.name as board,
      b.color as board_color,
      u.username as author,
      u.karma as author_karma
    FROM posts p
    JOIN boards b ON p.board_id = b.id
    JOIN users u ON p.author_id = u.id
    WHERE p.board_id IN (${placeholders})
  `;

  // Sorting logic
  switch (sort) {
    case 'new':
      query += ` ORDER BY p.created_at DESC`;
      break;
    case 'top':
      query += ` ORDER BY p.score DESC`;
      break;
    case 'rising':
      query += ` ORDER BY (p.score * 1.0 / (CAST((unixepoch() - p.created_at) AS REAL) / 3600 + 2)) DESC`;
      break;
    case 'hot':
    default:
      query += ` ORDER BY (p.score - 1) / ((CAST((unixepoch() - p.created_at) AS REAL) / 3600) + 2) DESC`;
  }

  query += ` LIMIT ? OFFSET ?`;

  const { results } = await c.env.DB.prepare(query)
    .bind(...boardIds, limit, offset)
    .all();

  // Convert timestamps to relative time
  const now = Math.floor(Date.now() / 1000);
  const posts = results?.map(p => {
    const age = now - p.created_at;
    let time = '';
    if (age < 3600) time = `${Math.floor(age / 60)}m`;
    else if (age < 86400) time = `${Math.floor(age / 3600)}h`;
    else if (age < 2592000) time = `${Math.floor(age / 86400)}d`;
    else if (age < 31536000) time = `${Math.floor(age / 2592000)}mo`;
    else time = `${Math.floor(age / 31536000)}y`;

    return {
      id: p.id.toString(),
      title: p.title,
      url: p.url,
      imageUrl: p.image_url,
      board: p.board,
      boardSlug: p.board_slug,
      boardColor: p.board_color,
      score: p.score,
      comments: p.comments,
      views: p.views,
      author: p.author,
      authorKarma: p.author_karma,
      time,
      hot: sort === 'hot',
      awarded: p.score > 1000
    };
  }) || [];

  return c.json(posts);
});

// Get single post
app.get('/api/posts/:id', async (c) => {
  const id = c.req.param('id');

  const { results } = await c.env.DB.prepare(`
    SELECT
      p.*,
      b.slug as board_slug,
      b.name as board,
      b.color as board_color,
      u.username as author,
      u.karma as author_karma
    FROM posts p
    JOIN boards b ON p.board_id = b.id
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `).bind(id).all();

  if (!results || results.length === 0) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const post = results[0];
  return c.json({
    id: post.id.toString(),
    title: post.title,
    url: post.url,
    content: post.content,
    imageUrl: post.image_url,
    board: post.board,
    boardSlug: post.board_slug,
    boardColor: post.board_color,
    score: post.score,
    comments: post.comment_count,
    views: post.view_count,
    author: post.author,
    authorId: post.author_id,
    authorKarma: post.author_karma,
    createdAt: post.created_at,
    editedAt: post.edited_at
  });
});

// Get user profile
app.get('/api/users/:username', async (c) => {
  const username = c.req.param('username');

  // Get user info
  const user = await c.env.DB.prepare(`
    SELECT id, username, karma, created_at
    FROM users
    WHERE username = ?
  `).bind(username).first() as any;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get user's posts
  const { results: posts } = await c.env.DB.prepare(`
    SELECT
      p.id,
      p.title,
      p.score,
      p.comment_count,
      p.created_at,
      b.slug as board_slug,
      b.name as board_name
    FROM posts p
    JOIN boards b ON p.board_id = b.id
    WHERE p.author_id = ?
    ORDER BY p.created_at DESC
    LIMIT 20
  `).bind(user.id).all();

  // Get user's comments
  const { results: comments } = await c.env.DB.prepare(`
    SELECT
      c.id,
      c.content,
      c.score,
      c.created_at,
      p.id as post_id,
      p.title as post_title,
      b.slug as board_slug
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    JOIN boards b ON p.board_id = b.id
    WHERE c.author_id = ?
    ORDER BY c.created_at DESC
    LIMIT 20
  `).bind(user.id).all();

  // Calculate account age
  const now = Math.floor(Date.now() / 1000);
  const age = now - user.created_at;
  let accountAge = '';
  if (age < 86400) accountAge = `${Math.floor(age / 3600)} hours`;
  else if (age < 2592000) accountAge = `${Math.floor(age / 86400)} days`;
  else if (age < 31536000) accountAge = `${Math.floor(age / 2592000)} months`;
  else accountAge = `${Math.floor(age / 31536000)} years`;

  return c.json({
    user: {
      username: user.username,
      karma: user.karma,
      accountAge,
      createdAt: user.created_at,
    },
    posts: posts?.map((p: any) => ({
      id: p.id,
      title: p.title,
      score: p.score,
      comments: p.comment_count,
      board: p.board_name,
      boardSlug: p.board_slug,
      createdAt: p.created_at,
    })) || [],
    comments: comments?.map((c: any) => ({
      id: c.id,
      content: c.content.substring(0, 200) + (c.content.length > 200 ? '...' : ''),
      score: c.score,
      postId: c.post_id,
      postTitle: c.post_title,
      boardSlug: c.board_slug,
      createdAt: c.created_at,
    })) || [],
  });
});

// Search posts
app.get('/api/search', async (c) => {
  const query = c.req.query('q') || '';
  const board = c.req.query('board');
  const limit = parseInt(c.req.query('limit') || '20');

  if (!query || query.trim().length < 2) {
    return c.json({ posts: [] });
  }

  const searchTerm = `%${query}%`;
  let sql = `
    SELECT
      p.id,
      p.title,
      p.url,
      p.image_url,
      p.score,
      p.comment_count as comments,
      p.view_count as views,
      p.created_at,
      b.slug as board_slug,
      b.name as board,
      b.color as board_color,
      u.username as author,
      u.karma as author_karma
    FROM posts p
    JOIN boards b ON p.board_id = b.id
    JOIN users u ON p.author_id = u.id
    WHERE (p.title LIKE ? OR p.content LIKE ?)
  `;

  const params: any[] = [searchTerm, searchTerm];

  if (board) {
    sql += ` AND b.slug = ?`;
    params.push(board);
  }

  sql += ` ORDER BY p.score DESC LIMIT ?`;
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();

  const now = Math.floor(Date.now() / 1000);
  const posts = results?.map(p => {
    const age = now - p.created_at;
    let time = '';
    if (age < 3600) time = `${Math.floor(age / 60)}m`;
    else if (age < 86400) time = `${Math.floor(age / 3600)}h`;
    else if (age < 2592000) time = `${Math.floor(age / 86400)}d`;
    else if (age < 31536000) time = `${Math.floor(age / 2592000)}mo`;
    else time = `${Math.floor(age / 31536000)}y`;

    return {
      id: p.id.toString(),
      title: p.title,
      url: p.url,
      imageUrl: p.image_url,
      board: p.board,
      boardSlug: p.board_slug,
      boardColor: p.board_color,
      score: p.score,
      comments: p.comments,
      views: p.views,
      author: p.author,
      authorKarma: p.author_karma,
      time,
    };
  }) || [];

  return c.json({ posts });
});

// Get community stats
app.get('/api/stats', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM posts) as total_posts,
      (SELECT COUNT(*) FROM users) as total_members,
      (SELECT COUNT(*) FROM boards) as boards_count
  `).all();

  const stats = results?.[0] || {};
  return c.json({
    totalPosts: stats.total_posts || 0,
    totalMembers: stats.total_members || 0,
    activeNow: Math.floor(Math.random() * 2000) + 1000, // Mock for now
    boardsCount: stats.boards_count || 0
  });
});

export default app;
