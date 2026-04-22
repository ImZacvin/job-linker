ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_source VARCHAR(20) NOT NULL DEFAULT 'extension';
-- values: 'extension' | 'server' | 'none'
