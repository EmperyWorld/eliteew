-- GAF Chat E2E: user public keys for handshake (rsa_oaep_sha256 wire identity).
-- Idempotent. Historical one-shot: shared/api/migrations/gaf_chat_keys.sql
-- Applied on prod-core 2026-09-03 after UndefinedTableError on /gaf-chat/keys/public/me.

CREATE TABLE IF NOT EXISTS gaf_user_public_keys (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    public_key_pem TEXT NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
