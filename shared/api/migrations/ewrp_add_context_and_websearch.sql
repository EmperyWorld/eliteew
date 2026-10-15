-- EWRP: add extra_context, source_content_id and use_web_search flags to ewrp_jobs

ALTER TABLE ewrp_jobs
    ADD COLUMN IF NOT EXISTS extra_context TEXT NULL,
    ADD COLUMN IF NOT EXISTS source_content_id UUID NULL,
    ADD COLUMN IF NOT EXISTS use_web_search BOOLEAN NOT NULL DEFAULT FALSE;

