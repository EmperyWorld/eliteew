ALTER TABLE user_site_instances
    ADD COLUMN IF NOT EXISTS public_hostname VARCHAR(255);

ALTER TABLE user_site_instances
    ADD COLUMN IF NOT EXISTS publication_state VARCHAR(16);

ALTER TABLE user_site_instances
    ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP NULL;

ALTER TABLE user_site_instances
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL;

UPDATE user_site_instances
SET public_hostname = CONCAT(site_slug, '.sites.eliteew.ru')
WHERE public_hostname IS NULL OR btrim(public_hostname) = '';

UPDATE user_site_instances
SET public_url = CONCAT('https://', public_hostname)
WHERE public_hostname IS NOT NULL
  AND (public_url IS NULL OR public_url NOT LIKE 'https://%.sites.eliteew.ru%');

UPDATE user_site_instances
SET api_base_url = CONCAT('https://', public_hostname, '/api')
WHERE public_hostname IS NOT NULL
  AND (api_base_url IS NULL OR api_base_url NOT LIKE 'https://%.sites.eliteew.ru/api');

UPDATE user_site_instances
SET publication_state = 'closed'
WHERE publication_state IS NULL OR btrim(publication_state) = '';

UPDATE user_site_instances
SET closed_at = COALESCE(closed_at, NOW())
WHERE publication_state = 'closed';

ALTER TABLE user_site_instances
    ALTER COLUMN public_hostname SET NOT NULL;

ALTER TABLE user_site_instances
    ALTER COLUMN publication_state SET NOT NULL;

ALTER TABLE user_site_instances
    ALTER COLUMN publication_state SET DEFAULT 'open';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_site_instances_publication_state_check'
    ) THEN
        ALTER TABLE user_site_instances
            ADD CONSTRAINT user_site_instances_publication_state_check
            CHECK (publication_state IN ('open', 'closed'));
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_site_instances_public_hostname
    ON user_site_instances (public_hostname);

CREATE INDEX IF NOT EXISTS idx_user_site_instances_publication_state
    ON user_site_instances (publication_state);
