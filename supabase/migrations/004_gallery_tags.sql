-- gallery_albums에 tags 배열 컬럼 추가
ALTER TABLE gallery_albums
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 기존 category 값을 tags로 마이그레이션
UPDATE gallery_albums SET tags = ARRAY[category] WHERE category IS NOT NULL AND tags = '{}';

-- tags 검색 성능을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_gallery_albums_tags ON gallery_albums USING GIN (tags);
