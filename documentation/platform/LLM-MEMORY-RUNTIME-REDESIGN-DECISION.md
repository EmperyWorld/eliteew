# LLM + Memory / RAG runtime redesign — decision memo

**Status:** approved target (operator 2026-09-04) — Phases 1–2 live; Phase 4 `llama-deep` live on `.136:8080`. Comfy moved to `.141:31003` on 2026-09-26, superseding the live `.136` mutex while preserving it as rollback history.
**Edition:** cloud · **Pack:** shared-only (API / stack2 / gpu141 / Qdrant).
**Surfaces in scope:** Desktop AI Chat (Ассистент) **and** EWA companion — both.
**Living runtime SoT:** [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md), [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current, [docker-re_doc/STACK0-LLM-OVERVIEW.md](docker-re_doc/STACK0-LLM-OVERVIEW.md), [docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md](docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md).

Treat **this file** as the SoT for *intent / phased redesign*. After each phase that changes live topology/env/models, update STACK2 / topology §Current / master card in the **same phase** — do not leave this memo as a second false “current”.

---

## 1. Goals (locked)

| Priority | Goal |
|----------|------|
| 1 | **Faster interactive UX** — unload queue; at least **2 concurrent** chat streams |
| 2 | **Productive memory** — RAG / episodic / cells that improve answers, not dump noise into a giant window |
| 3 | **Both products** — Desktop Ассистент + EWA companion share the same runtime planes |
| 4 | Freedom to change models, `-c`, parallel, embed/rerank, turn workflow, GPU placement |

**Non-goals for v1 cutover:** replace llama.cpp with vLLM/sglang; resurrect Chroma as primary; keep 8B embed/rerank as baseline; keep default `-c 200000` on interactive chat.

---

## 2. Diagnosis (why current setup fails the goals)

Snapshot at decision time (2026-09-04):

- **prod-core `.111`:** dual-GPU test — RTX **3090 + 5060 Ti**, `gemma-4-31B-it-Q4_K_M`, **`-c 200000`**, **`--parallel 1`**, f16 KV.
- **gpu141 `.141`:** **powered off**; card moved to prod. Remote embed/rerank/tool-router (`:8081/:8082/:8083`) unavailable.
- **command-center `.136`:** RTX **3090** + ComfyUI `:31003`.
- API gate **`LLAMA_CHAT_PARALLEL=1`** / `stack2_text_llm_slot` serializes almost all text-LLM traffic.
- Memory systems exist (HCM episodic, Memory Cells, `chat_history`, attach RAG) but sit next to a **huge reserved KV** — interactive TTFT suffers; inject budgets are generous relative to useful recall.
- Embed/rerank baseline class (**Qwen3 Embedding/Reranker 8B**) is VRAM-heavy for mediocre product recall.

Root cause (one sentence): **large context + single slot + oversized memory-plane models** were used as a substitute for **tight retrieval + short multi-step turns**.

Habr thread context (Shannon / comments, Apr–May 2026): large `-c` makes PP uncomfortable past ~120k; `--parallel N` multiplies KV; dual-GPU in llama.cpp is mostly layer split not TP; UD quants are contested — **A/B on our RU+tools**, do not copy blindly. Useful: smaller interactive ctx, parallel with KV budget, optional MTP later, MoE for speed vs dense for deep.

---

## 3. Hardware inventory (available)

| Asset | Notes |
|-------|--------|
| RTX **3090** 24GB × **2** | one was on `.111`, one on `.136` (Comfy) |
| RTX **5060 Ti** 16GB × **1** | was on `.141`, temporarily on `.111` for 31B test |
| Hosts | `.111` prod-core · `.136` command-center · `.141` gpu141 |

**Historical operator lock (2026-09-04):** ComfyUI and `eliteew-llama-deep` could not run concurrently on the `.136` 3090. **Superseded 2026-09-26:** living ComfyUI moved to gpu141 `.141:31003`; `llama-deep` remains on `.136:8080`, so the living paths no longer share a GPU. The `.136` mutex remains relevant only when explicitly restoring the historical Comfy launcher.

---

## 4. Target topology (approved)

Three planes — do **not** collapse chat + embed onto one busy GPU.

| Host | GPU | Plane | Workload |
|------|-----|-------|----------|
| **`.111` prod-core** | **1× 3090** | **Interactive chat** | Desktop + EWA **text** answers; hot path next to stack0 API |
| **`.141` gpu141** | **1× 5060 Ti** | **Memory / tools** | Embed + (optional) rerank + tool-router FC |
| **`.136` command-center** | **1× 3090** | **Deep / long** | Heavy research, long synthesize, dense 31B jobs; Comfy **stopped** during redesign |

**Physical move at Phase 0:**

1. Remove **5060 Ti** from `.111` → install on **`.141`**, power on `.141`, restore remote stack (`stack2-llama-remote-embed-rerank.host-net.yml` / `gpu141-llama-remote.service`).
2. Leave **one 3090** on `.111` for interactive only.
3. Keep **second 3090** on `.136` for deep LLM; **stop Comfy** for the duration of the redesign work as needed.

**Rejected for interactive default:** dual-GPU + `-c 200000` + `--parallel 1` on prod-core.

---

## 5. Target models (working package v1)

### 5.1 Interactive (`.111`)

| Setting | Target |
|---------|--------|
| Model class | **MoE locked:** `gemma-4-26B.gguf` (operator 2026-09-04). Alt A/B `Qwen3.6-35B-A3B` deferred |
| Quant | Current file on disk (MoE 26B); UD A/B not required for Phase 1 cutover |
| `-c` | **81920** total → **~40960 per slot** with `--parallel 2` |
| `--parallel` | **2** |
| KV | **`q8_0`** |
| Stack0 | `LLAMA_CHAT_PARALLEL=2` |
| Dense 31B | Rollback/deep preset only — not interactive default |

### 5.2 Memory plane (`.141`)

| Role | Target class | Notes |
|------|--------------|-------|
| Embed | **Small** multilingual (~0.1–0.6B), dim **384–1024** | Drop 8B embed baseline; **one** Qdrant reindex wave per dim change |
| Rerank | Mini cross-encoder **or off** at start | Empty `RAG_RERANK_BASE_URL` already supported (keep Qdrant order) |
| Tool-router | Keep **Qwen3-4B FC** class | Must not share interactive chat slot |

### 5.3 Deep (`.136`)

| Setting | Target |
|---------|--------|
| Model | Current test **`gemma-4-31B-it-Q4_K_M`** (or stronger later) |
| `-c` | **64k…96k**, `--parallel 1` |
| Routing | Separate base URL / job class from interactive (explicit router — no silent steal of `.111` slots) |

Optional later: MTP for Gemma4/Qwen when `server-cuda` image supports it stably — gen speed only; does not replace retrieval redesign.

---

## 6. Turn / memory workflow (approved direction)

**Principle:** window size = **latency budget**. Archive = **Postgres + Qdrant**. Multi-step short actions compose into one user-visible result.

### 6.1 Canonical turn (Desktop + companion)

```text
1. Route      — tool-router / heuristic          (.141 small FC)
2. Retrieve   — embed → Qdrant → optional rerank (.141; top_k 4…12)
3. Act*       — tools / ensemble probes / DB     (0..N short steps; compress evidence)
4. Answer     — interactive LLM                  (.111; total ctx ≤ 32–48k)
5. Deep?      — optional synthesize / research     (.136; only if Answer/router requested)
6. Persist    — episodic / cells / chat_history  (async; not on critical TTFT path)
```

Reuse existing building blocks where possible: companion tool-router, HCM episodic writer/retrieval, chat condense, Desktop ensemble mid-turn actions, Memory Cells — **make short-hop the default**, not an optional side path beside a 200k dump.

### 6.2 Inject budgets (target caps — tune in Phase 3)

| Block | Budget into LLM (chars, order of magnitude) |
|-------|-----------------------------------------------|
| Identity / story | ~2–4k |
| Episodic recall | top‑k **6–8**, ~2–6k |
| Chat RAG / cells / attach | ~4–8k |
| Live session tail | remainder under **~24–40k tokens** total prompt |
| Everything else | stay in store; next retrieve — **not** larger `-c` |

Companion default inject (**8k** chars, env-overridable) and Desktop RAG char caps (**8k** / top_k **8**) were **tightened** in Phase 3 — Measure/Lock after Cause.

### 6.3 Product rules

- Fake success on empty RAG / dead `.141` — **forbidden** (honest degrade).
- Parallel chats may use different Memory Cells; one cell per chat — unchanged product rule.
- Episodic Qdrant collections remain **dim-suffixed** (`ewa_companion_episodic_v1_d{dim}`) so model/dim swaps do not mix vectors.

---

## 7. Implementation phases

Do not skip Phase 0 before claiming “faster chat”. Soft-stop / start any stack as needed — operator confirmed long redesign window, no end-user traffic expected.

### Phase 0 — Hardware + restore memory plane

- [x] Physically move **5060 Ti** → `.141`; power on; NVIDIA/CDI OK
- [x] Leave **3090** on `.111`; stop dual-GPU chat profile that assumes 5060 on prod
- [x] On `.136`: **`podman stop`** Comfy when deep Phase 4 needs the 3090 (`eliteew-llama-deep.sh stop-comfy`; live while deep up)
- [x] Bring up embed/rerank/tool-router on `.141` (still **8B** until Phase 2)
- [x] Smoke: `.111` chat health; `.141` `:8081/:8082/:8083`; stack0 → LAN embed OK
- [x] Doc: STACK2 + topology §Current + master card updated for Phase 1 interactive cutover

### Phase 1 — Interactive capacity

- [x] MoE chat on `.111` 3090: `gemma-4-26B.gguf`, **`-c 81920` / `--parallel 2`** → **`n_ctx_slot=40960`**, KV **`q8_0`**
- [x] `LLAMA_CHAT_PARALLEL=2` in stack2 + stack0 env (API `stack2_text_llm_slot`)
- [x] Dense 31B removed from interactive default (rollback preset `31b` retained for deep)
- [x] Proof: **two concurrent** `/v1/chat/completions` both `OK` (2026-09-04); VRAM ~15.7 GiB / 24 GiB on 3090

### Phase 2 — Embed / rerank class change

- [x] Pick small embed + dim: **`Qwen3-Embedding-0.6B-Q8_0.gguf`** → **`AI_EMBEDDINGS_DIMENSION=1024`**; mini rerank **`qwen3-reranker-0.6b-q8_0.gguf`**
- [x] GGUF rsync to `.141:/home/owned/models/llama/`; `.env.llama-remote` patched; **rootful** `systemctl restart gpu141-llama-remote.service` (operator)
- [x] Smoke: embed `/v1/models` = 0.6B; `POST /v1/embeddings` length **1024**; VRAM ~5.5 GiB / 16 GiB; stack0 API `AI_EMBEDDINGS_DIMENSION=1024`
- [x] Qdrant fixed-name collections recreated at **1024** (empty cutover); companion `ewa_companion_episodic_v1_d1024` created; `…_d4096` kept as archive
- [x] KBSEW redeployed at dim 1024; barrel force-reindex **done** (marketing_nw **3299** + NLP **121** @1024)
- [x] Finish refill (2026-09-04, ops script `docker/scripts/eliteew-phase2-qdrant-refill.py` inside `stack0-eliteew-api-prod-baked`):
  - `product_assistant_kb` **266**; `eliteew_documents` **6066** (274/292 rows); `desktop_chat_rag` **23**/23 attachments; `chat_history` **435** turn pairs from PG messages
  - `marketing_project_rag` **680** points — all **38** indexable rows (`project_id` + text); remaining `marketing_rag_included` rows lack `project_id` (not indexable by contract)
  - companion episodic **4519**/4519 → `ewa_companion_episodic_v1_d1024` (archive `…_d4096` retained)
  - memory cells: **1** rebuilt (**60** chunks); **2** cells unrecoverable (source chat cleared at prior extract — text lived only in old Qdrant)
  - **Ops note:** do **not** call `extract_memory_cell_from_chat` for refill — it hard-deletes the source chat (product extract path). Refill uses gather+index only.
- [ ] Optional recall bench on **20–50** operator queries (rerank mini kept on)
- [x] Retire 8B embed/rerank as prod baseline in STACK2 contract text (Phase 2 live snapshot)

### Phase 3 — Workflow + budgets

- [x] Enforce canonical turn for Desktop solo + companion (retrieve → act → answer; deep optional)
- [x] Tighten inject / RAG char budgets; companion condense gates aligned to new `-c`
- [x] Dual-URL routing stub: interactive vs deep job class (`LLAMA_DEEP_URL`; deep host = Phase 4)
- [x] Locks: narrow pytest on contracts; no symptom-only scorecard closeout

### Phase 4 — Deep on `.136`

- [x] Second LLM URL for heavy jobs: `eliteew-llama-deep` on `.136:8080` (`gemma-4-31B-it-Q4_K_M.gguf`, `-c 81920` / `--parallel 1` / KV `q8_0`); stack0 `LLAMA_DEEP_URL=http://192.168.1.136:8080`
- [x] Queue isolation from interactive: deep never remaps to `LLAMA_URL`; process-local `LLAMA_DEEP_MAX_INFLIGHT` default **1**; no Celery `llm_deep` fleet yet (document follow-up)
- [x] Comfy: stopped while deep up; restart only when deep idle / explicit operator (`eliteew-llama-deep.sh stop` then `start-comfyui-clean.sh`)
- [x] Callers: `services/llm_runtime/deep_client.py`; Desktop admin probe `llama_deep`; companion hop behind `EWA_DEEP_LLM_ENABLED`
- [x] **Live gate:** `EWA_DEEP_LLM_ENABLED=1` **only while** `eliteew-llama-deep` is up on `.136:8080` (mutex with Comfy). **Off (2026-09-05):** Comfy owns the 3090 → staging/Config Plane `EWA_DEEP_LLM_ENABLED=0` + env-push + stack0 recreate — companion/agentic must not attempt deep hops. Agentic `call_expert_chat` sets `defaults.desktop_llm_job_class=deep` only when the gate is on (ensemble → `LLAMA_DEEP_URL`; missing deep → interactive + `[STEP] desktop_llm_deep_fallback`). Research/`file_create` compose and companion post-answer hop use the same gate.
- [x] **Cause lock (2026-09-05):** EWA PG settings `os.getenv` shim must **fall through** for uncached `EWA_*` keys. Previously, after worker bootstrap (`EWA platform settings loaded from Postgres`), `os.getenv("EWA_DEEP_LLM_ENABLED")` returned `""` even when compose/Config Plane set `1`, so `deep_llm_enabled()` stayed False and ensemble/doc_create stayed on interactive `stack2-llama-chat`.
- [x] **Expert → deliverable inject SoT:** `deliverable_classify.resolve_use_expert_research` — personal never injects; research always injects (Think cannot veto with `false`); ambiguous injects when session already has expert research. `plan_tool_args_prepare` always re-resolves before enrich.

---

## 8. Failure / edge-case matrix

| Axis | Expected behavior |
|------|-------------------|
| **Offline `.141`** | Chat may answer without RAG/tools; UI/API **honest degrade** (no fake “searched”); ops smoke red on embed health |
| **Dual flag** (interactive URL + deep URL) | Job class / router decides; default = interactive; never silent override of deep onto `.111` under load |
| **Permission** | Unchanged AuthZ; memory cells / episodic still owner/`principal_id` filtered |
| **Regression** | Phase proofs: dual stream smoke; embed dim shape check; companion retrieve + Desktop `build_rag_prefix` narrow tests; `bash docker/scripts/stack2-llm-smoke.sh` when applicable |

---

## 9. Explicit do / do-not

**Do**

- Split planes across `.111` / `.141` / `.136`
- Shrink interactive context; raise `--parallel` only with KV math that fits one 3090
- Prefer small embed; reindex once per dim change
- Multi-hop short turns; compress evidence between steps
- Stop/start Comfy and any GPU service freely during this redesign window

**Do not**

- Treat 200k ctx as the memory product
- Keep `--parallel 1` while asking for queue relief
- Run 8B embed+rerank as the long-term memory plane on 16GB “because we can”
- Mix old/new embedding dims in one Qdrant collection
- Call Phase “done” on docs/locale/tests alone without cause-layer runtime change (`cause-first-intake`)

---

## 10. Open A/B (decide in Phase 1–2, then lock in STACK2)

1. Interactive MoE: **Gemma4 26B-A4B** vs **Qwen3.6 35B-A3B** (RU quality, tool calling, t/s, VRAM with parallel 2).
2. Embed model + exact **dim** (drives reindex cost).
3. Rerank **on (mini)** vs **off** after recall bench.
4. Whether deep `.136` shares weights path with `/home/owned/llama-test-models` via NFS/rsync or local copy.

---

## 11. Related canon (read before coding a phase)

| Doc | Role |
|-----|------|
| [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md) | Live stack2 / remote roles — update on cutover |
| [LLM-CHAT-MODEL-CHANGE-CHEATSHEET.md](LLM-CHAT-MODEL-CHANGE-CHEATSHEET.md) | Operator model switch |
| [docker-re_doc/STACK0-LLM-OVERVIEW.md](docker-re_doc/STACK0-LLM-OVERVIEW.md) | `LLAMA_*` / parallel slot semantics |
| [docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md](docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md) | Qdrant-first |
| [docker-re_doc/QDRANT-INDEXING.md](docker-re_doc/QDRANT-INDEXING.md) | Reindex / dim migration |
| [product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md](../product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md) | Memory Cells |
| [product/ewa/EWA-COMPANION-HCM-MEMORY.md](../product/ewa/EWA-COMPANION-HCM-MEMORY.md) | Companion HCM |
| [product/ewa/EWA-COMPANION-TOOL-ROUTER.md](../product/ewa/EWA-COMPANION-TOOL-ROUTER.md) | FC sidecar |
| [product/DESKTOP-ENSEMBLE-ACTIONS.md](../product/DESKTOP-ENSEMBLE-ACTIONS.md) | Mid-turn probes (reuse in multi-hop) |
| [docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md](docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md) | Comfy stop/start on `.136` |

---

## 12. Session provenance

| Field | Value |
|-------|--------|
| Decided | 2026-09-04 |
| Context | Operator: redesign LLM + memory/RAG/embed/tools; dual stream; both Desktop + EWA; GPUs movable; Comfy stoppable |
| Status | **Approved target memo** — implementation not started in the decision session |
