# VapeWiki AI Backend Implementation Guide

This document outlines the architecture and implementation plan for the AI-powered wiki system with automatic content generation and updates.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Astro)                        │
│  - /wiki (listing page)                                      │
│  - /wiki/[slug] (article pages with comments/reviews)       │
└──────────────────────┬──────────────────────────────────────┘
                       │ API Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Service                       │
│  - GET /api/wiki (list articles)                            │
│  - GET /api/wiki/:slug (get article)                        │
│  - POST /api/wiki/:slug/comments (add comment)              │
│  - POST /api/wiki/:slug/reviews (add review)                │
│  - POST /api/wiki/generate (trigger AI generation)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │Database │  │AI Service│  │Cron Jobs │
   │(Postgres│  │(Claude)  │  │(Scheduler│
   │or SQLite│  │          │  │)         │
   └─────────┘  └──────────┘  └──────────┘
```

## Database Schema

### Wiki Articles Table
```sql
CREATE TABLE wiki_articles (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT true,
  author VARCHAR(100) DEFAULT 'AI Agent',
  views INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_category (category),
  INDEX idx_last_updated (last_updated)
);
```

### Comments Table
```sql
CREATE TABLE wiki_comments (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES wiki_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  username VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  parent_comment_id INTEGER REFERENCES wiki_comments(id),
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_article (article_id),
  INDEX idx_created (created_at)
);
```

### Reviews Table
```sql
CREATE TABLE wiki_reviews (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES wiki_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  username VARCHAR(100) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_article (article_id),
  UNIQUE idx_user_article (user_id, article_id)
);
```

### Edit History Table
```sql
CREATE TABLE wiki_edit_history (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES wiki_articles(id) ON DELETE CASCADE,
  editor VARCHAR(100) NOT NULL,
  changes TEXT NOT NULL,
  content_snapshot TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_article (article_id)
);
```

## Backend API Implementation

### Technology Stack Options

**Option 1: Node.js + Express**
```javascript
// server.js
const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const cron = require('node-cron');

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Get all wiki articles
app.get('/api/wiki', async (req, res) => {
  const { category } = req.query;
  const articles = await db.query(
    'SELECT * FROM wiki_articles WHERE category = $1 OR $1 IS NULL ORDER BY last_updated DESC',
    [category]
  );
  res.json(articles);
});

// Get specific article
app.get('/api/wiki/:slug', async (req, res) => {
  const article = await db.query(
    'SELECT * FROM wiki_articles WHERE slug = $1',
    [req.params.slug]
  );

  // Increment view count
  await db.query(
    'UPDATE wiki_articles SET views = views + 1 WHERE slug = $1',
    [req.params.slug]
  );

  res.json(article);
});

app.listen(3000);
```

**Option 2: Cloudflare Workers (Serverless)**
```javascript
// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/wiki')) {
      // Handle wiki API requests using Cloudflare D1 database
      const db = env.DB;
      const articles = await db.prepare(
        'SELECT * FROM wiki_articles ORDER BY last_updated DESC'
      ).all();

      return new Response(JSON.stringify(articles), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

## AI Content Generation System

### Article Generation Prompt Template

```javascript
async function generateWikiArticle(topic, category) {
  const prompt = `You are an expert vaping knowledge base writer. Generate a comprehensive wiki article about: "${topic}"

Category: ${category}

Requirements:
- Write in markdown format
- Include practical information, safety warnings where relevant
- Use clear headings and sections
- Include specific product recommendations where applicable
- Add safety checklists for safety-related topics
- Keep tone informative and factual
- Target 800-1200 words

Structure:
1. Introduction/Overview
2. Main content sections (3-5 sections)
3. Practical tips or recommendations
4. Safety considerations (if applicable)
5. Common questions

Output only the markdown content, no meta-commentary.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return message.content[0].text;
}
```

### Article Update System

```javascript
async function updateArticleWithAI(articleId) {
  const article = await db.getArticle(articleId);

  const prompt = `You are maintaining a vaping wiki. Update this article with latest 2025 information:

Title: ${article.title}
Current Content:
${article.content}

Task:
- Add any new product releases from 2025
- Update outdated information
- Add new safety guidelines if relevant
- Keep existing structure intact
- Only modify sections that need updates

Return the updated markdown content.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const updatedContent = message.content[0].text;

  // Save to database
  await db.query(`
    UPDATE wiki_articles
    SET content = $1, last_updated = NOW()
    WHERE id = $2
  `, [updatedContent, articleId]);

  // Log to edit history
  await db.query(`
    INSERT INTO wiki_edit_history (article_id, editor, changes)
    VALUES ($1, 'AI Agent', 'Automatic update with latest information')
  `, [articleId]);
}
```

## Cron Job System

### Implementation with node-cron

```javascript
const cron = require('node-cron');

// Update 3 random articles every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily wiki update job...');

  const articles = await db.query(`
    SELECT id FROM wiki_articles
    WHERE ai_generated = true
    ORDER BY RANDOM()
    LIMIT 3
  `);

  for (const article of articles) {
    try {
      await updateArticleWithAI(article.id);
      console.log(`Updated article ${article.id}`);

      // Rate limiting - wait 10 seconds between updates
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.error(`Failed to update article ${article.id}:`, error);
    }
  }
});

// Generate new trending topic article every week
cron.schedule('0 3 * * 0', async () => {
  console.log('Running weekly new article generation...');

  const trendingTopics = [
    { title: 'Latest Pod System Innovations', category: 'Products' },
    { title: 'Vaping Regulations Update', category: 'Guides' },
    { title: 'New Coil Technology Explained', category: 'Technical' }
  ];

  const topic = trendingTopics[Math.floor(Math.random() * trendingTopics.length)];
  const content = await generateWikiArticle(topic.title, topic.category);

  const slug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  await db.query(`
    INSERT INTO wiki_articles (slug, title, category, content, excerpt)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    slug,
    topic.title,
    topic.category,
    content,
    content.substring(0, 200) + '...'
  ]);
});
```

### Cloudflare Workers Cron Alternative

```javascript
// wrangler.toml
[triggers]
crons = ["0 2 * * *", "0 3 * * 0"]

