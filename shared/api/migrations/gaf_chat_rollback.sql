-- GAF Chat rollback. Run only with DB backup. Order: drop dependent tables first.
--   docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/gaf_chat_rollback.sql

DROP TABLE IF EXISTS gaf_message_keys;
DROP TABLE IF EXISTS gaf_user_public_keys;
DROP TABLE IF EXISTS gaf_messages;
DROP TABLE IF EXISTS gaf_chats;
