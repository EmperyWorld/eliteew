-- EWDesk: optional hero image URL for company news posts (https/http or same-origin path).

ALTER TABLE company_news_posts
	ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

COMMENT ON COLUMN company_news_posts.image_url IS 'Optional image URL for EWDesk (https/http or path starting with /); validated in API';
