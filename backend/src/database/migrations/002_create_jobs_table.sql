CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,           -- 'linkedin', 'seek', 'glints'
  external_id VARCHAR(255),                -- job ID on the platform
  title VARCHAR(500) NOT NULL,
  company_name VARCHAR(255),
  location VARCHAR(255),
  description TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency VARCHAR(10),
  employment_type VARCHAR(100),            -- full-time, part-time, contract, internship
  url TEXT,                                -- original job posting URL
  posted_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'saved',      -- saved, applied, interview, offered, rejected
  raw_data JSONB,                          -- full raw data from extension
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, platform, external_id)   -- prevent duplicate saves
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
