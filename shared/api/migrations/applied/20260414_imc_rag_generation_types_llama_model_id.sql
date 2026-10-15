-- ИМК RAG: model_name для llama-server /v1/completions должен совпадать с id из GET /v1/models
-- (имена вида rscr/... от Ollama дают пустой choices[0].text и «Empty response» в ImcRagResearch).
-- apply_migrations.sh; при необходимости подставьте другой GGUF из вашего stack2-llama-chat.

BEGIN;

UPDATE generation_types
SET
    model_name = 'vikhr-nemo-12b-instruct-r-21-09-24-q4_k_m.gguf',
    updated_at = NOW()
WHERE provider = 'imc_rag_research_provider'
  AND TRIM(model_name) = 'rscr/vikhr_nemo_12b:Q4_K_M';

COMMIT;
