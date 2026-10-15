-- POEMMA server-first domain:
-- 1) Workspace snapshot storage per owner user.
-- 2) Membership role table for owner/team/manager/smm/production ACL.

BEGIN;

CREATE TABLE IF NOT EXISTS poemma_workspaces (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    org_id VARCHAR(120) NOT NULL,
    payload_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    storage_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    migrated_from_local BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_poemma_workspaces_owner_user_id
    ON poemma_workspaces(owner_user_id);

CREATE TABLE IF NOT EXISTS poemma_workspace_memberships (
    workspace_id UUID NOT NULL REFERENCES poemma_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(24) NOT NULL
        CHECK (role IN ('owner', 'team', 'manager', 'smm', 'production')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT poemma_workspace_memberships_pk PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_poemma_workspace_memberships_user_id
    ON poemma_workspace_memberships(user_id);

INSERT INTO poemma_workspace_memberships (workspace_id, user_id, role, created_at, updated_at)
SELECT w.id, w.owner_user_id, 'owner', NOW(), NOW()
FROM poemma_workspaces w
ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = 'owner',
    updated_at = NOW();

COMMIT;
