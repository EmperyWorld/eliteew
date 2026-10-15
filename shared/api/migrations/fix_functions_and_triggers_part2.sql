-- Fix DB functions/triggers (part 2): documents trigger, get_user_activity_timeline UUID comparison.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/fix_functions_and_triggers_part2.sql

BEGIN;

-- 1. trigger_document_security_check: table "documents" has no column virus_scan_status; remove assignment to avoid INSERT failure
CREATE OR REPLACE FUNCTION public.trigger_document_security_check()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Log document upload (virus_scan_status column not present in documents table)
    INSERT INTO system_metrics (service_name, metric_name, metric_type, value, unit)
    VALUES ('documents', 'document_uploaded', 'counter', 1, 'count');

    RETURN NEW;
END;
$function$;

-- 2. get_user_activity_timeline: content_audit_log.user_id and unified_content.user_id are UUID; compare uuid to uuid
CREATE OR REPLACE FUNCTION public.get_user_activity_timeline(p_user_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, activity_type text, action text, title text, event_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH content_events AS (
        SELECT
            cal.id,
            'document'::TEXT AS activity_type,
            cal.action::TEXT,
            COALESCE(
                NULLIF(uc.title, ''),
                NULLIF(uc.name, ''),
                NULLIF(uc.original_filename, ''),
                'Контент'
            ) AS title,
            cal.created_at AS event_time
        FROM content_audit_log cal
        LEFT JOIN unified_content uc ON uc.id = cal.content_id
        WHERE cal.user_id = p_user_id
          AND cal.created_at IS NOT NULL
          AND cal.created_at > NOW() - INTERVAL '180 days'
    ),
    content_creations AS (
        SELECT
            uc.id,
            'document'::TEXT AS activity_type,
            'content_created'::TEXT AS action,
            COALESCE(
                NULLIF(uc.title, ''),
                NULLIF(uc.name, ''),
                NULLIF(uc.original_filename, ''),
                'Контент'
            ) AS title,
            uc.created_at AS event_time
        FROM unified_content uc
        WHERE uc.user_id = p_user_id
          AND uc.created_at IS NOT NULL
          AND uc.created_at > NOW() - INTERVAL '180 days'
          AND NOT EXISTS (
              SELECT 1
              FROM content_audit_log cal
              WHERE cal.content_id = uc.id
                AND cal.user_id = p_user_id
                AND cal.action = 'created'
          )
    ),
    chat_events AS (
        SELECT
            cm.id,
            'chat'::TEXT AS activity_type,
            (CASE
                WHEN cm.role = 'user' THEN 'message_sent'
                WHEN cm.role = 'assistant' THEN 'response_received'
                ELSE 'chat_activity'
            END)::TEXT AS action,
            COALESCE(NULLIF(cs.title, ''), 'Чат') AS title,
            cm.created_at AS event_time
        FROM chat_messages cm
        INNER JOIN chat_sessions cs ON cs.id = cm.session_id
        WHERE cs.user_id = p_user_id
          AND cm.created_at IS NOT NULL
          AND cm.created_at > NOW() - INTERVAL '90 days'
    ),
    chat_sessions_events AS (
        SELECT
            cs.id,
            'chat'::TEXT AS activity_type,
            'chat_created'::TEXT AS action,
            COALESCE(NULLIF(cs.title, ''), 'Чат') AS title,
            cs.created_at AS event_time
        FROM chat_sessions cs
        WHERE cs.user_id = p_user_id
          AND cs.created_at IS NOT NULL
          AND cs.created_at > NOW() - INTERVAL '180 days'
    ),
    generation_events AS (
        SELECT
            ag.id,
            'ai_generation'::TEXT AS activity_type,
            (CASE
                WHEN ag.status = 'completed' THEN 'generation_completed'
                WHEN ag.status = 'failed' THEN 'generation_failed'
                WHEN ag.status = 'processing' THEN 'generation_processing'
                ELSE 'generation_started'
            END)::TEXT AS action,
            COALESCE(
                NULLIF(ag.type, ''),
                ag.model_name,
                'AI Generation'
            ) ||
            COALESCE(
                ' · ' || LEFT(REPLACE(REPLACE(ag.prompt, E'\r', ' '), E'\n', ' '), 60),
                ''
            ) AS title,
            COALESCE(ag.completed_at, ag.started_at, ag.created_at) AS event_time
        FROM ai_generations ag
        WHERE ag.user_id = p_user_id
          AND COALESCE(ag.completed_at, ag.started_at, ag.created_at) IS NOT NULL
          AND COALESCE(ag.completed_at, ag.started_at, ag.created_at) > NOW() - INTERVAL '180 days'
    ),
    manual_events AS (
        SELECT
            ual.id,
            'system'::TEXT AS activity_type,
            ual.action::TEXT,
            COALESCE(
                NULLIF(ual.description, ''),
                INITCAP(REPLACE(ual.action, '_', ' '))
            ) AS title,
            ual.created_at AS event_time
        FROM user_activity_log ual
        WHERE ual.user_id = p_user_id
          AND ual.created_at IS NOT NULL
          AND ual.created_at > NOW() - INTERVAL '180 days'
    ),
    combined AS (
        SELECT * FROM content_events
        UNION ALL
        SELECT * FROM content_creations
        UNION ALL
        SELECT * FROM chat_events
        UNION ALL
        SELECT * FROM chat_sessions_events
        UNION ALL
        SELECT * FROM generation_events
        UNION ALL
        SELECT * FROM manual_events
    )
    SELECT
        c.id,
        c.activity_type,
        c.action,
        c.title,
        c.event_time
    FROM combined c
    WHERE c.event_time IS NOT NULL
    ORDER BY c.event_time DESC
    LIMIT GREATEST(p_limit, 1);
END;
$function$;

COMMIT;
