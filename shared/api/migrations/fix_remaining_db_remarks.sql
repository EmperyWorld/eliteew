-- Fix all remaining DB remarks: check_mutual_friendship, get_user_dashboard_stats, increment_tag_usage, compute_json_diff.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/fix_remaining_db_remarks.sql

BEGIN;

-- 1. check_mutual_friendship(uuid, uuid): direct UUID comparison (friendships.user_id/friend_id are uuid)
CREATE OR REPLACE FUNCTION public.check_mutual_friendship(user_id_1 uuid, user_id_2 uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id = user_id_1 AND f.friend_id = user_id_2
    ) OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id = user_id_2 AND f.friend_id = user_id_1
    );
$function$;

-- 2. Drop varchar overload of get_user_dashboard_stats; callers can pass uuid or cast in app
DROP FUNCTION IF EXISTS public.get_user_dashboard_stats(character varying);

-- 3. Add increment_tag_usage(uuid, varchar) overload; content_tags.user_id is uuid
CREATE OR REPLACE FUNCTION public.increment_tag_usage(p_user_id uuid, p_tag character varying)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO content_tags (user_id, tag, usage_count, last_used_at)
  VALUES (p_user_id, LOWER(p_tag), 1, NOW())
  ON CONFLICT (user_id, tag) DO UPDATE
    SET usage_count = content_tags.usage_count + 1,
        last_used_at = NOW();
END;
$function$;

-- 4. Restore compute_json_diff for audit_logs.changes (key-level diff: changed keys with old/new values)
CREATE OR REPLACE FUNCTION public.compute_json_diff(v_old jsonb, v_new jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  k text;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF v_old IS NULL AND v_new IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_old IS NULL THEN
    RETURN v_new;
  END IF;
  IF v_new IS NULL THEN
    RETURN v_old;
  END IF;

  FOR k IN SELECT jsonb_object_keys(v_new)
  LOOP
    IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
      v_result := v_result || jsonb_build_object(
        k,
        jsonb_build_object('old', v_old -> k, 'new', v_new -> k)
      );
    END IF;
  END LOOP;

  FOR k IN SELECT jsonb_object_keys(v_old)
  LOOP
    IF v_new ? k THEN
      NULL; -- already handled
    ELSIF (v_old -> k) IS NOT NULL THEN
      v_result := v_result || jsonb_build_object(
        k,
        jsonb_build_object('old', v_old -> k, 'new', NULL)
      );
    END IF;
  END LOOP;

  IF v_result = '{}'::jsonb THEN
    RETURN NULL;
  END IF;
  RETURN v_result;
END;
$function$;

-- 5. audit_trigger_func: use compute_json_diff again for changes on UPDATE
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
        CASE WHEN v_action = 'UPDATE' THEN compute_json_diff(v_old_values, v_new_values) ELSE NULL END,
        jsonb_build_object('trigger', TG_NAME, 'table', TG_TABLE_NAME)
    );

    RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMIT;
