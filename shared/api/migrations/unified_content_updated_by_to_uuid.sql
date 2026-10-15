-- Unify unified_content.updated_by to UUID (references users.id).
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/unified_content_updated_by_to_uuid.sql

BEGIN;

-- Drop views that depend on unified_content (they reference updated_by)
DROP VIEW IF EXISTS public.content_with_classification CASCADE;
DROP VIEW IF EXISTS public.medical_documents_unified CASCADE;
DROP VIEW IF EXISTS public.v_editable_documents CASCADE;
DROP VIEW IF EXISTS public.v_format_statistics CASCADE;
DROP VIEW IF EXISTS public.v_conversion_success_rate CASCADE;
DROP VIEW IF EXISTS public.v_recent_conversions CASCADE;
DROP VIEW IF EXISTS public.v_user_document_summary CASCADE;

-- Normalize: empty or invalid uuid string -> NULL
UPDATE unified_content
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND (trim(updated_by) = '' OR updated_by::text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

-- Alter column type
ALTER TABLE unified_content
  ALTER COLUMN updated_by TYPE uuid USING updated_by::uuid;

-- Recreate views (from unify_user_id_to_uuid_phase1.sql structure)
CREATE VIEW public.content_with_classification AS
 SELECT uc.id, uc.user_id, uc.content_type, uc.mime_type, uc.sub_type, uc.name, uc.description,
    uc.tags, uc.storage_backend, uc.file_path, uc.file_data, uc.file_size, uc.file_hash,
    uc.original_filename, uc.extracted_text, uc.thumbnail_path, uc.version, uc.parent_id,
    uc.is_latest_version, uc.source_service, uc.source_id, uc.related_content, uc.visibility,
    uc.shared_with_user_ids, uc.processing_status, uc.processing_error, uc.processed_at,
    uc.metadata, uc.created_at, uc.updated_at, uc.updated_by, uc.deleted_at, uc.title,
    uc.word_count, uc.character_count, uc.access_level, uc.is_public, uc.last_accessed_at,
    uc.search_vector, uc.company_id, uc.project_id, uc.friend_visibility,
    c.name AS company_name, c.slug AS company_slug, p.name AS project_name, p.slug AS project_slug,
    CASE WHEN uc.friend_visibility = true AND uc.visibility::text = 'shared' THEN 'shared_with_friends'::character varying ELSE uc.visibility END AS effective_visibility
 FROM unified_content uc
 LEFT JOIN companies c ON uc.company_id = c.id
 LEFT JOIN projects p ON uc.project_id = p.id
 WHERE uc.deleted_at IS NULL;

CREATE VIEW public.medical_documents_unified AS
 SELECT uc.id, (uc.metadata ->> 'event_id')::uuid AS event_id, uc.name AS filename,
    CASE uc.mime_type
      WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png'
      WHEN 'application/dicom' THEN 'dicom' WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'docx'
      WHEN 'application/msword' THEN 'doc' WHEN 'text/plain' THEN 'txt' ELSE 'other' END AS file_type,
    uc.file_path, uc.file_size, uc.description, uc.metadata, uc.created_at AS uploaded_at,
    uc.user_id, uc.metadata ->> 'patient_name' AS patient_name, uc.metadata ->> 'event_type' AS event_type,
    (uc.metadata ->> 'event_date')::timestamp with time zone AS event_date
 FROM unified_content uc
 WHERE uc.source_service::text = 'medical_chat' AND uc.sub_type::text = 'medical';

CREATE VIEW public.v_editable_documents AS
 SELECT uc.id, uc.user_id, uc.name, uc.title, uc.original_format, uc.mime_type, uc.file_size,
    uc.word_count, uc.character_count, uc.viewer_type, uc.version, uc.created_at, uc.updated_at,
    sf.format_name, sf.category, sf.icon_name
 FROM unified_content uc
 LEFT JOIN supported_formats sf ON uc.original_format::text = sf.format_name::text
 WHERE uc.is_editable = true AND uc.deleted_at IS NULL
 ORDER BY uc.updated_at DESC;

CREATE VIEW public.v_format_statistics AS
 SELECT uc.original_format, sf.category, sf.format_name, sf.mime_type, count(*) AS document_count,
    count(DISTINCT uc.user_id) AS unique_users, sum(uc.file_size)::bigint AS total_size_bytes,
    round(avg(uc.file_size), 2) AS avg_size_bytes, max(uc.file_size) AS max_size_bytes,
    min(uc.created_at) AS first_upload, max(uc.created_at) AS latest_upload,
    count(*) FILTER (WHERE uc.is_editable = true) AS editable_count,
    count(*) FILTER (WHERE uc.converted_formats <> '{}'::jsonb) AS with_conversions_count
 FROM unified_content uc
 LEFT JOIN supported_formats sf ON uc.original_format::text = sf.format_name::text
 WHERE uc.deleted_at IS NULL AND uc.original_format IS NOT NULL
 GROUP BY uc.original_format, sf.category, sf.format_name, sf.mime_type;

CREATE VIEW public.v_conversion_success_rate AS
 SELECT dc.target_format, sf_source.format_name AS source_format, sf_target.format_name AS target_format_name,
    count(*) AS total_conversions,
    count(*) FILTER (WHERE dc.conversion_status::text = 'completed') AS successful_conversions,
    count(*) FILTER (WHERE dc.conversion_status::text = 'failed') AS failed_conversions,
    count(*) FILTER (WHERE dc.conversion_status::text = 'pending') AS pending_conversions,
    count(*) FILTER (WHERE dc.conversion_status::text = 'processing') AS processing_conversions,
    round(100.0 * count(*) FILTER (WHERE dc.conversion_status::text = 'completed')::numeric / NULLIF(count(*), 0)::numeric, 2) AS success_rate_percent,
    round(avg(dc.conversion_duration_ms) FILTER (WHERE dc.conversion_status::text = 'completed'), 0) AS avg_duration_ms,
    round(avg(dc.quality_score) FILTER (WHERE dc.quality_score IS NOT NULL), 2) AS avg_quality_score,
    min(dc.created_at) AS first_conversion, max(dc.created_at) AS latest_conversion
 FROM document_conversions dc
 LEFT JOIN unified_content uc ON dc.source_content_id = uc.id
 LEFT JOIN supported_formats sf_source ON uc.original_format::text = sf_source.format_name::text
 LEFT JOIN supported_formats sf_target ON dc.target_format::text = sf_target.format_name::text
 GROUP BY dc.target_format, sf_source.format_name, sf_target.format_name
 HAVING count(*) > 0
 ORDER BY count(*) DESC, round(100.0 * count(*) FILTER (WHERE dc.conversion_status::text = 'completed')::numeric / NULLIF(count(*), 0)::numeric, 2) DESC;

CREATE VIEW public.v_recent_conversions AS
 SELECT dc.id, dc.source_content_id, uc.name AS source_name, uc.original_format AS source_format,
    dc.target_format, dc.conversion_status, dc.conversion_duration_ms, dc.source_file_size,
    dc.target_file_size, dc.quality_score, dc.converter_engine, dc.created_at, dc.completed_at,
    u.username AS requested_by_username
 FROM document_conversions dc
 LEFT JOIN unified_content uc ON dc.source_content_id = uc.id
 LEFT JOIN users u ON dc.requested_by = u.id
 ORDER BY dc.created_at DESC
 LIMIT 100;

CREATE VIEW public.v_user_document_summary AS
 SELECT u.id AS user_id, u.username, count(DISTINCT uc.id) AS total_documents,
    count(DISTINCT uc.original_format) AS unique_formats, sum(uc.file_size)::bigint AS total_storage_bytes,
    count(*) FILTER (WHERE uc.is_editable = true) AS editable_documents,
    count(*) FILTER (WHERE uc.converted_formats <> '{}'::jsonb) AS documents_with_conversions,
    count(DISTINCT dc.id) AS total_conversions_requested, max(uc.created_at) AS latest_document_upload,
    max(dc.created_at) AS latest_conversion_request
 FROM users u
 LEFT JOIN unified_content uc ON u.id = uc.user_id AND uc.deleted_at IS NULL
 LEFT JOIN document_conversions dc ON u.id = dc.requested_by
 GROUP BY u.id, u.username
 HAVING count(DISTINCT uc.id) > 0
 ORDER BY count(DISTINCT uc.id) DESC;

COMMIT;
