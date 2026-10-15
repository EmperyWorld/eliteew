-- Описание «Студия Звукозаписи» / Music Generator (без вендоров; финальный текст см. также 20260408).

BEGIN;

UPDATE desktop_app_catalog
SET
    description = 'Напишите строки песни и получите музыкальное сопровождение под настроение — от черновика текста до прослушивания трека в одном рабочем пространстве.',
    updated_at = NOW()
WHERE app_id = 'app-music-generator';

COMMIT;
