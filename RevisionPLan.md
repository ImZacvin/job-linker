# Add LLM Re-Rank + Reasoning Step to CV–Job Matching Pipeline

## Context

The M1 AI CV matching pipeline already implements steps 1–4 of the hybrid approach:

- **Parse & clean** CV (PDF/DOCX) and JD text — done in [cv.parser.js](backend/src/modules/cv/cv.parser.js) and the extension scrapers
- **Structured LLM extraction** (skills/responsibilities/experience) — done in [sections.js::extractSectionsAndSkills](backend/src/lib/sections.js#L63)
- **Per-section embeddings** with `text-embedding-3-small` and type-prefix tokens — done in [sections.js::embedSections](backend/src/lib/sections.js#L86)
- **Cosine similarity with top-K pooling** (60% skills top-5 + 40% responsibilities top-3) and skill-gap derivation at 0.55 threshold — done in [matchJob.js](backend/src/queues/processors/matchJob.js)
- **Template summary string** like "Overall fit ~73%. You match 8 of 12 required skills. Missing: Kubernetes, ..."

**The gap is Step 5:** the LLM re-ranking / reasoning pass that takes the structured fields + cosine scores and produces an adjusted final score plus a human-readable explanation. This plan adds that one stage.

**Thesis angle:** store cosine-only `section_score` AND LLM-adjusted `llm_score` side-by-side in every match row so the M5 evaluation harness can compare the two approaches directly (cosine-only vs. cosine+LLM-reasoning) on the same dataset.

## Design decisions (confirmed)

- **Trigger:** LLM runs automatically inside the `match-job` BullMQ processor, after cosine scoring. Every match row gets both scores. Fails-soft — if the LLM call errors, cosine result still saves.
- **Scoring:** `section_score` stays untouched as the cosine baseline. New column `llm_score` holds the LLM-adjusted value. UI reads `llm_score` with fallback to `section_score`. Prompt constrains the LLM to stay within ±15 points of cosine unless nuance clearly warrants deviation.

## File changes

### 1. New: [backend/src/lib/rerank.js](backend/src/lib/rerank.js)

Mirrors the [sections.js](backend/src/lib/sections.js) pattern — one `gpt-4o-mini` call with a strict JSON schema. Uses the existing [openai.js](backend/src/config/openai.js) client and `env.OPENAI_CHAT_MODEL`.

Exported function:

```js
export async function rerankMatch({
  cvSections,     // { skills: string[], responsibilities: string[], experience: string[] }
  jobSections,    // same shape
  docScore,       // 0–1
  sectionScore,   // 0–1
  matchedSkills,  // string[]
  missingSkills,  // string[]
  jobTitle,       // string (optional context)
}): Promise<{
  final_score: number,       // integer 0–100
  reasoning: string,         // 2–3 sentences
  strengths: string[],       // up to 3 short bullets
  concerns: string[],        // up to 3 short bullets
} | null>
```

- Truncate each section array to top 15 items before sending.
- Use `response_format: { type: 'json_schema', json_schema: { ..., strict: true } }` exactly like `extractSectionsAndSkills`.
- Wrap in a 20s `AbortController` timeout. On any throw → return `null` (caller handles fallback).

System prompt (literal text to use):

```
You are an expert technical recruiter making a final judgement on a CV vs job match.
You will be given:
  - Cosine-based scores (doc_score, section_score) computed from embeddings
  - The CV's and job's extracted skills, responsibilities, and experience phrases
  - Which required skills cosine marked matched vs missing
Your job: produce a FINAL score (0–100) that corrects for nuance cosine misses:
  - version/seniority mismatch (e.g. "Python 2" vs "Python 3.11 + async")
  - domain pivot (fintech infra != gaming infra even if stacks overlap)
  - depth (one bullet mention != years of demonstrated use)
  - transferable experience cosine under-weighted
Calibration: section_score around 0.70 typically corresponds to a strong match.
Keep final_score close to section_score*100 unless you have a concrete reason to adjust.
Deviate by more than 15 points only when nuance clearly warrants it.
strengths: up to 3 short bullets of what this CV does well for this role.
concerns: up to 3 concrete gaps beyond the already-listed missing skills (seniority, domain, depth).
reasoning: 2–3 sentences, plain English, no fluff.
Return ONLY JSON matching the schema.
```

### 2. New migration: [backend/src/database/migrations/009_add_llm_rerank_fields.sql](backend/src/database/migrations/009_add_llm_rerank_fields.sql)

```sql
ALTER TABLE job_matches
  ADD COLUMN llm_score       NUMERIC(5,4),
  ADD COLUMN llm_reasoning   TEXT,
  ADD COLUMN llm_strengths   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN llm_concerns    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN llm_status      VARCHAR(16) DEFAULT 'skipped';
  -- llm_status: 'ok' | 'failed' | 'skipped'
```

Matches the existing `section_score NUMERIC` and `status VARCHAR` conventions in [004_create_job_matches_table.sql](backend/src/database/migrations/004_create_job_matches_table.sql).

### 3. Modify: [backend/src/modules/matching/match.model.js](backend/src/modules/matching/match.model.js#L24)

Extend `saveResult()` to accept six new optional fields: `llmScore`, `llmReasoning`, `llmStrengths`, `llmConcerns`, `llmStatus`. UI-facing `score` column becomes `llmScore ?? sectionScore` so `MatchBadge` and Recommended-page sort keep working without touching callers that still pass only the cosine fields.

New `UPDATE` statement sets `score, doc_score, section_score, required_skills, matched_skills, missing_skills, summary, llm_score, llm_reasoning, llm_strengths, llm_concerns, llm_status, status='done', error=NULL, matched_at=NOW()`. Stringify `llm_strengths` and `llm_concerns` arrays the same way the existing skill arrays are stringified.

### 4. Modify: [backend/src/queues/processors/matchJob.js](backend/src/queues/processors/matchJob.js#L106)

After line 145 (`buildSummary(...)`) and before the `matchModel.saveResult` call at line 147, insert:

```js
// Strip vectors — LLM only needs text phrases.
const textOnly = (s) => ({
  skills: (s?.skills || []).map((x) => x.text),
  responsibilities: (s?.responsibilities || []).map((x) => x.text),
  experience: (s?.experience || []).map((x) => x.text),
});

let llmScore = null;
let llmReasoning = null;
let llmStrengths = [];
let llmConcerns = [];
let llmStatus = 'skipped';
try {
  const rr = await rerankMatch({
    cvSections: textOnly(cvSections),
    jobSections: textOnly(jobSections),
    docScore,
    sectionScore: sect.score,
    matchedSkills: matched,
    missingSkills: missing,
    jobTitle: job.title,
  });
  if (rr) {
    llmScore = Math.max(0, Math.min(1, rr.final_score / 100));
    llmReasoning = rr.reasoning;
    llmStrengths = Array.isArray(rr.strengths) ? rr.strengths.slice(0, 3) : [];
    llmConcerns = Array.isArray(rr.concerns) ? rr.concerns.slice(0, 3) : [];
    llmStatus = 'ok';
  } else {
    llmStatus = 'failed';
  }
} catch (e) {
  console.warn(`[rerank] failed job=${jobId} cv=${cvId}: ${e.message}`);
  llmStatus = 'failed';
}
```

Then extend the `saveResult({ ... })` call with `llmScore, llmReasoning, llmStrengths, llmConcerns, llmStatus`. Keep the template `summary` as the cosine-only fallback string. The try/catch around `matchJob` stays unchanged — LLM failure does NOT throw out of the processor, only vector/section failures do.

Add a concise field to the final `console.log` line: `llm_score=${llmScore ?? 'null'}` and `llm_status=${llmStatus}`.

### 5. Modify: [frontend/src/types/match.ts](frontend/src/types/match.ts)

Add optional fields to the match type:

```ts
doc_score?: number | null;
section_score?: number | null;
llm_score?: number | null;
llm_reasoning?: string | null;
llm_strengths?: string[];
llm_concerns?: string[];
llm_status?: 'ok' | 'failed' | 'skipped';
```

Existing fields (`score`, `summary`, `required_skills`, etc.) stay — they remain authoritative for backward compat.

### 6. Modify: [frontend/src/components/kanban/JobMatchPanel.tsx](frontend/src/components/kanban/JobMatchPanel.tsx)

Render order when match is `done`:

1. **Reasoning paragraph:** `llm_reasoning ?? summary` (falls back to template when LLM skipped/failed)
2. **Strengths / Concerns** — two compact lists, only rendered when `llm_status === 'ok'` and the respective array is non-empty
3. Existing **matched / missing skills** chips (unchanged)
4. Small footer badge: `"LLM-verified"` when `llm_status === 'ok'`; `"cosine-only"` otherwise — makes the two modes visible for thesis demos

### 7. Modify: [frontend/src/components/kanban/MatchBadge.tsx](frontend/src/components/kanban/MatchBadge.tsx)

No behavior change needed — the badge already reads `score`, and the backend now writes `score = llm_score ?? section_score`. Optionally add a subtle asterisk/tooltip when `llm_status === 'failed'` saying "LLM unavailable — showing cosine score", so thesis readers can spot fallback rows.

## Error handling

| Failure mode | Behavior |
|---|---|
| LLM timeout (20s) or network error | `llm_status='failed'`, `llm_score=NULL`, `score=section_score`, row saves with `status='done'` |
| OpenAI schema validation error | Same as above (defensive — strict mode should prevent) |
| Weaviate / section extraction failure | Unchanged — still throws, `markFailed` runs, `status='failed'` |

## Cost & performance

One `gpt-4o-mini` call per match. With section arrays truncated to top 15 items each: ~1.5k input tokens + ~200 output tokens ≈ **~$0.0002 per match**. No caching in v1; add `(cv_id, job_id, cv.updated_at, job.updated_at)` keyed caching later if re-runs become common.

## Verification

1. Run migration `009` via the existing migration runner.
2. Restart the BullMQ worker (picks up new processor code).
3. Upload a new CV, scrape or open a job → wait for match to complete.
4. Query `job_matches` row: expect `llm_score`, `llm_reasoning`, `llm_strengths`, `llm_concerns` populated, `llm_status='ok'`.
5. Open JobMatchPanel in the Kanban — expect reasoning paragraph + strengths/concerns lists + "LLM-verified" badge.
6. Fails-soft check: temporarily set an invalid `OPENAI_API_KEY`, trigger a recompute — expect the match row to still save with `status='done'`, `llm_status='failed'`, `score=section_score`, and the UI to fall back to the template `summary` with a "cosine-only" footer badge.
7. For thesis: run a quick SQL `SELECT AVG(ABS(llm_score - section_score)), MAX(ABS(llm_score - section_score)) FROM job_matches WHERE llm_status='ok'` to confirm the LLM is meaningfully adjusting (not parroting cosine) but staying within the ±15-point guardrail.

## Critical files to edit

- [backend/src/lib/rerank.js](backend/src/lib/rerank.js) *(new)*
- [backend/src/database/migrations/009_add_llm_rerank_fields.sql](backend/src/database/migrations/009_add_llm_rerank_fields.sql) *(new)*
- [backend/src/queues/processors/matchJob.js](backend/src/queues/processors/matchJob.js)
- [backend/src/modules/matching/match.model.js](backend/src/modules/matching/match.model.js)
- [frontend/src/types/match.ts](frontend/src/types/match.ts)
- [frontend/src/components/kanban/JobMatchPanel.tsx](frontend/src/components/kanban/JobMatchPanel.tsx)
- [frontend/src/components/kanban/MatchBadge.tsx](frontend/src/components/kanban/MatchBadge.tsx) *(minor)*
