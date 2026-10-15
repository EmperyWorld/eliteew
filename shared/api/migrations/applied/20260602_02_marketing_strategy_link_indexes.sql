-- AMKA / Marketing Cabinet: indexes for strategy graph link arrays.
-- Safe to re-run; improves overview/reconcile lookups on UUID[] link fields.

CREATE INDEX IF NOT EXISTS idx_value_propositions_addressed_job_ids_gin
    ON value_propositions
    USING GIN (addressed_job_ids)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_segments_linked_job_story_ids_gin
    ON marketing_segments
    USING GIN (linked_job_story_ids)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_segments_linked_content_ids_gin
    ON marketing_segments
    USING GIN (linked_content_ids)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_linked_segment_ids_gin
    ON marketing_campaigns
    USING GIN (linked_segment_ids)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_linked_value_prop_ids_gin
    ON marketing_campaigns
    USING GIN (linked_value_prop_ids)
    WHERE deleted_at IS NULL;
