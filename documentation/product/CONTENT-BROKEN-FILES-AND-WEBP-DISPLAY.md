# Битые файлы и WebP-отображение (Unified Content)

**Status:** living product SoT — **implemented** (2026-09-01). Waves 0–4 landed: quarantine API + CM tab + WebP derivatives + owner scan/metrics.  
**Hub:** [CONTENT-MANAGER.md](CONTENT-MANAGER.md).  
**Process plan:** Cursor plan «Битые файлы + WebP» — при расхождении **этот SoT побеждает**.

## Purpose

Нормативные контракты:

1. **Карантин битых объектов хранилища** (`storage_integrity_status=broken_quarantined`) — раздел «Битые файлы» в Файловом менеджере.
2. **Fail-fast** на Seaweed 404-классе (без 3–4 ретраев).
3. **WebP display-деривативы** для сетки/preview при сохранении оригинала и действии «Скачать оригинал».

## Non-goals (v1)

- Восстановление байт с orphan Seaweed needle (volume 404) — **неэффективно**; UI даёт только **«Проверить снова»**.
- AVIF, смена топологии Seaweed, marketing AMKA, pack-cloud / pack-organization doors.
- SQLAlchemy `QueuePool` / `encryption.pii_key` ERR под плотным скроллом CM — **не** класс storage-broken; отдельный process plan: `documentation/plans/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md` *[operator-local process plan; gitignored — not living canon]*.

## State machine

| `storage_integrity_status` | `deleted_at` | Где виден | Смысл |
|----------------------------|--------------|-----------|--------|
| `NULL` / `ok` | NULL | Папки, списки, search | Норма |
| `broken_quarantined` | NULL | Только **«Битые файлы»** (owner) | Orphan/corrupted blob; исключён из folder-view/list/previews/search |
| `blob_missing` | SET | Не в user library (admin soft-quarantine) | Legacy/admin scan path — не путать с user «Битые» |

`processing_status=failed` ≠ storage-broken (ошибка OCR/extract, не отсутствие volume bytes).

```text
download|thumbnail|owner_scan
  → SeaweedFileNotFoundError | SeaweedFileCorruptedError
  → idempotent quarantine (broken_quarantined) + ES drop + Redis negative cache
  → HTTP 404 stable detail (no paths/fids)

GET /content/broken (owner)
POST /content/{id}/storage-recheck (owner, fail-fast 1 attempt)
  → ok → clear quarantine → UI status: файл вернулся в библиотеку
  → fail (HTTP 200, body ok:false) → stay broken → UI status: «в хранилище по-прежнему не найден» + next step permanent delete
  → transport/API error → UI alert (не путать с ok:false)
POST /content/{id}/permanent-delete (owner, confirm)
  → hard-purge PG + Seaweed + best-effort ES/Qdrant
```

## API surface

| Method | Path | Authz | Behavior |
|--------|------|-------|----------|
| GET | `/api/v1/content/broken` | owner only | List `broken_quarantined`, `deleted_at IS NULL` |
| POST | `/api/v1/content/broken/scan` | owner only | One-shot orphan probe; `dry_run=true` default; apply → `broken_quarantined` |
| POST | `/api/v1/content/{id}/storage-recheck` | owner | Fail-fast probe; clear or confirm broken |
| POST | `/api/v1/content/{id}/permanent-delete` | owner | Immediate hard-purge (not 30-day soft retention) |
| GET | `/api/v1/content`, `folder-view`, `folder-previews`, search | ACL | Default **exclude** `broken_quarantined` |
| GET | `.../download`, `.../thumbnail` | ACL | **Before Seaweed:** quarantine/neg-cache → **404** (never 500). On **download** 404-class read: quarantine + 404; transient → **503** (no quarantine). Volume needle missing often surfaces as IncompleteRead(0 bytes) → not-found / `seaweed_needle_missing`. **Thumbnail:** missing `thumbnail_path` or missing derivative object for regenerable types (image / PDF / text) → lazy generate+persist JPEG then **200**; `broken_quarantined` and non-regenerable (video/office) stay **404** without quarantining the original for a missing derivative alone. |

Reason codes (DB/API, no raw paths): `seaweed_needle_missing`, `incomplete_read`, `blob_unreadable`, `recheck_failed`.

## Grid / preview fallback

- Prefer `GET .../thumbnail` when `thumbnail_path` / `thumbnail_url` is set.
- **Do not** fall back to `/download` after a failed stored-thumbnail fetch (quarantine / storage unavailable).
- Web FE: inline `/download` preview is allowed only when **no** stored thumbnail path exists (legacy image without derivative).
- **DocumentProcessor** persists a text-card or PDF-page JPEG on successful process; `GET .../thumbnail` lazy-heals legacy rows via `document_thumbnail.py` (single-flight per content id).
- **Mobile (native CM lite):** list/player artwork `GET .../thumbnail` **only** when list DTO `thumbnail_url` is non-null; null URL / video / audio without derivative → mime/music icon; **no** mime probe and **no** `/download` fallback after thumb miss. Default lists already exclude `broken_quarantined`; optional `storage_integrity_status` on the DTO is a defensive client gate if the field appears on the wire.
Columns (extend `20260325_unified_content_storage_integrity`):

