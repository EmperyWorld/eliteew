-- «Меченый»: оценка с выбором аспектов (что именно удачно) для аналитики.
BEGIN;

ALTER TABLE music_batch_generations
    ADD COLUMN IF NOT EXISTS sample_feedback_highlights JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE music_batch_generations
    DROP CONSTRAINT IF EXISTS music_batch_generations_sample_feedback_check;

ALTER TABLE music_batch_generations
    ADD CONSTRAINT music_batch_generations_sample_feedback_check
        CHECK (
            sample_feedback IS NULL
            OR sample_feedback IN ('positive', 'negative', 'neutral', 'tagged')
        );

COMMENT ON COLUMN music_batch_generations.sample_feedback IS
    'User rating: positive / negative / neutral / tagged (highlight aspects) for batch analytics';

COMMENT ON COLUMN music_batch_generations.sample_feedback_highlights IS
    'When sample_feedback = tagged: JSON array of aspect keys (see capabilities feedback_highlights)';

COMMIT;
