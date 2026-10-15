-- Rollback for remaining_tables_user_id_to_uuid.sql
-- Reverts companies, emperyworld_chats / emperyworld_chat_folders, elite_documents, agent_configs columns back to varchar.
-- Apply only if you need to undo the migration.

BEGIN;

-- agent_configs: uuid -> varchar
ALTER TABLE agent_configs ALTER COLUMN created_by TYPE character varying USING created_by::text;
ALTER TABLE agent_configs ALTER COLUMN updated_by TYPE character varying USING updated_by::text;

-- elite_documents: drop dependent, alter, recreate
DROP VIEW IF EXISTS public.elite_documents_active CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.user_dashboard_stats_mv;

ALTER TABLE elite_documents ALTER COLUMN user_id TYPE character varying USING user_id::text;
ALTER TABLE elite_documents ALTER COLUMN updated_by TYPE character varying USING updated_by::text;

CREATE VIEW public.elite_documents_active AS
SELECT d.id, d.user_id, d.title, d.content, d.document_type, d.metadata, d.created_at, d.updated_at,
  d.tags, d.word_count, d.character_count, d.updated_by, d.revision_count, d.is_template, d.deleted_at, d.template_id,
  (SELECT count(*) FROM elite_document_revisions WHERE elite_document_revisions.document_id = d.id) AS total_revisions,
  (SELECT elite_document_revisions.created_at FROM elite_document_revisions WHERE elite_document_revisions.document_id = d.id ORDER BY elite_document_revisions.revision_number DESC LIMIT 1) AS last_revision_at
FROM elite_documents d WHERE d.deleted_at IS NULL;

CREATE MATERIALIZED VIEW public.user_dashboard_stats_mv AS
SELECT u.id AS user_id,
  COALESCE(ed.doc_count, 0::bigint) AS total_documents,
  COALESCE(cs.chat_count, 0::bigint) AS total_chats,
  COALESCE(p.pres_count, 0::bigint) AS total_presentations,
  COALESCE(uc.ai_count, 0::bigint) AS total_ai_generations,
  COALESCE(uc.storage_mb, 0.0) AS storage_used_mb,
  GREATEST(COALESCE(ed.last_doc::timestamp with time zone, '1970-01-01 00:00:00+00'::timestamp with time zone),
    COALESCE(cs.last_chat::timestamp with time zone, '1970-01-01 00:00:00+00'::timestamp with time zone),
    COALESCE(p.last_pres::timestamp with time zone, '1970-01-01 00:00:00+00'::timestamp with time zone),
    COALESCE(uc.last_uc, '1970-01-01 00:00:00+00'::timestamp with time zone)) AS last_activity,
  COALESCE(ed.recent_docs, 0::bigint) AS recent_documents,
  COALESCE(cs.recent_chats, 0::bigint) AS recent_chats,
  COALESCE(p.recent_pres, 0::bigint) AS recent_presentations,
  COALESCE(uc.recent_ai, 0::bigint) AS recent_ai_generations
FROM users u
LEFT JOIN (SELECT elite_documents.user_id::uuid AS user_id, count(*) AS doc_count, max(elite_documents.updated_at) AS last_doc,
    count(*) FILTER (WHERE elite_documents.created_at > (now() - '7 days'::interval)) AS recent_docs
  FROM elite_documents WHERE elite_documents.deleted_at IS NULL GROUP BY elite_documents.user_id) ed ON u.id = ed.user_id
LEFT JOIN (SELECT chat_sessions.user_id, count(*) AS chat_count, max(chat_sessions.updated_at) AS last_chat,
    count(*) FILTER (WHERE chat_sessions.created_at > (now() - '7 days'::interval)) AS recent_chats FROM chat_sessions GROUP BY chat_sessions.user_id) cs ON u.id = cs.user_id
LEFT JOIN (SELECT presentations.user_id, count(*) AS pres_count, max(presentations.updated_at) AS last_pres,
    count(*) FILTER (WHERE presentations.created_at > (now() - '7 days'::interval)) AS recent_pres FROM presentations GROUP BY presentations.user_id) p ON u.id = p.user_id
LEFT JOIN (SELECT unified_content.user_id, count(*) FILTER (WHERE unified_content.content_type::text = 'ai_result') AS ai_count,
    sum(unified_content.file_size) FILTER (WHERE unified_content.deleted_at IS NULL) / 1024.0 / 1024.0 AS storage_mb,
    max(unified_content.created_at) FILTER (WHERE unified_content.deleted_at IS NULL) AS last_uc,
    count(*) FILTER (WHERE unified_content.content_type::text = 'ai_result' AND unified_content.created_at > (now() - '7 days'::interval)) AS recent_ai
  FROM unified_content GROUP BY unified_content.user_id) uc ON u.id = uc.user_id;

CREATE UNIQUE INDEX idx_user_dashboard_stats_mv_user ON public.user_dashboard_stats_mv (user_id);

-- emperyworld_chats, emperyworld_chat_folders: drop FK, alter to varchar
ALTER TABLE emperyworld_chats DROP CONSTRAINT IF EXISTS emperyworld_chats_user_id_fkey;
ALTER TABLE emperyworld_chats ALTER COLUMN user_id TYPE character varying USING user_id::text;

ALTER TABLE emperyworld_chat_folders DROP CONSTRAINT IF EXISTS emperyworld_chat_folders_user_id_fkey;
ALTER TABLE emperyworld_chat_folders ALTER COLUMN user_id TYPE character varying USING user_id::text;

-- companies: drop FK, alter to varchar
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_user_id_fkey;
ALTER TABLE companies ALTER COLUMN user_id TYPE character varying USING user_id::text;

COMMIT;
