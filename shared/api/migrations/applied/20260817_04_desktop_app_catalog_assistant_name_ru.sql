-- AssistantApp catalog + FAQ copy: «Ассистент», not «Справочник».

BEGIN;

UPDATE desktop_app_catalog
SET
    name = 'Ассистент',
    description = 'Помощь по продукту: готовые ответы (FAQ) и чат по интерфейсу EliteEW.',
    updated_at = NOW()
WHERE app_id = 'app-assistant'
  AND (name = 'Справочник' OR name ILIKE '%handbook%');

UPDATE assistant_faq_entries
SET
    question = REPLACE(question, '«Справочник»', '«Ассистент»'),
    answer = REPLACE(
        REPLACE(
            REPLACE(answer, '«Справочник»', '«Ассистент»'),
            '«Справочнике»',
            '«Ассистенте»'
        ),
        '«Справочника»',
        '«Ассистента»'
    )
WHERE question ILIKE '%справочник%'
   OR answer ILIKE '%справочник%';

COMMIT;
