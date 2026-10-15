-- Chat session documents (RAG): M2M session <-> unified_content with indexing status.
-- Run once: psql -f api/migrations/chat_session_documents.sql <connection>

CREATE TABLE IF NOT EXISTS chat_session_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES unified_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    indexed_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (indexed_status IN ('pending', 'processing', 'indexed', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_session_documents_session_id ON chat_session_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_documents_document_id ON chat_session_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_documents_user_id ON chat_session_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_documents_indexed_status ON chat_session_documents(indexed_status);
