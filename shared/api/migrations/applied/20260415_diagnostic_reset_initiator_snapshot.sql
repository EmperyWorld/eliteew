-- Снимок инициатора полного сброса диагностики (никнейм, имя, должность/плашка на момент сброса).

ALTER TABLE marketing_diagnostic_run
    ADD COLUMN IF NOT EXISTS reset_initiator_username VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_initiator_full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_initiator_position VARCHAR(255);

COMMENT ON COLUMN marketing_diagnostic_run.reset_initiator_username IS 'Снимок username инициатора сброса';
COMMENT ON COLUMN marketing_diagnostic_run.reset_initiator_full_name IS 'Снимок отображаемого имени на момент сброса';
COMMENT ON COLUMN marketing_diagnostic_run.reset_initiator_position IS 'Снимок: admin_badge_label или роль users.role';

-- Для уже существующих прогонов с initiated_by_user_id — заполнить из users (лучше чем пусто).
UPDATE marketing_diagnostic_run r
SET
    reset_initiator_username = u.username,
    reset_initiator_full_name = COALESCE(NULLIF(BTRIM(COALESCE(u.full_name, '')), ''), u.username),
    reset_initiator_position = COALESCE(
        NULLIF(BTRIM(COALESCE(u.admin_badge_label, '')), ''),
        u.role::text
    )
FROM users u
WHERE r.initiated_by_user_id = u.id
  AND r.reset_initiator_username IS NULL;
