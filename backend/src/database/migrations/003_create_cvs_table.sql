CREATE TABLE IF NOT EXISTS cvs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  parsed_text TEXT NOT NULL,
  weaviate_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, done, failed
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cvs_one_active_per_user
  ON cvs(user_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs(user_id);
