-- EWA Agentic: allow Think schema node kinds expert_chat / block_append on task tree.
-- Symptom (prod 2026-07-10): CheckViolationError ewa_agentic_task_tree_node_kind_check
-- when mutate inserts node_kind=expert_chat for call_expert_chat.
-- Canon: think_schema.py Literal + EWA-AGENTIC-RECOVERY-ROUTING.md research path.

ALTER TABLE ewa_agentic_task_tree
    DROP CONSTRAINT IF EXISTS ewa_agentic_task_tree_node_kind_check;

ALTER TABLE ewa_agentic_task_tree
    ADD CONSTRAINT ewa_agentic_task_tree_node_kind_check
    CHECK (node_kind IN (
        'goal', 'plan', 'subtask', 'tool', 'llm', 'gate', 'branch', 'checkpoint',
        'expert_chat', 'block_append'
    ));
