-- EWA Agentic: allow awaiting_child status for accepted async child jobs.
-- Canon: documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md §async child work

ALTER TABLE ewa_agentic_task_tree
    DROP CONSTRAINT IF EXISTS ewa_agentic_task_tree_status_check;

ALTER TABLE ewa_agentic_task_tree
    ADD CONSTRAINT ewa_agentic_task_tree_status_check
    CHECK (status IN (
        'pending','claimed','running','retry_wait','awaiting_human','awaiting_child',
        'completed','failed','skipped','cancelled'
    ));
