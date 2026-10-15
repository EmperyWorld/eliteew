BEGIN;

ALTER TABLE music_batch_generations
    ADD COLUMN IF NOT EXISTS sample_feedback TEXT
        CHECK (sample_feedback IS NULL OR sample_feedback IN ('positive', 'negative'));

ALTER TABLE music_batch_generations
    ADD COLUMN IF NOT EXISTS sample_feedback_comment TEXT;

ALTER TABLE music_batch_generations
    ADD COLUMN IF NOT EXISTS sample_feedback_at TIMESTAMPTZ;

COMMENT ON COLUMN music_batch_generations.sample_feedback IS 'User rating: positive/negative (batch analytics)';
COMMENT ON COLUMN music_batch_generations.sample_feedback_comment IS 'Optional user comment for the rating';
COMMENT ON COLUMN music_batch_generations.sample_feedback_at IS 'When the user last set feedback';

COMMIT;
