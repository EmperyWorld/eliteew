-- Учёт дизлайков генератора песен: снимок рецепта + причина (аналитика качества жанров).

CREATE TABLE IF NOT EXISTS music_generator_dislike_feedback (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	content_id UUID NOT NULL,
	name TEXT,
	reason_code TEXT NOT NULL
		CHECK (reason_code IN (
			'vocal', 'mix', 'genre_mismatch', 'arrangement', 'lyrics', 'tempo_rhythm', 'artifacts', 'other'
		)),
	reason_custom TEXT,
	recipe_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT music_generator_dislike_reason_other_ok CHECK (
		(reason_code IS DISTINCT FROM 'other')
		OR (length(btrim(COALESCE(reason_custom, ''))) >= 1)
	)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mg_dislike_user_content
	ON music_generator_dislike_feedback (user_id, content_id);

CREATE INDEX IF NOT EXISTS idx_mg_dislike_user_created
	ON music_generator_dislike_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mg_dislike_style
	ON music_generator_dislike_feedback ((recipe_snapshot->'metadata'->>'music_generator_style'));

COMMENT ON TABLE music_generator_dislike_feedback IS
	'Dislike on music generator track: reason + recipe snapshot (content may be deleted after).';
