-- Section-level decomposition for CV/JD.
-- Each `sections` JSONB is an object:
--   { skills: [{ text, vector }], responsibilities: [...], experience: [...] }
-- vectors are float arrays from text-embedding-3-small (1536 dims).
ALTER TABLE cvs  ADD COLUMN IF NOT EXISTS sections JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sections JSONB;

-- Split score columns on job_matches so thesis can compare baseline (doc_score)
-- vs section-level scoring (section_score). Existing `score` column stays and
-- is kept equal to section_score at write time for UI/API backward-compat.
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS doc_score     NUMERIC(5,4);
ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS section_score NUMERIC(5,4);
