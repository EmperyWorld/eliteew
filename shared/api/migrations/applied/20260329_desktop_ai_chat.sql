-- Desktop AI Chat (Ollama): чаты, сообщения, вложения, промпты, глобальные настройки.
-- Qdrant коллекция desktop_chat_rag создаётся кодом при первом upsert (как marketing_project_rag).

BEGIN;

CREATE TABLE IF NOT EXISTS desktop_ai_chat_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO desktop_ai_chat_config (id, defaults)
VALUES (
    1,
    jsonb_build_object(
        'feature_enabled', true,
        'voice_enabled', true,
        'tools_image_enabled', true,
        'tools_web_search_enabled', false,
        'tools_fetch_url_enabled', true,
        'default_ollama_model', '',
        'default_system_prompt',
        'Ты полезный ассистент в рабочем столе EliteEW. Отвечай на русском, кратко и по делу.',
        'rag_top_k', 12,
        'rag_max_chunks_chars', 24000,
        'fetch_url_max_bytes', 1048576,
        'fetch_url_timeout_sec', 30,
        'image_generation_type_key', 'text_to_image'
    )
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS desktop_ai_chat_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    system_prompt TEXT NOT NULL,
    company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_desktop_ai_prompt_global
    ON desktop_ai_chat_prompt_templates (template_key)
    WHERE company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_desktop_ai_prompt_company
    ON desktop_ai_chat_prompt_templates (template_key, company_id)
    WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_ai_prompt_templates_company
    ON desktop_ai_chat_prompt_templates (company_id)
    WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS desktop_ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL DEFAULT 'Новый чат',
    ollama_model VARCHAR(255),
    system_prompt_override TEXT,
    use_project_rag BOOLEAN NOT NULL DEFAULT FALSE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chats_user_updated
    ON desktop_ai_chats (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS desktop_ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES desktop_ai_chats (id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tool_calls JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT desktop_ai_chat_messages_role_check CHECK (
        role IN ('user', 'assistant', 'system', 'tool')
    )
);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chat_messages_chat
    ON desktop_ai_chat_messages (chat_id, created_at);

CREATE TABLE IF NOT EXISTS desktop_ai_chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES desktop_ai_chats (id) ON DELETE CASCADE,
    content_id UUID REFERENCES unified_content (id) ON DELETE SET NULL,
    source_label VARCHAR(500),
    rag_indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chat_attachments_chat
    ON desktop_ai_chat_attachments (chat_id);

COMMIT;
