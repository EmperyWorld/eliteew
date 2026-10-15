-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Убрать скрытые ошибки RLS: после сброса контекста middleware пишет '' в `app.current_user_id` / `app.current_company_id`;
-- выражение `(current_setting(..., true))::uuid` на пустой строке даёт **ошибку**, а не «нет строк».
-- Invariants:
-- - Хелперы STABLE; пустой/NULL setting → NULL::uuid (сравнения дают UNKNOWN/FALSE без exception).
-- - Политики пересозданы с тем же смыслом, что до патча.
-- Related:
-- - api/middleware/rls_middleware.py (сброс в '')
-- - applied/20260516_fix_rls_documents_and_jtbd_offer_guc.sql
-- ---

BEGIN;

SET LOCAL lock_timeout = '30s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.app_rls_session_user_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
SELECT NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.app_rls_session_company_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
SELECT NULLIF(BTRIM(current_setting('app.current_company_id', TRUE)), '')::uuid;
$$;

COMMENT ON FUNCTION public.app_rls_session_user_uuid() IS
    'RLS helper: безопасное UUID из app.current_user_id (пустая строка после clear → NULL).';

COMMENT ON FUNCTION public.app_rls_session_company_uuid() IS
    'RLS helper: безопасное UUID из app.current_company_id (пустая строка после clear → NULL).';

-- Совместимо с маркетинговым дашбордом (та же семантика).
CREATE OR REPLACE FUNCTION public.app_marketing_dashboard_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
SELECT app_rls_session_user_uuid();
$$;

-- ---------------------------------------------------------------------------
-- Пересоздание политик
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS company_isolation ON audit_logs;
CREATE POLICY company_isolation ON audit_logs
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (
        company_id = app_rls_session_company_uuid()
        OR user_id = app_rls_session_user_uuid()
    );

DROP POLICY IF EXISTS company_isolation ON companies;
CREATE POLICY company_isolation ON companies
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (id = app_rls_session_company_uuid())
    WITH CHECK (id = app_rls_session_company_uuid());

DROP POLICY IF EXISTS company_isolation ON projects;
CREATE POLICY company_isolation ON projects
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (company_id = app_rls_session_company_uuid())
    WITH CHECK (company_id = app_rls_session_company_uuid());

DROP POLICY IF EXISTS owner_access ON projects;
CREATE POLICY owner_access ON projects
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (created_by = app_rls_session_user_uuid())
    WITH CHECK (created_by = app_rls_session_user_uuid());

DROP POLICY IF EXISTS user_self_access ON users;
CREATE POLICY user_self_access ON users
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (id = app_rls_session_user_uuid());

DROP POLICY IF EXISTS user_self_update ON users;
CREATE POLICY user_self_update ON users
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING (id = app_rls_session_user_uuid())
    WITH CHECK (id = app_rls_session_user_uuid());

DROP POLICY IF EXISTS company_isolation ON tags;
CREATE POLICY company_isolation ON tags
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (company_id = app_rls_session_company_uuid())
    WITH CHECK (company_id = app_rls_session_company_uuid());

DROP POLICY IF EXISTS project_access ON ab_tests;
CREATE POLICY project_access ON ab_tests
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    );

DROP POLICY IF EXISTS project_access ON customer_segments;
CREATE POLICY project_access ON customer_segments
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    );

DROP POLICY IF EXISTS project_access ON financial_models;
CREATE POLICY project_access ON financial_models
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    );

DROP POLICY IF EXISTS project_access ON job_stories;
CREATE POLICY project_access ON job_stories
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    );

DROP POLICY IF EXISTS project_access ON swot_analyses;
CREATE POLICY project_access ON swot_analyses
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    );

DROP POLICY IF EXISTS project_access ON value_propositions;
CREATE POLICY project_access ON value_propositions
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT projects.id
            FROM projects
            WHERE projects.company_id = app_rls_session_company_uuid()
               OR projects.created_by = app_rls_session_user_uuid()
        )
    );

COMMIT;
