# VapeIndex.io

**THC vape community platform with viral growth mechanics**

A HackerNews-style clean community combined with Reddit + Namuwiki expandability, focused on THC vape products (carts, batteries, disposables). Built for automatic community growth with network effects.

## 🚀 Tech Stack

- **Frontend**: Astro 5 (ultra-fast, SEO-optimized, island architecture)
- **API**: Hono (edge-native, Cloudflare Workers)
- **Database**: Cloudflare D1 (serverless SQLite)
- **Cache**: Cloudflare KV
- **Real-time**: Durable Objects (trending calculations)
- **Auth**: Discord OAuth
- **Deployment**: Cloudflare Pages + Workers

## 📁 Project Structure

```
vapeindex/
├── apps/
│   ├── frontend/     # Astro application
│   └── api/          # Hono API on Workers
└── package.json      # Monorepo root
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev servers (both frontend and API)
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## 🎯 Features

- ⚡ **HN-style voting** - Community-driven content ranking
- 💬 **Threaded discussions** - Reddit-style comment trees
- 📊 **Product database** - Carts, batteries, disposables
- 🌿 **Strain wiki** - Namuwiki-style expandable knowledge base
- 🏆 **Karma system** - Reputation-based network effects
- 🔥 **Trending algorithm** - Real-time hot content
- 🔐 **Discord OAuth** - Verified community members
- 💰 **Revenue streams** - Ads, Stripe, crypto

## 📈 Roadmap

**Phase 1**: MVP (LA market)
- Product reviews & ratings
- Community discussions
- Strain database
- Discord auth

**Phase 2**: Growth (CA → USA)
- Price tracking
- Email/Discord notifications
- Referral system
- Mobile PWA

**Phase 3**: Scale (Rebrand to "viio")
- Multi-category expansion
- API marketplace
- Premium features
- Full automation

## 📝 License

MIT
