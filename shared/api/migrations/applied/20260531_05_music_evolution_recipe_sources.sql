-- Music Evolution: materialized quality signals from liked/disliked/evolution recipes.
BEGIN;

CREATE TABLE IF NOT EXISTS music_evolution_recipe_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_kind TEXT NOT NULL
        CHECK (source_kind IN ('liked_json', 'liked_content', 'dislike_feedback', 'evolution_feedback')),
    source_key TEXT NOT NULL,
    source_content_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quality_signal INTEGER NOT NULL DEFAULT 0 CHECK (quality_signal BETWEEN -10 AND 10),
    style TEXT,
    vocal TEXT,
    language TEXT,
    mood TEXT,
    meaning_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_evolution_recipe_sources_kind_key UNIQUE (source_kind, source_key)
);

CREATE INDEX IF NOT EXISTS idx_music_evolution_recipe_sources_user_seen
    ON music_evolution_recipe_sources (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_music_evolution_recipe_sources_style
    ON music_evolution_recipe_sources (style);

CREATE INDEX IF NOT EXISTS idx_music_evolution_recipe_sources_signal
    ON music_evolution_recipe_sources (quality_signal);

COMMENT ON TABLE music_evolution_recipe_sources IS
    'Materialized recipe corpus for Music Evolution retrieval, scoped per user unless explicitly anonymized later.';

COMMIT;
