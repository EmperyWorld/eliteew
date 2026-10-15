-- EWA companion / Runtime Gateway: full-text indexes for first-class content-body search.
CREATE INDEX IF NOT EXISTS idx_unified_content_ewa_body_search_simple
    ON unified_content
    USING GIN (to_tsvector('simple', COALESCE(extracted_text, '')))
    WHERE deleted_at IS NULL AND COALESCE(extracted_text, '') <> '';

CREATE INDEX IF NOT EXISTS idx_unified_content_ewa_metadata_search_simple
    ON unified_content
    USING GIN (
        to_tsvector(
            'simple',
            COALESCE(name, '') || ' ' ||
            COALESCE(title, '') || ' ' ||
            COALESCE(description, '') || ' ' ||
            COALESCE(original_filename, '') || ' ' ||
            COALESCE(array_to_string(tags, ' '), '')
        )
    )
    WHERE deleted_at IS NULL;
