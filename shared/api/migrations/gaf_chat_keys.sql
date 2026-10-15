-- GAF Chat E2E: user public keys for handshake. Apply after gaf_chat_tables.sql:
--   docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/gaf_chat_keys.sql

CREATE TABLE IF NOT EXISTS gaf_user_public_keys (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    public_key_pem TEXT NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
