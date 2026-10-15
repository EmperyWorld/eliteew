-- Desktop AI Chat: лимит спикеров за ход в групповом режиме (операторский default).
-- Без ключа бэкенд берёт min(|ростер|, ENSEMBLE_MAX_ROSTER_HEROES); явное значение в defaults переопределяет.

BEGIN;

UPDATE desktop_ai_chat_config
SET
    defaults = coalesce(defaults, '{}'::jsonb)
    || jsonb_build_object('ensemble_max_speakers_per_turn', 3),
    updated_at = NOW()
WHERE id = 1;

COMMIT;
