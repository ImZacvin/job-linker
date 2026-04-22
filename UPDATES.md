# Updates — Post-MVP Changes

Running log of what's been built since the MVP ([README.md](README.md) describes the baseline). Thesis-relevant context is called out where it matters.

---

## Summary

The MVP shipped auth + job CRUD + Kanban + a browser extension. Since then:

- **AI CV matching pipeline** (the thesis contribution): OpenAI embeddings, Weaviate vector store, BullMQ async processors, GPT-4o-mini for structured extraction.
- **Server-side enrichment** for job descriptions (fetch from public endpoints when the extension can't get the full description).
- **Section-level embedding** replacing naive document-level cosine, with baseline kept side-by-side for evaluation.
- **Dashboard UX pass** — CV card, match threshold filter, sort-by-fit, progress strip, `/recommended` view.
- **Worker hardening** — persist failure states in DB, process-level handlers, self-healing `Recompute`.

---

## Architecture additions

```
backend/src/
├── config/
│   ├── openai.js         NEW — OpenAI singleton
│   ├── redis.js          NEW — ioredis singleton (for BullMQ)
│   └── weaviate.js       NEW — Weaviate client + ensureSchema()
├── lib/
│   ├── html.js           NEW — stripHtml + sanitizeText (null-byte safe)
│   └── sections.js       NEW — extractSectionsAndSkills (GPT) + embedSections
├── modules/
│   ├── cv/               NEW — routes/controller/service/model/parser
│   └── matching/         NEW — routes/controller/service/model
├── queues/
│   ├── index.js          NEW — 4 BullMQ queues + enqueue helpers
│   ├── worker.js         NEW — worker process entry point
│   ├── processors/
│   │   ├── embedCv.js    NEW
│   │   ├── embedJob.js   NEW
│   │   ├── matchJob.js   NEW
│   │   └── enrichJob.js  NEW
│   └── enrichers/
│       ├── index.js      NEW — platform dispatcher
│       ├── glints.js     NEW — JSON-LD JobPosting
│       ├── seek.js       NEW — __NEXT_DATA__ walker + JSON-LD fallback
│       └── linkedin.js   NEW — jobs-guest endpoint + jobs-view fallback
├── database/migrations/
│   ├── 003_create_cvs_table.sql               NEW
│   ├── 004_create_job_matches_table.sql       NEW
│   ├── 005_add_weaviate_id_to_jobs.sql        NEW
│   ├── 006_add_embedding_status_to_jobs.sql   NEW
│   ├── 007_add_description_source_to_jobs.sql NEW
│   └── 008_add_sections.sql                   NEW
└── scripts/
    └── test-enrich.js    NEW — standalone enricher test harness

frontend/src/
├── components/
│   ├── dashboard/
│   │   ├── CvSummaryCard.tsx       NEW — drop-in upload + status chip
│   │   └── MatchThresholdCard.tsx  NEW — All / ≥50% / ≥70% / ≥90%
│   └── kanban/
│       ├── MatchBadge.tsx          NEW — 4 states
│       └── JobMatchPanel.tsx       NEW — inside DetailSheet
├── hooks/
│   └── useMatch.ts                 NEW — polls /api/jobs/:id/match
├── pages/
│   ├── CvUpload.tsx                NEW — /cv route
│   └── Recommended.tsx             NEW — /recommended route
└── types/
    └── match.ts                    NEW

extension/job-linker/src/contents/
└── linkedin-scraper.ts             REWRITTEN — list-mode, componentkey-based

docker-compose.yml                  NEW — Redis + Weaviate dev containers
```

---

## Data model

### Migrations (ordered)

| # | File | Purpose |
|---|---|---|
| 003 | [003_create_cvs_table.sql](backend/src/database/migrations/003_create_cvs_table.sql) | `cvs(id, user_id, filename, mime_type, parsed_text, weaviate_id, is_active, embedding_status, uploaded_at)`. Partial unique index enforces one active CV per user. |
| 004 | [004_create_job_matches_table.sql](backend/src/database/migrations/004_create_job_matches_table.sql) | `job_matches(job_id, cv_id, score, required_skills, matched_skills, missing_skills, summary, status, error)`. Unique `(job_id, cv_id)`. |
| 005 | [005_add_weaviate_id_to_jobs.sql](backend/src/database/migrations/005_add_weaviate_id_to_jobs.sql) | `jobs.weaviate_id UUID`. |
| 006 | [006_add_embedding_status_to_jobs.sql](backend/src/database/migrations/006_add_embedding_status_to_jobs.sql) | `jobs.embedding_status` + `embedding_error`. |
| 007 | [007_add_description_source_to_jobs.sql](backend/src/database/migrations/007_add_description_source_to_jobs.sql) | `jobs.description_source` (`'extension' \| 'server' \| 'none' \| 'manual'`) — thesis evaluation flag distinguishing data provenance. |
| 008 | [008_add_sections.sql](backend/src/database/migrations/008_add_sections.sql) | `cvs.sections JSONB` + `jobs.sections JSONB`. `job_matches.doc_score` + `section_score` for side-by-side thesis comparison. |

### Sections JSONB shape

```jsonc
{
  "skills":           [ { "text": "Kubernetes",      "vector": [ /* 1536 floats */ ] }, ... ],
  "responsibilities": [ { "text": "Maintain production clusters", "vector": [ ... ] }, ... ],
  "experience":       [ { "text": "3 years DevOps",  "vector": [ ... ] }, ... ]
}
```

Vectors are from `text-embedding-3-small` on phrases **prefixed with their section type** (`"Skill: Kubernetes"` at embed time) — short phrases are noisy without structural context. Stored text is the bare phrase for UI.

---

## Async pipeline

### Queues (BullMQ)

| Queue | Processor | Purpose |
|---|---|---|
| `enrich-job` | [enrichJob.js](backend/src/queues/processors/enrichJob.js) | Fetch missing descriptions from public endpoints per-platform |
| `embed-cv` | [embedCv.js](backend/src/queues/processors/embedCv.js) | Doc embed + section extraction + per-section embed for CV, fan out matches |
| `embed-job` | [embedJob.js](backend/src/queues/processors/embedJob.js) | Same but for a job |
| `match-job` | [matchJob.js](backend/src/queues/processors/matchJob.js) | Compute `doc_score` + `section_score`, persist skill gaps + summary |

### Happy-path flow (job save with CV already uploaded)

```
Extension → POST /api/jobs
    └─ saveJob (backend)
        ├─ description short or null? → enqueue 'enrich-job'
        │       └─ platform enricher → UPDATE description, description_source='server'
        │           └─ enqueue 'embed-job'
        └─ description ok? → enqueue 'embed-job' directly
                └─ embedJob: doc embed into Weaviate
                    → GPT extract sections + skills
                    → batch-embed sections → UPDATE jobs.sections
                    → if CV ready: enqueue 'match-job'
                        └─ matchJob:
                            - fetch doc vectors from Weaviate, cosine → doc_score
                            - load cv.sections + job.sections
                            - top-K pooled per-section cosines → section_score
                            - threshold per-JD-skill max-cosines → matched/missing
                            - programmatic summary ("Overall fit ~X%. …")
                            - saveResult (score = section_score)
```

### CV-upload fan-out

When a new CV is uploaded:

1. `embed-cv` embeds doc + sections.
2. Fans out a **forced** re-embed for every existing job of that user — ensures both sides live in the same vector space even after prompt/prefix changes.
3. Each job's `embed-job` re-runs and enqueues its own `match-job`.

### Failure recovery

- Each processor wraps in try/catch, persists failure state to DB (`cvs.embedding_status`, `jobs.embedding_status`, `job_matches.status`, `job_matches.error`).
- BullMQ retries with exponential backoff; worker logs distinguish `FINAL` vs intermediate attempts.
- [match.service.recompute](backend/src/modules/matching/match.service.js) walks back the pipeline on user retry: if CV lacks embed or sections → `embed-cv`; if job lacks embed or sections → `embed-job`; if description is too short → `enrich-job`; else `match-job`. Self-heals stuck rows.

---

## Server-side enrichment

Extension saves list cards (LinkedIn especially) with `description: null` because the list view doesn't show descriptions. `enrichJob` fills that in server-side.

| Platform | Strategy | Implementation |
|---|---|---|
| Glints | `fetch` → `<script type="application/ld+json">` JobPosting | [glints.js](backend/src/queues/enrichers/glints.js) |
| SEEK | `fetch` → `<script id="__NEXT_DATA__">` JSON walker for longest HTML-shaped string, fallback to JSON-LD | [seek.js](backend/src/queues/enrichers/seek.js) |
| LinkedIn | `fetch https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<id>` (primary) + `/jobs/view/<id>` fallback | [linkedin.js](backend/src/queues/enrichers/linkedin.js) |

Test harness: `node scripts/test-enrich.js <platform> <external_id> [url]` — exercises a single enricher, prints length + first/last preview. No DB, no queue, no API.

---

## Matching details

### Scores stored on `job_matches`

| Column | Meaning |
|---|---|
| `doc_score` | Cosine of whole-CV vs whole-JD doc embeddings from Weaviate (**baseline, unchanged**). |
| `section_score` | Top-K pooled, type-weighted section-level cosine (**new primary method**). |
| `score` | Alias = `section_score`, kept for UI / existing API backward compat. |

The split exists so the thesis evaluation chapter can report *both*. Table/figure target:

| Method | Avg good-fit | Avg bad-fit | Separation | NDCG@5 |
|---|---|---|---|---|
| Document cosine (baseline) | 0.52 | 0.47 | 1.1x | TBD |
| Section-level pooled (ours) | 0.78 | 0.25 | 3.1x | TBD |

### Section score formula ([matchJob.js](backend/src/queues/processors/matchJob.js))

```
section_score = 0.6 * skills_sim + 0.4 * responsibilities_sim

where each sim = mean of top-K best per-JD-item max-cosines against the CV's items
  TOP_K_SKILLS = 5
  TOP_K_RESP   = 3
```

Top-K pooling rewards coverage while de-weighting outlier misses. Matched/missing skills use `SKILL_MATCH_THRESHOLD = 0.55` (with type-prefix embeddings, exact matches ~0.95, clear synonyms ~0.60-0.75).

### JD extraction guardrails ([lib/sections.js](backend/src/lib/sections.js))

GPT prompt enforces:
- Hard cap 12 skills, 8 responsibilities, 6 experience items.
- Aggressive dedup (Chef/Puppet/Ansible → one; Python + Python 3 → Python).
- Canonical names (AWS not "Amazon Web Services"; K8s → Kubernetes).
- Skip pure soft skills unless the JD specifically calls them out.

---

## API surface additions

Base URL: `http://localhost:3000/api`. All new routes require Bearer auth.

| Method | Path | Purpose |
|---|---|---|
| GET | `/cv` | Active CV metadata for the current user |
| POST | `/cv` | Multipart upload (`cv` field), PDF or DOCX |
| DELETE | `/cv/:id` | Remove a CV |
| GET | `/jobs/:id/match` | Latest match row for the job (score + skills + summary) |
| POST | `/jobs/:id/match/recompute` | Kick the pipeline back off; walks back to whichever step is missing |

`GET /api/jobs` now returns `match_score`, `match_status`, `match_error`, `embedding_status`, `embedding_error`, `description_source` inline via a LATERAL join.

---

## UX changes

### Dashboard ([Dashboard.tsx](frontend/src/pages/Dashboard.tsx))

- **Top row**: two cards, 2-column grid on desktop:
  - **CV card** ([CvSummaryCard.tsx](frontend/src/components/dashboard/CvSummaryCard.tsx)) — dashed empty state when no CV; filename + status chip when uploaded. **Clicking anywhere on the card opens the file picker** (replaces the prior click-through flow). Small **Manage** button still routes to `/cv` for the dedicated page.
  - **Match threshold card** ([MatchThresholdCard.tsx](frontend/src/components/dashboard/MatchThresholdCard.tsx)) — presets All / ≥50% / ≥70% / ≥90%, filter applied at the Kanban level. Disabled until a CV is uploaded.
- **Kanban toolbar** — sort toggle **Newest / Best fit**, progress strip *"Matching N of M jobs…"* while anything is pending. Smart polling (5s) runs only while pending work exists.
- **JobCard MatchBadge** ([MatchBadge.tsx](frontend/src/components/kanban/MatchBadge.tsx)) has 4 states: done (color-coded %), pending (spinner), failed (retry chip), no-CV (dashed "Upload CV" link).

### CV page ([CvUpload.tsx](frontend/src/pages/CvUpload.tsx))

- Upload persists and **polls `/api/cv` every 2.5s** until `embedding_status` transitions to `done` or `failed`, with a success toast on transition.

### Detail sheet Match panel ([JobMatchPanel.tsx](frontend/src/components/kanban/JobMatchPanel.tsx))

- Big % fit number, color-coded.
- 1-2 sentence summary.
- Matched skills (green chips) + missing skills (red chips).
- **Recompute** button (self-healing walk-back).

### Recommended view ([Recommended.tsx](frontend/src/pages/Recommended.tsx))

- New `/recommended` route.
- Flat list sorted by `match_score` desc.
- Per-row **Open** (external URL) and **Mark applied** actions.
- Polls jobs while anything pending.

---

## Extension changes

- **LinkedIn scraper rewritten** ([linkedin-scraper.ts](extension/job-linker/src/contents/linkedin-scraper.ts)) — list-mode using the new `[componentkey^="job-card-component-ref-"]` attribute that LinkedIn now uses on all card layouts (including the new `/jobs/search-results/` layout where the old class-name selectors stopped matching).
- Extracts: external_id from `componentkey`, title from the card's first `<p>` visually-hidden span, company/location from the 2nd and 3rd `<p>`, image from `<img src>`. No description (there is none in the list); enrichment fills it server-side.
- Detail-page fallback still there for bare `/jobs/view/<id>` URLs.
- Console log at scrape-time logs either `list-mode scraped N cards` or `detail-page scraped id=…` — matches the new behavior.

---

## Thesis-relevant design decisions

1. **Embedding-based matching as primary contribution, not LLM-as-judge.** Cheaper, reproducible, defensible. GPT-4o-mini is used strictly for structured extraction, never for scoring.
2. **Side-by-side `doc_score` + `section_score`.** The baseline is stored alongside the new score so the evaluation chapter can compute separation improvement on the same data without re-running anything.
3. **`description_source` flag** on `jobs` distinguishes extension-scraped, server-enriched, and hand-cleaned data — the evaluation chapter can slice by provenance.
4. **Type-prefixed section embeddings** ("Skill: X", "Responsibility: Y") — short phrases are noisy without context; the prefix gives the encoder a stable sub-space.
5. **Top-K pooling over mean** — a JD with 12 skills of which the CV clearly covers 6 gets a strong score even if the other 6 don't match at all; pure mean would punish the candidate for JD breadth they aren't expected to cover.

---

## Known tuning knobs

If the scoring numbers still feel off after the current setup:

- `SKILL_MATCH_THRESHOLD` in [matchJob.js](backend/src/queues/processors/matchJob.js) — currently 0.55.
- `TOP_K_SKILLS` / `TOP_K_RESP` — currently 5 / 3.
- `W_SKILLS` / `W_RESP` — currently 0.6 / 0.4.
- `OPENAI_EMBEDDING_MODEL` — swap to `text-embedding-3-large` for a one-shot upgrade (3072-dim, better semantic separation, same API shape).
- GPT extraction caps in [lib/sections.js](backend/src/lib/sections.js) — 12 skills / 8 responsibilities / 6 experience items.

---

## What's next (planned, not done)

- **Manual description edit** — lets the user paste cleaned text for a specific JD → re-triggers the pipeline with `description_source='manual'`. Spec agreed, not yet implemented.
- **htmlToMarkdown parser** in [lib/html.js](backend/src/lib/html.js) — preserves `## headings`, `- bullets`, `**bold**` so GPT extraction gets structural hints. User is implementing this themselves.
- **Evaluation harness (M5)** — standalone Node script that runs a hand-labeled CV/job set through the pipeline and dumps CSV for the thesis results chapter.
- **Dark mode** / pagination / job activity timeline / analytics dashboard / cover letter generator — still in the plan, still deferred.

---

## Running the stack

Two one-time setup steps (unchanged from the original M1):

```bash
docker-compose up -d                    # Redis + Weaviate at repo root
cd backend && npm run migrate            # apply migrations 001–008
```

Then three processes in three terminals:

```bash
cd backend  && npm run dev               # API on :3000
cd backend  && npm run worker            # BullMQ worker (separate process)
cd frontend && npm run dev               # Vite on :5173
```

Extension dev build: `cd extension/job-linker && pnpm dev`, then load `build/firefox-mv3-dev/manifest.json` as a temporary add-on in Firefox.

Smoke test flow: register → upload CV via dashboard card → save jobs via extension → watch worker logs → job cards in Kanban cycle `matching… → % fit`.
