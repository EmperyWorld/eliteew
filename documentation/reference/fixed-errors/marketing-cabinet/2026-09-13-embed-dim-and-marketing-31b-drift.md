# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Registry: stack0 Phase 2 env vs gpu141 8B embed + stale marketing 31B model ids.
# ---

# Embed dim 1024 vs live 8B; marketing model ids still 31B

| Field | Value |
|-------|--------|
| **product_id** | `marketing-cabinet` |
| **status** | `fixed` |
| **date** | `2026-09-13` |
| **also_affects** | chat memory, stack0 LLM, gpu141 remote embed |
| **canon** | `documentation/platform/STACK2-LLM-CONTRACT.md`, `documentation/product/marketing/MARKETING-PROJECT-RAG.md` |
| **commit** | — |

## Symptom

API WARN `Chat memory: invalid embedding shape expected_dim=1024 got=4096` → marketing RAG `embedding unavailable` / `upserted_points=0`. AMKA WARN `model 'gemma-4-31B-it-Q4_K_M.gguf' not listed` while `stack2-llama-chat` only serves `/models/gemma-4-26B.gguf`.

## Failure layers

1. **Runtime SoT (gpu141)** — `llama-remote-embed` still `-m Qwen3-Embedding-8B-Q4_K_M.gguf` (4096) while stack0 already Phase 2 `AI_EMBEDDINGS_DIMENSION=1024` + `LLAMA_EMBEDDING_MODEL=…0.6B…`.
2. **Config Plane keys** — `LLAMA_MODEL_MARKETING`, `MARKETING_CABINET_ROUTER_MODEL`, `LLAMA_MODEL_BI`, `ELITEEW_BEZ_PLANNER_MODEL` left on dense 31B after MoE 26B chat cutover.
3. **Ops privilege** — rootful `gpu141-llama-remote.service` recreate needs sudo; env/GGUF can be staged as `owned` without applying.

## Root cause

Phase 2 was applied in stack0 env, but gpu141 compose env was not restarted onto 0.6B GGUF, and marketing/BI/planner model ids were not aligned to the live chat model id.

## What we did

- Staged on gpu141: rsynced `Qwen3-Embedding-0.6B-Q8_0.gguf` + `qwen3-reranker-0.6b-q8_0.gguf`; wrote `/home/owned/llama-remote/.env.llama-remote` Phase 2; operator `sudo systemctl restart gpu141-llama-remote.service` → live 0.6B@1024.
- Patched `.env.stack0.backend` / `.env.stack0.shared` (+ examples): marketing/BI/planner → `gemma-4-26B.gguf`.
- Rebuilt SOPS bundle, `eliteew-prod-core-env-push.sh --yes`, force-recreated baked API/workers/celery on `.111`.
- UGS `model_routes` / provider default_model → `gemma-4-26B.gguf` where previously 31B.
- Doc-sync: MARKETING-PROJECT-RAG Phase 2 note; solution-readiness `2026-09-13-embed-dim-and-marketing-model-align.md`.

## Recommendations

- After any Phase 2 / model cutover: verify **gpu141** `/v1/models` + embed vector length against `AI_EMBEDDINGS_DIMENSION` before calling Done.
- Never “fix” shape WARN by raising `AI_EMBEDDINGS_DIMENSION` to match a stale 8B without full Qdrant reindex + canon change.
- Keep marketing/BI/planner ids in lockstep with `LLAMA_MODEL` / live `stack2-llama-chat` unless they intentionally route to `LLAMA_DEEP_URL`.

## Verification

- [x] API printenv: marketing/BI/planner = `gemma-4-26B.gguf`, dim=1024
- [x] gpu141 embed `/v1/models` = `Qwen3-Embedding-0.6B-Q8_0.gguf`; POST embeddings length **1024**
- [x] rerank `/v1/models` = `qwen3-reranker-0.6b-q8_0.gguf`; LAN health from `.111` OK
- [x] API-container `_get_embedding` → `expected=1024 got=1024`
- [x] Qdrant `marketing_project_rag` vectors.size already **1024** (no collection recreate)
