# Canadian Open Data Discovery — Playful Second Brain Interface

A fast, beautiful, English-first interface for exploring Canadian government data using a hybrid Supabase + CKAN architecture with Vercel orchestration.

**Features**
- 🚀 Fast metadata search powered by Supabase
- 🔗 Live data previews from CKAN (CSV, JSON, GeoJSON)
- 🎨 Playful, light-mode-first design with dark mode support
- 🔍 Smart intent-to-query orchestration (simple parser, easily replaceable with LLM)
- 📊 Quick-Look format badges, publisher filtering, recency indicators
- ⚡ Progressive disclosure: card → details → live preview
- 🔐 Secure server-side API with client-side secret protection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User (Vite SPA, React)                                      │
│  • Write natural language intent                            │
│  • Browse playful dataset cards                             │
│  • Filter by publisher, format, recency                     │
│  • Expand nodes for live data previews                      │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Vercel Serverless API (Node.js)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ /api/orchestrate   → Parse intent → Execute search   │  │
│  │ /api/search        → Query Supabase metadata          │  │
│  │ /api/preview       → Fetch CKAN live rows (w/cache)  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────┬──────────────────────────────────────────────┘
              │              │
         HTTPS │              │ HTTPS
              ▼              ▼
        ┌──────────┐    ┌──────────────────────┐
        │ Supabase │    │ CKAN (open.canada.ca)│
        │ (        │    │ (datastore_search)   │
        │ metadata)│    │                      │
        └──────────┘    └──────────────────────┘
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# Public (exposed in Vite bundle via VITE_ prefix)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_BASE_URL=http://localhost:3000  # For dev; Vercel URL for prod

# Server-only (Vercel env or .env.local, NEVER client-side)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...  (optional, for future LLM intent parsing)
CKAN_API_URL=https://open.canada.ca/data/api/3
APP_ORIGIN=http://localhost:5173  # Your app's origin for CORS

# Security
JWT_SECRET=your-min-32-character-secret-key

# Node env
NODE_ENV=development
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Locally

Terminal 1: Start Vite dev server
```bash
npm run dev
```

Terminal 2: Start Vercel Functions locally (requires Vercel CLI)
```bash
npm install -g vercel
vercel dev
```

Open `http://localhost:5173` and start searching!

### 4. Deployment to Vercel

1. Push to GitHub
2. Connect repo to Vercel dashboard
3. Set environment variables in Vercel project settings (same keys as `.env.example`, but use @ syntax in System env vars)
4. Deploy:

```bash
vercel --prod
```

## API Routes

### POST `/api/orchestrate`
Translate natural language intent into structured filters and run search.

**Request:**
```json
{
  "prompt": "Show me agricultural data from the last 30 days"
}
```

**Response:**
```json
{
  "query": {
    "keywords": ["agricultural", "data"],
    "recency_days": 30,
    "organizations": ["agriculture"],
    "formats": ["CSV"]
  },
  "results": {
    "total": 42,
    "datasets": [...],
    "facets": {...}
  },
  "execution_time_ms": 145
}
```

### POST `/api/search`
Fast metadata search (used internally by orchestration).

**Request:**
```json
{
  "intent": "search keywords",
  "limit": 20,
  "offset": 0
}
```

### POST `/api/preview`
Fetch live rows from CKAN for a resource.

**Request:**
```json
{
  "resource_id": "8282db2a-878f-475c-af10-ad56aa8fa72c",
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "preview": {
    "rows": [...],
    "columns": ["col1", "col2"],
    "row_count": 12500
  }
}
```

## Styling Custom Classes

### Buttons
- `.btn-primary` — Blue action button
- `.btn-secondary` — Gray secondary button
- `.btn-ghost` — Transparent text button

### Badges
- `.badge-primary` — Blue badge
- `.badge-success` — Green badge
- `.badge-warning` — Yellow badge
- `.badge-danger` — Red badge

### Components
- `.card` — Card with border and shadow
- `.input-field` — Styled input with focus ring

## Project Structure

```
/workspaces/CANADA/
├── api/
│   ├── orchestrate.ts         ← Intent → filters → search
│   ├── search.ts              ← Metadata search in Supabase
│   ├── preview.ts             ← Live CKAN row fetch
│   ├── supabase.ts            ← Supabase queries
│   └── utils.ts               ← API utilities (CORS, validation, errors)
│
├── src/
│   ├── components/
│   │   ├── DatasetCard.tsx    ← Individual result card
│   │   ├── SearchInput.tsx    ← Command/search input
│   │   ├── FilterPanel.tsx    ← Faceted filter sidebar
│   │   └── PreviewModal.tsx   ← Live data expansion (optional)
│   │
│   ├── lib/
│   │   ├── api.ts             ← Frontend API client
│   │   ├── supabase.ts        ← Frontend Supabase client
│   │   ├── store.ts           ← Zustand state management
│   │   └── types.ts           ← Shared TypeScript interfaces
│   │
│   ├── App.tsx                ← Main app shell + routing
│   ├── index.tsx              ← React entry point
│   ├── styles.css             ← Global styles + Tailwind
│   └── vite.config.ts         ← Vite build config
│
├── index.html                 ← HTML entry
├── package.json
├── tsconfig.json
├── tailwind.config.js         ← Theme colors, spacing
├── postcss.config.js
├── vercel.json                ← Vercel deployment config
├── .env.example               ← Template for env vars
└── README.md                  ← This file
```

## Supabase Schema (Expected)

Your Supabase instance should have these tables (already populated from your CSV):

### `datasets`
```sql
CREATE TABLE datasets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  organization TEXT,
  metadata_modified TIMESTAMP,
  keywords TEXT[],
  resource_count INT,
  -- ... other fields
);
```

### `resources`
```sql
CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  package_id TEXT REFERENCES datasets(id),
  name TEXT,
  format TEXT,
  url TEXT,
  created TIMESTAMP,
  last_modified TIMESTAMP,
  -- ... other fields
);
```

### `datastore_fields` (optional)
```sql
CREATE TABLE datastore_fields (
  id TEXT PRIMARY KEY,
  resource_id TEXT REFERENCES resources(id),
  name TEXT,
  type TEXT
);
```

## Performance & Optimization

### Caching
- Search results: short TTL (5 min) in-memory or KV store
- Preview rows: very short TTL (30–60 sec) to reduce CKAN load

### Rate Limiting
- Per-IP: 60 req/min on search, 30 req/min on preview
- Per-session: configurable based on usage patterns

### Timeouts
- CKAN preview fetch: 5 seconds (fallback to download link)
- Supabase search: 10 seconds (graceful timeout error)

## Future Enhancements

1. **LLM Orchestration**: Replace simple intent parser with OpenAI/Anthropic for smarter intent understanding
2. **Bilingual Support**: Add EN/FR toggle without reload (schema already supports it)
3. **Canvas Persistence**: Save and load user discovery sessions (Supabase table + auth)
4. **Advanced Analytics**: Track clicked datasets, popular queries, drop-off points
5. **Maps & Visualization**: Embed GeoJSON previews, charts for numeric data
6. **Real-time Collaboration**: Share search results and canvas state with others

## License

Creative Commons 0 (Public Domain) — Explore freely 🍁

## Support

Questions? Open an issue or reach out to the team. Happy data exploring!