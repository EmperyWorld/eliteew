-- Разрешение соавтору сохранять канонический документ владельца (PUT /documents и черновик на сервере).
-- По умолчанию false: только совместное редактирование в реальном времени (Yjs), без записи в unified_content.

BEGIN;

ALTER TABLE doc_collaboration_invites
    ADD COLUMN IF NOT EXISTS allow_collaborators_save BOOLEAN NOT NULL DEFAULT FALSE;

-- Уже принятые приглашения: не ломаем текущее поведение (раньше сохранение соавтором было возможно).
UPDATE doc_collaboration_invites
SET allow_collaborators_save = TRUE
WHERE status = 'accepted';

COMMIT;
