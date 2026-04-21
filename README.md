# Job Linker

Centralized job tracking app with a browser extension that captures job listings from LinkedIn, SEEK, and Glints, and a web dashboard with a drag-and-drop Kanban pipeline to manage applications.

## Architecture

```
extension/job-linker   → Firefox/Chrome extension (Plasmo + React)
frontend               → Web dashboard (Vite + React + shadcn/ui)
backend                → REST API (Express + PostgreSQL)
```

**Flow**: User browses a job on LinkedIn/SEEK/Glints → clicks the extension icon → popup scrapes the page and shows the detected job → clicks *Save to Tracker* → job is saved to the backend → appears on the Kanban board in the web dashboard → user drags cards between stages (Saved / Applied / Interview / Offered / Rejected).

## Tech Stack

| Part | Stack |
|------|-------|
| Backend | Node.js, Express 5, PostgreSQL (`pg`), JWT, bcryptjs |
| Frontend | Vite, React 19, TypeScript, Tailwind v4, shadcn/ui, @dnd-kit, React Router v7 |
| Extension | Plasmo, React 18, TypeScript (Firefox MV3 / Chrome MV3) |

## Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14 running locally
- pnpm (for the extension) — `npm install -g pnpm`
- Firefox or any Chromium-based browser

## Setup

### 1. Database

Create a PostgreSQL database:

```bash
createdb skripsi
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env.dev`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skripsi
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-too
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d
```

Run the migrations:

```bash
node src/database/migrate.js
```

Start the backend:

```bash
npm run dev
```

Backend runs on `http://localhost:3000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`. Register a new account, then log in.

### 4. Extension

```bash
cd extension/job-linker
pnpm install
pnpm dev
```

This creates a development build at `extension/job-linker/build/firefox-mv3-dev/`.

**Load in Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click *Load Temporary Add-on*
3. Select `extension/job-linker/build/firefox-mv3-dev/manifest.json`

**Load in Chrome:**
1. Open `chrome://extensions/`
2. Enable *Developer mode*
3. Click *Load unpacked*
4. Select `extension/job-linker/build/chrome-mv3-dev/` (run `pnpm dev:chrome` first)

## Usage

1. Make sure **backend**, **frontend**, and **extension dev build** are all running.
2. On `http://localhost:5173`, register and log in.
3. Open a job page on LinkedIn, SEEK, or Glints — for example:
   - `https://www.linkedin.com/jobs/view/...`
   - `https://www.seek.co.id/job/...`
   - `https://glints.com/id/job/...`
4. Click the extension icon. The popup scrapes the page and shows the detected job.
5. Click *Save to Tracker*. The job appears in the *Saved* column on the web dashboard.
6. Drag the card between columns to update its status.

## Project Structure

```
Skripsi/
├── backend/
│   └── src/
│       ├── config/          — env, database pool
│       ├── core/models/     — BaseModel (shared CRUD)
│       ├── database/
│       │   ├── migrate.js
│       │   └── migrations/  — SQL files
│       ├── middleware/      — auth, error handler
│       ├── modules/
│       │   ├── auth/        — register, login, refresh, verify
│       │   ├── user/        — profile, admin CRUD
│       │   └── job/         — jobs CRUD, status updates
│       └── index.js
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── kanban/      — KanbanBoard, Column, JobCard, DetailSheet
│       │   ├── ui/          — shadcn components
│       │   └── ProtectedRoute.tsx
│       ├── context/         — AuthContext
│       ├── lib/             — api client, utils
│       ├── pages/           — Login, Register, Dashboard
│       ├── types/           — Job, JobStatus
│       └── App.tsx
│
└── extension/job-linker/
    └── src/
        ├── contents/        — linkedin, seek, glints scrapers
        ├── components/      — CurrentJob, Dashboard, LoginForm, SavedJobs
        ├── lib/             — api client, scraper orchestrator, shared types
        ├── background.ts
        └── popup.tsx
```

## API

Base URL: `http://localhost:3000/api`

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns tokens |
| POST | `/auth/refresh` | Refresh access token |

### Protected (Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/verify` | Verify token, return user |
| GET | `/users/me` | Current user profile |
| PUT | `/users/me` | Update profile |
| GET | `/jobs` | List user's jobs (filters: `?platform=`, `?status=`) |
| GET | `/jobs/:id` | Get single job |
| POST | `/jobs` | Save a job |
| POST | `/jobs/bulk` | Save multiple jobs |
| PATCH | `/jobs/:id/status` | Update job status |
| DELETE | `/jobs/:id` | Delete job |

## Roadmap

Planned features beyond the current MVP:

- **AI CV matching** — upload a PDF CV, embed with OpenAI, store in Weaviate, compute match score + skill gaps per job
- **Async processing** — BullMQ queue for heavy AI work
- **Job activity timeline** — notes, status history, reminders for stale applications
- **Analytics** — application funnel, response rates
- **Cover letter generator** — GPT-based
- **Dark mode**
