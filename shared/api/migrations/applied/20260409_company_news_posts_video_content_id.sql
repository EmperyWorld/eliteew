-- EWDesk: optional hero video from Content Manager
ALTER TABLE company_news_posts
	ADD COLUMN IF NOT EXISTS video_content_id UUID NULL;

COMMENT ON COLUMN company_news_posts.video_content_id IS 'Optional unified_content id for EWDesk hero video; served via GET /product-desktop/news-linked-video/{id} when post is published';

CREATE INDEX IF NOT EXISTS idx_company_news_posts_video_content_id
	ON company_news_posts (video_content_id)
	WHERE video_content_id IS NOT NULL;
