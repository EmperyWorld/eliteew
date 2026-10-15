-- Music Evolution: like/dislike feedback with recipe snapshots.
BEGIN;

CREATE TABLE IF NOT EXISTS music_evolution_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id UUID REFERENCES music_evolution_runs(id) ON DELETE SET NULL,
    content_id UUID NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('like', 'dislike')),
    reason_code TEXT,
    reason_custom TEXT,
    recipe_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT music_evolution_dislike_reason_required CHECK (
        rating <> 'dislike'
        OR reason_code IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_music_evolution_feedback_user_content
    ON music_evolution_feedback (user_id, content_id);

CREATE INDEX IF NOT EXISTS idx_music_evolution_feedback_user_created
    ON music_evolution_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_music_evolution_feedback_rating
    ON music_evolution_feedback (rating);

CREATE INDEX IF NOT EXISTS idx_music_evolution_feedback_style
    ON music_evolution_feedback ((recipe_snapshot->'metadata'->>'music_generator_style'));

COMMENT ON TABLE music_evolution_feedback IS
    'Music Evolution result feedback: like/dislike plus recipe snapshot for future quality loops.';

COMMIT;
