-- Phase 3.5c Stage A: condense sidecar atomic persistence support.
-- Canon: documentation/product/ewa/EWA-AGENTIC-STRUCTURED-REASONING-ENGINE-TDD.md §2.3
--
-- No new columns: warm tier (plan_summary) and hot tier marker
-- (working_memory_json.active_slice.last_condense_seq) already exist on ewa_agentic_sessions.
-- Condense checkpoints use kind='condense' on ewa_agentic_checkpoint_logs.
--
-- Application contract (agentic_persist_condense_atomic):
--   1. SELECT session FOR UPDATE + expect_revision guard
--   2. UPDATE plan_summary + working_memory_json + session_revision in same transaction
--   3. INSERT kind=condense checkpoint with payload {from_seq, to_seq, trigger, ...}
--
-- Range scan for checkpoints since last condense:
--   WHERE session_id = $1 AND seq > $2 ORDER BY seq ASC

CREATE INDEX IF NOT EXISTS ewa_agentic_checkpoint_logs_session_seq_asc_idx
    ON ewa_agentic_checkpoint_logs (session_id, seq);

COMMENT ON INDEX ewa_agentic_checkpoint_logs_session_seq_asc_idx IS
    'Condense sidecar: list checkpoints since last_condense_seq (Phase 3.5c)';
