-- One-shot rename legacy AMKA orchestration tables/index → EWA (PostgreSQL).
-- Запускайте только если в БД ещё есть ``amka_orchestration_*`` после обновления кода на ``ewa_orchestration_*``.

BEGIN;

ALTER TABLE IF EXISTS amka_orchestration_session RENAME TO ewa_orchestration_session;
ALTER TABLE IF EXISTS amka_orchestration_event RENAME TO ewa_orchestration_event;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'amka_orchestration_event_session_seq_idx'
    ) THEN
        EXECUTE 'ALTER INDEX amka_orchestration_event_session_seq_idx RENAME TO ewa_orchestration_event_session_seq_idx';
    END IF;
END $$;

COMMIT;
