-- Allow neutral / "can't assess" batch sample feedback (analytics).
BEGIN;

ALTER TABLE music_batch_generations
    DROP CONSTRAINT IF EXISTS music_batch_generations_sample_feedback_check;

ALTER TABLE music_batch_generations
    ADD CONSTRAINT music_batch_generations_sample_feedback_check
        CHECK (
            sample_feedback IS NULL
            OR sample_feedback IN ('positive', 'negative', 'neutral')
        );

COMMENT ON COLUMN music_batch_generations.sample_feedback IS
    'User rating: positive / negative / neutral (cannot assess) for batch analytics';

COMMIT;
