-- EWA Agentic Step Scheduler: claimable task-tree rows and retry waits.
-- Canon: documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md

ALTER TABLE ewa_agentic_task_tree
    ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS claim_holder text,
    ADD COLUMN IF NOT EXISTS claim_until timestamptz,
    ADD COLUMN IF NOT EXISTS not_before_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_error text,
    ADD COLUMN IF NOT EXISTS attempt_id text;

ALTER TABLE ewa_agentic_task_tree
    DROP CONSTRAINT IF EXISTS ewa_agentic_task_tree_status_check;

ALTER TABLE ewa_agentic_task_tree
    ADD CONSTRAINT ewa_agentic_task_tree_status_check
    CHECK (status IN (
        'pending','claimed','running','retry_wait','awaiting_human',
        'completed','failed','skipped','cancelled'
    ));

CREATE INDEX IF NOT EXISTS ewa_agentic_task_tree_runnable_idx
    ON ewa_agentic_task_tree (session_id, status, not_before_at, priority DESC, sort_order ASC)
    WHERE status IN ('pending','retry_wait','running','claimed');

CREATE INDEX IF NOT EXISTS ewa_agentic_task_tree_claim_until_idx
    ON ewa_agentic_task_tree (claim_until)
    WHERE status IN ('running','claimed');
