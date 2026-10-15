-- AssistantApp (FAQ handbook): user-facing name «Справочная Навигация» (not EWA «Ассистент»).

BEGIN;

UPDATE desktop_app_catalog
SET
    name = 'Справочная Навигация',
    description = 'Навигация по продукту: готовые ответы (FAQ) и чат по интерфейсу EliteEW.',
    updated_at = NOW()
WHERE app_id = 'app-assistant'
  AND name IN ('Ассистент', 'Справочник', 'Handbook', 'Assistant');

UPDATE assistant_faq_entries
SET
    question = REPLACE(
        REPLACE(
            REPLACE(question, '«Ассистент»', '«Справочная навигация»'),
            '«Ассистенте»',
            '«Справочной навигации»'
        ),
        '«Ассистента»',
        '«Справочной навигации»'
    ),
    answer = REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(answer, '«Ассистент»', '«Справочная навигация»'),
                    '«Ассистенте»',
                    '«Справочной навигации»'
                ),
                '«Ассистента»',
                '«Справочной навигации»'
            ),
            '«Справочник»',
            '«Справочная навигация»'
        ),
        '«Справочнике»',
        '«Справочной навигации»'
    )
WHERE question ILIKE '%ассистент%'
   OR answer ILIKE '%ассистент%'
   OR question ILIKE '%справочник%'
   OR answer ILIKE '%справочник%';

COMMIT;
