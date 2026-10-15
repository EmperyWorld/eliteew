-- EWDesk: optional hero image from Content Manager (unified_content id)
ALTER TABLE company_news_posts
	ADD COLUMN IF NOT EXISTS image_content_id UUID NULL;

COMMENT ON COLUMN company_news_posts.image_content_id IS 'Optional unified_content id for EWDesk hero image; served via GET /product-desktop/news-linked-image/{id} when post is published';

CREATE INDEX IF NOT EXISTS idx_company_news_posts_image_content_id
	ON company_news_posts (image_content_id)
	WHERE image_content_id IS NOT NULL;
