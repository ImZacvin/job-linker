-- LLM re-rank pass stored alongside cosine scores so the thesis evaluation
-- harness can compare cosine-only (section_score) vs cosine+LLM (llm_score)
-- head-to-head on the same match rows.
--   llm_score:     LLM-adjusted 0.0000..1.0000, NULL when LLM was skipped/failed.
--   llm_reasoning: 2-3 sentence human-readable explanation of the match.
--   llm_strengths: JSON array of up to 3 short bullets (CV's strong points for this job).
--   llm_concerns:  JSON array of up to 3 short bullets (gaps beyond missing_skills).
--   llm_status:    'ok' | 'failed' | 'skipped' — so failed rows are distinguishable from not-yet-attempted.
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS llm_score     NUMERIC(5,4);
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS llm_reasoning TEXT;
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS llm_strengths JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS llm_concerns  JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS llm_status    VARCHAR(16) DEFAULT 'skipped';
