-- Rename legacy chat/search-related PostgreSQL identifiers to Empery World naming.
--
-- Elasticsearch (separate from Postgres): before or after this migration, reindex documents index:
--   Source index: brotherhood_documents
--   Target index: emperyworld_documents (must match shared/api/core/elasticsearch_indices.py)
-- Use _reindex API or operator runbook: documentation/platform/docker-re_doc/ELASTICSEARCH-INDICES.md
--
-- Apply via api/migrations/apply_migrations.sh (or psql with ON_ERROR_STOP).

BEGIN;

-- 1) Tables (idempotent: skip errors if already renamed — operator may re-run after partial apply)
DO $rename$
BEGIN
  IF to_regclass('public.brotherhood_messages') IS NOT NULL
     AND to_regclass('public.emperyworld_messages') IS NULL THEN
    ALTER TABLE public.brotherhood_messages RENAME TO emperyworld_messages;
  END IF;

  IF to_regclass('public.brotherhood_chats') IS NOT NULL
     AND to_regclass('public.emperyworld_chats') IS NULL THEN
    ALTER TABLE public.brotherhood_chats RENAME TO emperyworld_chats;
  END IF;

  IF to_regclass('public.brotherhood_chat_folders') IS NOT NULL
     AND to_regclass('public.emperyworld_chat_folders') IS NULL THEN
    ALTER TABLE public.brotherhood_chat_folders RENAME TO emperyworld_chat_folders;
  END IF;
END;
$rename$;

-- 2) Typical SERIAL sequences (rename if present)
DO $seq$
BEGIN
  IF to_regclass('public.brotherhood_chats_id_seq') IS NOT NULL THEN
    ALTER SEQUENCE public.brotherhood_chats_id_seq RENAME TO emperyworld_chats_id_seq;
  END IF;
  IF to_regclass('public.brotherhood_messages_id_seq') IS NOT NULL THEN
    ALTER SEQUENCE public.brotherhood_messages_id_seq RENAME TO emperyworld_messages_id_seq;
  END IF;
  IF to_regclass('public.brotherhood_chat_folders_id_seq') IS NOT NULL THEN
    ALTER SEQUENCE public.brotherhood_chat_folders_id_seq RENAME TO emperyworld_chat_folders_id_seq;
  END IF;
END;
$seq$;

-- 3) Primary keys / common FK constraint names (best-effort)
DO $con$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brotherhood_chats_pkey') THEN
    ALTER TABLE public.emperyworld_chats RENAME CONSTRAINT brotherhood_chats_pkey TO emperyworld_chats_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brotherhood_messages_pkey') THEN
    ALTER TABLE public.emperyworld_messages RENAME CONSTRAINT brotherhood_messages_pkey TO emperyworld_messages_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brotherhood_chat_folders_pkey') THEN
    ALTER TABLE public.emperyworld_chat_folders
      RENAME CONSTRAINT brotherhood_chat_folders_pkey TO emperyworld_chat_folders_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brotherhood_chats_user_id_fkey') THEN
    ALTER TABLE public.emperyworld_chats
      RENAME CONSTRAINT brotherhood_chats_user_id_fkey TO emperyworld_chats_user_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brotherhood_chat_folders_user_id_fkey') THEN
    ALTER TABLE public.emperyworld_chat_folders
      RENAME CONSTRAINT brotherhood_chat_folders_user_id_fkey TO emperyworld_chat_folders_user_id_fkey;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END;
$con$;

-- 4) updated_at triggers (names only; function may still have legacy name)
DO $trg$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_brotherhood_chats_updated')
     AND to_regclass('public.emperyworld_chats') IS NOT NULL THEN
    EXECUTE 'ALTER TRIGGER update_brotherhood_chats_updated ON public.emperyworld_chats ' ||
            'RENAME TO update_emperyworld_chats_updated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_brotherhood_messages_updated')
     AND to_regclass('public.emperyworld_messages') IS NOT NULL THEN
    EXECUTE 'ALTER TRIGGER update_brotherhood_messages_updated ON public.emperyworld_messages ' ||
            'RENAME TO update_emperyworld_messages_updated';
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END;
$trg$;

COMMIT;
