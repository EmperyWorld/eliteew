# UGS AI routes audit (living)

**Updated:** 2026-07-19
**Scope:** How product surfaces reach Unified Generation System vs retired/legacy paths.
**Related:** [UGS-FLOW-AND-CONFIG.md](UGS-FLOW-AND-CONFIG.md), [ugs_frontend_contract_and_regression_baseline.md](ugs_frontend_contract_and_regression_baseline.md), [desktop/UGS-DESKTOP-SHELL.md](desktop/UGS-DESKTOP-SHELL.md).

---

## 1. Canonical UGS HTTP surface

Mounted at `/api/v1/ugs` (`shared/api/routers/ugs/`, domain `bi_ugs.py`).

| Cluster | Paths (representative) | Owner |
|---------|------------------------|--------|
| Generate | `POST /generate`, `POST /generate/stream` (SSE) | `generation.py` → `UnifiedGenerationService` |
| Status / result | `GET /status/{id}`, `GET /result/{id}` | owner-scoped |
| Types / providers | `GET /types`, `GET /providers`, `GET /providers/status` | `types_providers.py`, `health_metrics.py` |
| Tasks | `GET /tasks`, `GET /tasks/tray-summary`, `GET /admin/tasks` | Hub + tray |
| Billing | `/billing/*` | credits / packages |
| Workflows | `/workflows*` | admin-gated `WorkflowService` |
| Admin | `/admin/*` + `/admin/v2/*` | `routers/ugs_admin/` package + `admin_v2_service` |
| Metrics | `/metrics`, `/stats`, `/analytics` | ops / Hub dashboard |

**Retired from prod path:** Apache Airflow orchestration; legacy HTTP callback `/api/ugs/callback/complete` (queue worker writes Postgres directly). Alias `/api/ugs/admin` remains with deprecation headers.

---

## 2. Product callers (in-process UGS)

These call `UnifiedGenerationService.generate` / `start_generation_for_stream` (or studio helpers) — not a second generation bus.

| Product | Entry | Notes |
|---------|-------|--------|
| UGS Hub / Studio | FE → `/generate/stream` | Primary operator UI |
| Creative Studio (image/video/music) | `creative_studio_utils` / studio routers | Image Studio: queued SSE (`/image-studio/*/stream`, no `skip_queue`); other studios may still use `skip_queue` |
| Music Forge / music generator | `music_generator*.py` | Idempotency headers supported |
| Document Editor | `doc_editor` services | Image/text slots |
| EWRP | `ewrp_service` | Slide regen energy |
| Professional Worlds | `professional_worlds_*` | Text via type keys |
| Marketing IMC RAG | `imc_rag_research_provider` / cabinet fillers | Must not route to generic chat |
| Assistant | `ewa_ugs_alignment_facade` + companion jobs | Alignment/inventory; generation via UGS types |
| Imperorg | `imperorg_service` | Images: `image_generation_comfyui` stream; optional audio: `music_generator_generate_ace` via `UnifiedGenerationService.generate` (no direct `ComfyUIProvider`) |
| Ассистент tools | `desktop_chat/tools/image_ugs.py` | Tool bridge into UGS |

---

## 3. Non-UGS AI paths (do not confuse)

| Surface | Path | Relation to UGS |
|---------|------|-----------------|
| Desktop Llama Chat | `/api/v1/desktop/...` chat + tool-router | Separate stack2 chat; may call UGS tools |
| Web search admin | `/api/v1/.../search` admin | Yandex runtime; stack5 SearXNG **retired** |
| Voice Gateway | `voice_gateway_service` | Real-time TTS/STT — not UGS batch |
| OpenWebUI provider | UGS provider type `openwebui` | Optional RAG path inside UGS; health/execution share DB `base_url` |

---

## 4. Provider URL honesty (2026-07)

- **ComfyUI living host:** gpu141 `192.168.1.141:31003` — `COMFYUI_URL` in prod-baked example and runtime. Health and execution use `_resolve_comfyui_base_url`.
- **OpenWebUI:** execution passes `ProviderConfig.base_url` into `OpenWebUIProvider` (default internal `:8080`, not host-mapped `:31001`).

---

## 5. Regression hints

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/ -k 'ugs_' -q --tb=line
cd shared/web/frontend && pnpm exec vitest run src/services/api/ugs/__tests__
```
