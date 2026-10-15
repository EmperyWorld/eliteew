-- Справочник KB: метаданные источника при загрузке файла (имя и MIME)

ALTER TABLE assistant_kb_documents
	ADD COLUMN IF NOT EXISTS source_filename TEXT NULL,
	ADD COLUMN IF NOT EXISTS source_mime TEXT NULL;
