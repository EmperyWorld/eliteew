# generation_requests storage policy

## Rule

**No code path may write to `generation_requests.output_data` or `generation_requests.input_data` without sanitization.**

Heavy payloads (large base64 images, long text, raw binary) must not be stored in these JSONB columns. They cause TOAST bloat (multi‑GB) and slow backups/replication.

## Write paths (audit)

| Location | What is written | Sanitized? |
| --- | --- | --- |
| `unified_generation_service.py` | `request.output_data` after direct generation | Yes — `_sanitize_generation_result(response_result)` |
| `routers/ugs/` (package) / `unified_generation_service.py` | Runtime completion path for direct/queue worker execution | Yes — `sanitize_generation_result(...)` before update |
| New code | Any INSERT/UPDATE of `output_data` or `input_data` | Must call `result_handling.sanitize_generation_result` (and optionally limit input_data size) |

## Sanitization

- **Module:** `api.services.ugs.result_handling`
- **Function:** `sanitize_generation_result(result, max_keep_b64_bytes=...)`  
  Truncates long strings, replaces large base64 image data with references or null; keeps structure for UI/preview.
- **Heavy artifacts:** Prefer storing in `unified_content` (e.g. `persist_result_images_to_shared_storage`) and store only `content_id` / metadata in `output_data`.
- **Runtime metadata:** keep lifecycle fields (`stage`, `queue_status`, `progress_message`, `last_heartbeat_at`, `execution_backend`, `idempotency_key`) in `request_metadata`, not inside bulky `output_data`.

## Retention

- **Periodic job:** Run weekly (e.g. cron Sunday 03:00):
  - From host: `shared/api/scripts/run_trim_generation_requests_retention.sh` (or see `cron-generation-requests-retention.example` for crontab line).
  - Or: `docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/scripts/trim_generation_requests_retention.sql`
  - Script: [trim_generation_requests_retention.sql](../../scripts/trim_generation_requests_retention.sql) — trims `output_data` for rows older than 180 days (batch 500).
- **One-time migration:** Already applied — [generation_requests_trim_large_payloads.sql](../../migrations/generation_requests_trim_large_payloads.sql) (rows >90 days or output_data >512 KB).

## Monitoring

- Monitor table/TOAST size of `generation_requests` (e.g. `SELECT pg_size_pretty(pg_total_relation_size('generation_requests'));`) to detect regrowth.
- Ensure autovacuum runs on `generation_requests`, `unified_content`, `content_versions` (tune `autovacuum_vacuum_scale_factor` / `autovacuum_analyze_scale_factor` per table if needed).
