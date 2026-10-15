-- EWDesk: optional audio attachment from Content Manager (independent of image/video hero)
ALTER TABLE company_news_posts
	ADD COLUMN IF NOT EXISTS audio_content_id UUID NULL;

COMMENT ON COLUMN company_news_posts.audio_content_id IS 'Optional unified_content id for EWDesk audio; served via GET /product-desktop/news-linked-audio/{id} when post is published';

CREATE INDEX IF NOT EXISTS idx_company_news_posts_audio_content_id
	ON company_news_posts (audio_content_id)
	WHERE audio_content_id IS NOT NULL;
