# CodeComply

AI-powered building code compliance for residential architects.

## Build spec

Multi-agent implementation guide with research updates:

- [docs/build-spec/README.md](./docs/build-spec/README.md) — agent index and execution order
- [Agent 2 — APS](./docs/build-spec/agent-2-aps.md) — includes **aps-toolkit** as primary property extraction path
- [Agent 3 — Codes](./docs/build-spec/agent-3-codes.md) — **IDS/IfcTester** rule format + **ICC Code Connect API** licensing note
- [Appendix — Offline parsing](./docs/build-spec/appendix-offline-parsing.md) — **svf-utils** / **forge-convert-utils**

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` to `.env.local` and fill in your keys
3. Run the migration in `supabase/migrations/001_initial_schema.sql` via the Supabase SQL editor

### 3. Supabase Auth settings

In **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (dev) or your Vercel URL (prod)
- **Redirect URLs:**
  - `http://localhost:3000/auth/callback`
  - `https://[your-vercel-url]/auth/callback`

Enable providers:

- Email/password
- Google OAuth (add Google client ID/secret in Supabase dashboard)

### 4. Storage buckets

Create two **private** buckets in Supabase Storage:

1. `floor-plans` — uploaded PDF floor plans
2. `analysis-thumbnails` — APS model screenshots

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth routes

| Route | Purpose |
|-------|---------|
| `/login` | Email/password + Google sign-in |
| `/signup` | Registration with name and firm |
| `/auth/callback` | OAuth and email confirmation callback |
| `/dashboard` | Protected — requires authentication |

## Vercel deployment

1. Push to GitHub and import in Vercel
2. Set all env vars from `.env.local.example`
3. Add production callback URL to Supabase Auth redirect URLs
4. Enable Node.js 20.x runtime
