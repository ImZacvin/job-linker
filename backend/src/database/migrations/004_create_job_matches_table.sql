CREATE TABLE IF NOT EXISTS job_matches (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cv_id INTEGER NOT NULL REFERENCES cvs(id) ON DELETE CASCADE,
  score NUMERIC(5,4),                                  -- 0.0000 .. 1.0000 cosine
  required_skills JSONB,                               -- [{name, level?}]
  matched_skills JSONB,
  missing_skills JSONB,
  summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',       -- pending, done, failed
  error TEXT,
  matched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, cv_id)
);

CREATE INDEX IF NOT EXISTS idx_job_matches_job ON job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_cv ON job_matches(cv_id);
