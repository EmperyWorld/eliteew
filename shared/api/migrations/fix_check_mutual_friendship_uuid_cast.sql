-- Fix: ensure check_mutual_friendship never triggers "uuid = character varying"
-- In DB there are two overloads: (varchar, text) and (uuid, uuid). When API passes
-- $1::uuid, the driver may bind $1 as varchar and the (varchar, text) overload can
-- be chosen; inner logic must not compare uuid to varchar. Compare as text inside
-- the (uuid, uuid) version so it's safe regardless of caller context.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/fix_check_mutual_friendship_uuid_cast.sql

BEGIN;

-- (uuid, uuid): compare as text to avoid any uuid=varchar
CREATE OR REPLACE FUNCTION public.check_mutual_friendship(user_id_1 uuid, user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id::text = user_id_1::text AND f.friend_id::text = user_id_2::text
    ) OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id::text = user_id_2::text AND f.friend_id::text = user_id_1::text
    );
$$;

-- (varchar, text) overload: keep but ensure inner call never causes uuid=varchar
CREATE OR REPLACE FUNCTION public.check_mutual_friendship(user_id_1 character varying, user_id_2 text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT check_mutual_friendship(user_id_1::uuid, user_id_2::uuid);
$$;

COMMIT;
