-- Music Generator: уточнение description для UGS — контракт lyrics (вокал) vs tags (аранжировка).
-- apply_migrations.sh; при необходимости перезапуск API.

BEGIN;

UPDATE generation_types
SET description = 'Генерация только вокального текста песни (слова для пения). Без звуковых эффектов и без описания аранжировки в тексте; для аранжировки используйте generate-style (теги звучания).'
WHERE type_key = 'music_generator_lyrics';

UPDATE generation_types
SET description = 'Генерация тегов звучания на английском: инструментал, эффекты, секции [intro]/[drop] для ACE Step 1.5. Не включает текст песни (lyrics).'
WHERE type_key = 'music_generator_style';

COMMIT;
