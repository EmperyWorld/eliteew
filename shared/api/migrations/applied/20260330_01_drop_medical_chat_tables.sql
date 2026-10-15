-- Remove Medical Chat / medical history tables (product removed).
-- Order: children first (FK).

DROP TABLE IF EXISTS medical_chat_messages CASCADE;
DROP TABLE IF EXISTS medical_chat_sessions CASCADE;
DROP TABLE IF EXISTS medical_documents CASCADE;
DROP TABLE IF EXISTS medical_events CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
