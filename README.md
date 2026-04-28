# MedLock

This repository is the project workspace for a **PHI detection** initiative: tools and code focused on identifying protected health information in text and data.

## About

The goal of this project is to support detection, handling, and governance of PHI in line with privacy and compliance expectations.

## Development

MedLock is split into a frontend and backend workspace:

- `frontend` - Next.js UI, Supabase auth pages, OAuth callback, and dashboard middleware.
- `backend` - Node API for GitHub repository access, scan creation, scan listing, and report lookup.
- `packages/phi-detector` - Shared PHI scan engine used by the backend.

Install dependencies and run both apps from the repository root:

```sh
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`
- Backend health check: `http://localhost:4000/api/health`

The frontend sends the Supabase access token to the backend with `Authorization: Bearer <token>`. The backend uses that token for user-scoped Supabase queries.

## Environment

Create `frontend/.env.local`:

```sh
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Create `backend/.env`:

```sh
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
```

In Supabase, configure the GitHub provider and set the Site URL / redirect URLs to the frontend origin, including `http://localhost:3000/auth/callback` for local development.
