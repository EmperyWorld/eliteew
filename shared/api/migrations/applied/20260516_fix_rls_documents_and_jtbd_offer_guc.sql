-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Исправить ошибки RLS: политики для `documents` (RLS включён без политик) и выровнять `jtbd_offers` / `offer_ab_tests`
-- с middleware (`app.current_user_id`, см. `rls_middleware.py`). Реальная колонка владельца в `documents` — **`author_id`** (text).
-- Invariants:
-- - Политики permissive; доступ у автора по строковому совпадению с `app.current_user_id` или admin/ai_agent для документов.
-- - `jtbd_offers.user_id` и `offer_ab_tests.user_id` в БД — **text**; сравнение без `::uuid`.
-- Related:
-- - api/middleware/rls_middleware.py
-- - api/models/database_models.py (`Document`)
-- ---

BEGIN;

SET LOCAL lock_timeout = '30s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

CREATE POLICY documents_admin_full_access ON documents
    FOR ALL
    USING (
        current_setting('app.current_role'::text, true) = ANY (
            ARRAY['admin'::text, 'ai_agent'::text]
        )
    )
    WITH CHECK (
        current_setting('app.current_role'::text, true) = ANY (
            ARRAY['admin'::text, 'ai_agent'::text]
        )
    );

CREATE POLICY documents_author_isolation ON documents
    FOR ALL
    USING (
        author_id IS NOT NULL
        AND BTRIM(author_id) <> ''
        AND author_id = NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')
    )
    WITH CHECK (
        author_id IS NOT NULL
        AND BTRIM(author_id) <> ''
        AND author_id = NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')
    );

-- ---------------------------------------------------------------------------
-- Неверный GUC `rls.user_id` (middleware его не задаёт)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS jtbd_offers_user_isolation ON jtbd_offers;

CREATE POLICY jtbd_offers_user_isolation ON jtbd_offers
    FOR ALL
    USING (
        user_id IS NOT NULL
        AND user_id <> ''
        AND user_id = NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')
    )
    WITH CHECK (
        user_id IS NOT NULL
        AND user_id <> ''
        AND user_id = NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')
    );

DROP POLICY IF EXISTS offer_ab_tests_user_isolation ON offer_ab_tests;

CREATE POLICY offer_ab_tests_user_isolation ON offer_ab_tests
    FOR ALL
    USING (
        user_id IS NOT NULL
        AND user_id <> ''
        AND user_id = NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')
    )
    WITH CHECK (
        user_id IS NOT NULL
        AND user_id <> ''
        AND user_id = NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')
    );

COMMIT;
