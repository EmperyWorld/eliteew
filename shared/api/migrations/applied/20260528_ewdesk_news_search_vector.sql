-- EWDesk: full-text search vector on company_news_posts (Russian tsconfig).

ALTER TABLE company_news_posts
	ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE company_news_posts
SET search_vector = to_tsvector(
	'russian',
	coalesce(title, '') || ' ' || coalesce(body, '')
)
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_news_posts_search_vector
	ON company_news_posts USING GIN (search_vector);

CREATE OR REPLACE FUNCTION company_news_posts_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	NEW.search_vector := to_tsvector(
		'russian',
		coalesce(NEW.title, '') || ' ' || coalesce(NEW.body, '')
	);
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_news_posts_search_vector ON company_news_posts;

CREATE TRIGGER trg_company_news_posts_search_vector
	BEFORE INSERT OR UPDATE OF title, body
	ON company_news_posts
	FOR EACH ROW
	EXECUTE FUNCTION company_news_posts_search_vector_update();

COMMENT ON COLUMN company_news_posts.search_vector IS
	'EWDesk feed full-text index (russian); maintained by trg_company_news_posts_search_vector';
