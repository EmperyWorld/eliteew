-- Справочник: глобальные настройки + документы KB (текст в Postgres, чанки в Qdrant)

CREATE TABLE IF NOT EXISTS assistant_settings (
	id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
	ollama_model TEXT NULL,
	extra_system_prompt TEXT NULL,
	rag_top_k INT NOT NULL DEFAULT 8,
	rag_enabled BOOLEAN NOT NULL DEFAULT true,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO assistant_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM assistant_settings WHERE id = 1);

CREATE TABLE IF NOT EXISTS assistant_kb_documents (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title TEXT NOT NULL,
	body TEXT NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'draft',
	chunk_count INT NOT NULL DEFAULT 0,
	last_error TEXT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_kb_status ON assistant_kb_documents (status, updated_at DESC);
