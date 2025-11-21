import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend
app.use('/*', cors({
  origin: [
    'http://localhost:4322',
    'http://localhost:4321',
    'https://vapeindex.io',
    'https://*.vapeindex.pages.dev'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  exposeHeaders: ['X-Session-ID'],
}));

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/posts', postsRoutes);

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
      COALESCE(bs.member_count, 0) as members
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
    members: b.members
  })) || []);
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
    board: post.board,
    boardSlug: post.board_slug,
    boardColor: post.board_color,
    score: post.score,
    comments: post.comment_count,
    views: post.view_count,
    author: post.author,
    authorKarma: post.author_karma,
    createdAt: post.created_at
  });
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
