-- EWA Agentic Substrate: durable sessions, task tree, checkpoints, inbound inbox.
-- Canon: documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md

CREATE TABLE IF NOT EXISTS ewa_agentic_sessions (
    id                  text PRIMARY KEY,
    principal_id        text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'init'
                        CHECK (status IN (
                            'init','planning','executing','awaiting_human','paused',
                            'replanning','completed','failed','cancelled','abandoned'
                        )),
    session_revision    bigint NOT NULL DEFAULT 1 CHECK (session_revision >= 1),
    goal_json           jsonb NOT NULL DEFAULT '{}'::jsonb,
    plan_summary        text NOT NULL DEFAULT '',
    active_node_id      text,
    policy_json         jsonb NOT NULL DEFAULT '{}'::jsonb,
    working_memory_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    gate_json           jsonb NOT NULL DEFAULT '{}'::jsonb,
    linked_task_run_id  text REFERENCES ewa_companion_task_runs (id) ON DELETE SET NULL,
    lease_holder        text,
    leased_until        timestamptz,
    last_heartbeat_at   timestamptz,
    iteration_count     integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS ewa_agentic_sessions_principal_status_updated_idx
    ON ewa_agentic_sessions (principal_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ewa_agentic_sessions_one_active_per_principal_idx
    ON ewa_agentic_sessions (principal_id)
    WHERE status IN ('init','planning','executing','awaiting_human','paused','replanning');

CREATE TABLE IF NOT EXISTS ewa_agentic_task_tree (
    id                  text PRIMARY KEY,
    session_id          text NOT NULL REFERENCES ewa_agentic_sessions (id) ON DELETE CASCADE,
    parent_id           text REFERENCES ewa_agentic_task_tree (id) ON DELETE CASCADE,
    materialized_path   text NOT NULL DEFAULT '/',
    sort_order          integer NOT NULL DEFAULT 0,
    node_kind           text NOT NULL CHECK (node_kind IN (
                            'goal','plan','subtask','tool','llm','gate','branch','checkpoint'
                        )),
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending','running','awaiting_human','completed','failed','skipped','cancelled'
                        )),
    title               text NOT NULL DEFAULT '',
    instruction         text NOT NULL DEFAULT '',
    tool_name           text,
    tool_args_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
    result_ref          text,
    result_summary      text NOT NULL DEFAULT '',
    retry_count         integer NOT NULL DEFAULT 0,
    max_retries         integer NOT NULL DEFAULT 2,
    gate_json           jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    started_at          timestamptz,
    completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS ewa_agentic_task_tree_session_path_idx
    ON ewa_agentic_task_tree (session_id, materialized_path);

CREATE INDEX IF NOT EXISTS ewa_agentic_task_tree_session_status_idx
    ON ewa_agentic_task_tree (session_id, status);

CREATE TABLE IF NOT EXISTS ewa_agentic_checkpoint_logs (
    id                  bigserial PRIMARY KEY,
    session_id          text NOT NULL REFERENCES ewa_agentic_sessions (id) ON DELETE CASCADE,
    node_id             text REFERENCES ewa_agentic_task_tree (id) ON DELETE SET NULL,
    seq                 integer NOT NULL,
    kind                text NOT NULL CHECK (kind IN (
                            'state_transition','observe','think','plan','act','gate','error','condense'
                        )),
    payload_json        jsonb NOT NULL DEFAULT '{}'::jsonb,
    payload_bytes       integer NOT NULL DEFAULT 0,
    llm_model           text,
    token_estimate      integer,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS ewa_agentic_checkpoint_logs_session_created_idx
    ON ewa_agentic_checkpoint_logs (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ewa_agentic_inbound_messages (
    id                  text PRIMARY KEY,
    session_id          text NOT NULL REFERENCES ewa_agentic_sessions (id) ON DELETE CASCADE,
    principal_id        text NOT NULL,
    source              text NOT NULL CHECK (source IN ('chat','confirm_api','operator')),
    message_json        jsonb NOT NULL DEFAULT '{}'::jsonb,
    client_turn_id      text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    consumed_at         timestamptz
);

CREATE INDEX IF NOT EXISTS ewa_agentic_inbound_session_unconsumed_idx
    ON ewa_agentic_inbound_messages (session_id, created_at)
    WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ewa_agentic_inbound_session_client_turn_idx
    ON ewa_agentic_inbound_messages (session_id, client_turn_id)
    WHERE client_turn_id IS NOT NULL;
