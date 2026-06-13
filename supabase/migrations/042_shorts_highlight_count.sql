-- Add highlight_count column to shorts_jobs table
ALTER TABLE shorts_jobs ADD COLUMN IF NOT EXISTS highlight_count INTEGER DEFAULT 5;

COMMENT ON COLUMN shorts_jobs.highlight_count IS '요청된 쇼츠 하이라이트 개수 (5 또는 10)';
