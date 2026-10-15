-- Restore update_chat_session_stats(session_uuid) required by trigger_update_chat_stats on chat_messages.
-- Without it, INSERT/UPDATE/DELETE on chat_messages raise "function update_chat_session_stats(uuid) does not exist".
-- See docs/DATABASE_FUNCTIONS_AUDIT.md §2 and §19.

CREATE OR REPLACE FUNCTION public.update_chat_session_stats(session_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE chat_sessions
    SET
        message_count = (SELECT COUNT(*) FROM chat_messages WHERE session_id = session_uuid),
        total_tokens  = (SELECT COALESCE(SUM(token_count), 0) FROM chat_messages WHERE session_id = session_uuid),
        last_message_at = (SELECT MAX(created_at) FROM chat_messages WHERE session_id = session_uuid),
        updated_at = NOW()
    WHERE id = session_uuid;
END;
$$;
