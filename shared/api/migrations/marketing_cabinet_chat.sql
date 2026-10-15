-- Marketing Cabinet: persisted context chat (conversations + messages).
-- Apply against stack1 Postgres (same DB as companies/projects).

CREATE TABLE IF NOT EXISTS marketing_cabinet_chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_id UUID NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT marketing_cabinet_chat_conversations_scope_chk CHECK (
        (project_id IS NOT NULL AND company_id IS NULL)
        OR (project_id IS NULL AND company_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_mcc_conv_user_project_updated
    ON marketing_cabinet_chat_conversations (user_id, project_id, updated_at DESC)
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcc_conv_user_company_updated
    ON marketing_cabinet_chat_conversations (user_id, company_id, updated_at DESC)
    WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketing_cabinet_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES marketing_cabinet_chat_conversations (id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_mcc_msg_conversation_created
    ON marketing_cabinet_chat_messages (conversation_id, created_at);
