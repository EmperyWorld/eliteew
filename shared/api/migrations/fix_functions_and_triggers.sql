-- Fix DB functions/triggers: UUID compatibility, missing compute_json_diff, optional app.current_user_id.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/fix_functions_and_triggers.sql

BEGIN;

-- 1. create_unified_content_version: unified_content.updated_by and user_id are UUID; cannot use NULLIF(col, '')
CREATE OR REPLACE FUNCTION public.create_unified_content_version()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_changed_by VARCHAR(255);
  v_snapshot_version INTEGER;
  v_next_current_version INTEGER;
BEGIN
  IF (OLD.extracted_text IS DISTINCT FROM NEW.extracted_text) OR
     (OLD.name IS DISTINCT FROM NEW.name) THEN

    -- updated_by and user_id are UUID; use ::text for changed_by (varchar)
    v_changed_by := COALESCE(NEW.updated_by::text, NEW.user_id::text, OLD.updated_by::text, OLD.user_id::text);

    SELECT COALESCE(MAX(version), 0) + 1
    INTO v_snapshot_version
    FROM content_versions
    WHERE content_id = OLD.id;

    INSERT INTO content_versions (
      content_id, version, file_data, file_size, file_hash, metadata,
      changes_description, changed_by, change_type, title, content, word_count, character_count, created_at
    ) VALUES (
      OLD.id, v_snapshot_version, OLD.file_data, OLD.file_size, OLD.file_hash, OLD.metadata,
      'Auto-save', COALESCE(v_changed_by, OLD.user_id::text), 'update',
      OLD.name, OLD.extracted_text, OLD.word_count, OLD.character_count, NOW()
    );

    v_next_current_version := GREATEST(COALESCE(OLD.version, 0), v_snapshot_version) + 1;
    NEW.version := v_next_current_version;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. get_user_storage_used: unified_content.user_id is UUID; compare uuid to uuid
CREATE OR REPLACE FUNCTION public.get_user_storage_used(p_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    total_size BIGINT;
BEGIN
    SELECT COALESCE(SUM(file_size), 0)
    INTO total_size
    FROM unified_content
    WHERE user_id = p_user_id
      AND deleted_at IS NULL;

    RETURN total_size;
END;
$function$;

-- 3. audit_trigger_func: compute_json_diff was dropped; store NULL for changes until restored
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_action VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    BEGIN
        v_user_id := current_setting('app.current_user_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN COALESCE(NEW, OLD);
    END;

    BEGIN
        v_company_id := current_setting('app.current_company_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_company_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_new_values := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_old_values := to_jsonb(OLD);
    END IF;

    INSERT INTO audit_logs (
        company_id, user_id, action, resource_type, resource_id,
        old_values, new_values, changes, metadata
    ) VALUES (
        v_company_id, v_user_id, v_action, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
        v_old_values, v_new_values,
        NULL,
        jsonb_build_object('trigger', TG_NAME, 'table', TG_TABLE_NAME)
    );

    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4. create_ultimate_doc_version: app.current_user_id may be unset; use NULL for created_by then
CREATE OR REPLACE FUNCTION public.create_ultimate_doc_version()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_created_by UUID;
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
        BEGIN
            v_created_by := NULLIF(trim(current_setting('app.current_user_id', true)), '')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_created_by := NULL;
        END;

        INSERT INTO ultimate_document_versions (
            document_id, version_number, title, content, content_type, metadata,
            created_by, word_count, character_count
        ) VALUES (
            NEW.id, NEW.version_number, NEW.title, NEW.content, NEW.content_type, NEW.metadata,
            v_created_by, NEW.word_count, NEW.character_count
        );

        NEW.version_number = OLD.version_number + 1;
    END IF;

    RETURN NEW;
END;
$function$;

COMMIT;
