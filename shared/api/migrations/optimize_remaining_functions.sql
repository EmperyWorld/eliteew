-- Optimize remaining DB functions (single-pass updates, index-friendly queries).
-- Safe to run: only replaces function bodies and adds one index.

BEGIN;

-- 1) update_chat_session_stats: one UPDATE with a single subquery instead of 4 separate scans of chat_messages.
CREATE OR REPLACE FUNCTION public.update_chat_session_stats(session_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE chat_sessions cs
    SET
        message_count = agg.cnt,
        total_tokens  = agg.tokens,
        last_message_at = agg.last_ts,
        updated_at = NOW()
    FROM (
        SELECT
            COUNT(*)::integer AS cnt,
            COALESCE(SUM(cm.token_count), 0)::bigint AS tokens,
            MAX(cm.created_at) AS last_ts
        FROM chat_messages cm
        WHERE cm.session_id = session_uuid
    ) agg
    WHERE cs.id = session_uuid;
END;
$$;

-- 2) check_mutual_friendship(uuid, uuid): two EXISTS so both (user_id, friend_id) indexes can be used.
CREATE OR REPLACE FUNCTION public.check_mutual_friendship(user_id_1 uuid, user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id = user_id_1 AND f.friend_id = user_id_2
    ) OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id = user_id_2 AND f.friend_id = user_id_1
    );
$$;

-- 3) Index for trigger + get_user_activity_timeline: one scan per session for COUNT/SUM/MAX and for timeline by session.
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
ON public.chat_messages (session_id, created_at DESC);

COMMIT;
