-- EWRP: persist web search quality tier per job (use_web_search column already exists)
ALTER TABLE ewrp_jobs
    ADD COLUMN IF NOT EXISTS web_search_quality VARCHAR(16);

COMMENT ON COLUMN ewrp_jobs.web_search_quality IS 'off | light | standard | deep; empty when off';
