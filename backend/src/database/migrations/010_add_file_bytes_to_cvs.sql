-- Store the original uploaded CV bytes so the user can preview the PDF in-app.
-- BYTEA is fine for the 5MB upload cap; column is nullable so existing rows keep working
-- (they'll show a "re-upload to enable preview" fallback in the UI).
ALTER TABLE cvs ADD COLUMN IF NOT EXISTS file_bytes BYTEA;