- `storage_integrity_status` — as above
- `storage_broken_at`, `storage_broken_reason`, `storage_last_checked_at`

## Fail-fast storage read

- Corrupted / not-found class: **max_attempts = 1**.
- Transient (`SeaweedStorageUnavailableError`): retries allowed; response **503**; **do not** quarantine.
- **Post-upload / post-replace:** after `store()`, backend runs **`verify_object_readable`** (1-byte read probe) when available — `stat_object` alone is insufficient on Seaweed (filer metadata without volume needle). Failed probe → PG transaction rolls back; no orphan row.

## User journeys (FE)

- File Manager tab **«Битые файлы»** is the owner inbox for `broken_quarantined` rows (recheck / permanent delete).
- Other apps (Image Studio history, creative thumbs): storage **404** removes the stale list row client-side and offers **Open Broken files** (`contentManagerInitialTab=brokenFiles` via `desktop-open-app`).

## WebP display contract

- Original bytes remain canonical for **«Скачать»** / **«Скачать оригинал»** (same ACL + ticket path as today).
- Grid / `<img>` preview / `GET .../thumbnail`: prefer **WebP** derivative (`image/webp`) when present; else legacy JPEG thumb without fake success.
- Processor writes WebP (and may keep JPEG thumb for back-compat).
- Upload: enqueue derive async after 201; backfill Celery for existing images.

## Security

- Broken list / recheck / permanent-delete: **owner (`user_id`) only**. Platform admin uses existing content-ops scan — not the user tab.
- No volume URL, fid, or storage path in user-facing `detail`.
- Ticket/download: re-check ACL before bytes (CONTENT-MANAGER §Ticketed downloads).
- Share recipients: no foreign broken-inbox; broken object → stable 404/unavailable + negative cache (no retry storm).
- Permanent delete: UI confirm + server owner check + audit (`STORAGE_PERMANENT_DELETE` or DELETE with explicit reason).

## Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| Offline / Seaweed transient | 503; no quarantine |
| Dual-flag processing vs storage | Separate fields; filters independent |
| Permission | Owner-only broken ops; default-deny |
| Regression | pytest quarantine filter + attempts=1; Vitest broken tab; smoke folder-view excludes quarantined |

## Waves (implementation order)

0. This SoT + CONTENT-MANAGER / INDEX / DB registry  
1. API quarantine + fail-fast + endpoints + pytest  
2. CM tab «Битые файлы» + Vitest  
3. WebP derivatives + FE «Скачать оригинал»  
4. Owner/admin scan→quarantine, metrics, doc-sync done  

## OpenAPI / FE types

Owner broken-ops paths are in the regenerable content pilot after `--refresh-openapi-pilots` (or `pnpm run openapi:pilot:content`):

| Path | `operationId` (pilot) |
|------|------------------------|
| `GET /api/v1/content/broken` | `list_broken_content_api_v1_content_broken_get` |
| `POST /api/v1/content/broken/scan` | `scan_broken_content_api_v1_content_broken_scan_post` |
| `POST /api/v1/content/{content_id}/storage-recheck` | `storage_recheck_content_api_v1_content__content_id__storage_recheck_post` |
| `POST /api/v1/content/{content_id}/permanent-delete` | `permanent_delete_content_api_v1_content__content_id__permanent_delete_post` |

Pilot: `shared/web/frontend/openapi/pilot/content.openapi.json` → `src/generated/content-openapi.ts`. CM client: [`contentApi/list.ts`](../../shared/web/frontend/src/services/contentApi/list.ts) (`listBrokenContent`, `storageRecheckContent`, `permanentDeleteBrokenContent`).

**Known debt:** list/scan/recheck/permanent-delete responses still export as loose `additionalProperties` objects in OpenAPI — FE keeps explicit `BrokenContentItem` / `StorageRecheckResponse` in [`contentApi/types.ts`](../../shared/web/frontend/src/services/contentApi/types.ts) until backend attaches named Pydantic `response_model` (then bridge alias, no hand twin). Canon: [FRONTEND-BACKEND-HTTP.md](../api/FRONTEND-BACKEND-HTTP.md) §Adoption.

## Related

- [CONTENT-MANAGER.md](CONTENT-MANAGER.md)
- [database/DATABASE_TABLES_REGISTRY.md](../database/DATABASE_TABLES_REGISTRY.md)
- Code: `storage_backends/minio_storage.py`, `unified_content_download.py`, `processors/image_processor.py`, `pages/ContentManager/`