// worker.js
export default {
  async scheduled(event, env, ctx) {
    if (event.cron === '0 2 * * *') {
      // Daily update job
      await runDailyUpdates(env);
    } else if (event.cron === '0 3 * * 0') {
      // Weekly new article generation
      await generateNewArticle(env);
    }
  }
};
```

## Comment & Review System API

```javascript
// Add comment
app.post('/api/wiki/:slug/comments', async (req, res) => {
  const { username, content, parentCommentId } = req.body;
  const article = await db.getArticleBySlug(req.params.slug);

  const comment = await db.query(`
    INSERT INTO wiki_comments (article_id, username, content, parent_comment_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [article.id, username, content, parentCommentId || null]);

  res.json(comment);
});

// Add review
app.post('/api/wiki/:slug/reviews', async (req, res) => {
  const { username, userId, rating, content } = req.body;
  const article = await db.getArticleBySlug(req.params.slug);

  // Insert review
  const review = await db.query(`
    INSERT INTO wiki_reviews (article_id, user_id, username, rating, content)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [article.id, userId, username, rating, content]);

  // Update article average rating
  await db.query(`
    UPDATE wiki_articles
    SET
      rating = (SELECT AVG(rating) FROM wiki_reviews WHERE article_id = $1),
      total_reviews = (SELECT COUNT(*) FROM wiki_reviews WHERE article_id = $1)
    WHERE id = $1
  `, [article.id]);

  res.json(review);
});

// Upvote comment
app.post('/api/wiki/comments/:id/upvote', async (req, res) => {
  await db.query(`
    UPDATE wiki_comments
    SET upvotes = upvotes + 1
    WHERE id = $1
  `, [req.params.id]);

  res.json({ success: true });
});
```

## Frontend Integration

### Update Astro Pages to Fetch from API

```astro
---
// src/pages/wiki.astro
const response = await fetch('http://localhost:3000/api/wiki');
const wikiArticles = await response.json();
---
```

```astro
---
// src/pages/wiki/[slug].astro
const { slug } = Astro.params;
const response = await fetch(`http://localhost:3000/api/wiki/${slug}`);
const article = await response.json();

const commentsRes = await fetch(`http://localhost:3000/api/wiki/${slug}/comments`);
const comments = await commentsRes.json();

const reviewsRes = await fetch(`http://localhost:3000/api/wiki/${slug}/reviews`);
const reviews = await reviewsRes.json();
---
```

## Environment Variables

```env
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/vapeindex
ANTHROPIC_API_KEY=sk-ant-api03-...
NODE_ENV=production
PORT=3000
```

## Deployment Options

### Option 1: Traditional Server (Node.js + PM2)
```bash
npm install -g pm2
pm2 start server.js --name vapeindex-api
pm2 save
pm2 startup
```

### Option 2: Cloudflare Workers + D1
```bash
npm install -g wrangler
wrangler d1 create vapeindex-db
wrangler deploy
```

### Option 3: Vercel Serverless Functions
```
api/
  wiki/
    index.js          # GET /api/wiki
    [slug].js         # GET /api/wiki/:slug
    comments.js       # POST /api/wiki/:slug/comments
```

## AI Cost Estimation

Assuming Claude Sonnet 4 pricing (~$3/1M input tokens, ~$15/1M output tokens):

- Daily updates (3 articles): ~9,000 output tokens/day = ~$0.14/day = ~$4.20/month
- Weekly new article: ~2,000 output tokens/week = ~$0.03/week = ~$0.12/month
- **Total estimated cost: ~$4.32/month** for AI operations

## Monitoring & Logging

```javascript
// Add logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error tracking
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Next Steps

1. **Choose backend platform**: Node.js/Express, Cloudflare Workers, or Vercel
2. **Set up database**: PostgreSQL (production) or SQLite (development)
3. **Implement API routes**: Start with GET endpoints, then POST for comments/reviews
4. **Integrate AI**: Set up Anthropic API client and test article generation
5. **Configure cron jobs**: Implement scheduled updates
6. **Update frontend**: Replace mock data with API calls
7. **Deploy**: Choose deployment platform and configure environment variables
8. **Monitor**: Set up logging and error tracking

## Sample CLI Commands to Get Started

```bash
# Initialize backend
mkdir backend
cd backend
npm init -y
npm install express @anthropic-ai/sdk pg node-cron dotenv cors

# Create database
psql -U postgres
CREATE DATABASE vapeindex;
\c vapeindex
\i schema.sql

# Run development server
node server.js

# Test AI generation
curl -X POST http://localhost:3000/api/wiki/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "Battery Safety Guide", "category": "Safety"}'
```

---

**Implementation Priority:**
1. ✅ Frontend wiki pages (DONE)
2. ⏳ Backend API setup
3. ⏳ Database schema creation
4. ⏳ AI integration
5. ⏳ Cron job automation
6. ⏳ Frontend-backend integration
7. ⏳ Deployment

This guide provides the complete blueprint for implementing the AI-powered wiki system. Start with the backend API, then integrate AI, and finally set up cron automation.
