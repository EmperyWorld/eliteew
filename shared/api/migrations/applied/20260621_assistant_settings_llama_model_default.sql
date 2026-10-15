-- Set explicit llama_model for product assistant when row was left empty after ollama→llama rename.
-- Matches stack0 default chat model (gemma-4-26B.gguf) used when assistant_settings.llama_model is NULL.

UPDATE assistant_settings
SET
    llama_model = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE id = 1
  AND (llama_model IS NULL OR btrim(llama_model) = '');
