# EWA platform settings: catalog, persistence and HTTP contract

Source review: 2026-10-11. Runtime settings are loaded from EWA PG into each process's cache. Source catalog metadata/defaults, stored PG values and effective values in a running worker are different evidence. This audit read source and ran mocks; it did not query production settings.

## Catalog and storage

[Catalog](../../../shared/api/ewa_platform/settings/catalog.py) wraps [GENERATED_CATALOG](../../../shared/api/ewa_platform/settings/catalog_entries.py). Current source has **282 keys**: companion 158, persona 64, agentic 28, media 14, orchestration 11, atoms 4, infrastructure 3. [Complete source metadata snapshot](../../api/EWA-PLATFORM-SETTINGS.snapshot.json) contains every key/type/default/allowed-value/description/affected area and secret marker. It contains no runtime environment or database values.

[PG adapter](../../../shared/api/ewa_platform/persistence_pg/platform_settings_asyncpg.py) defines `ewa_platform_setting` and `ewa_platform_setting_audit` (migration 013). Bootstrap seed inserts missing keys and refreshes metadata on conflicts without overwriting an operator's `value_text`. Loading reads all DB rows, so obsolete/noncatalog rows may remain; list totals need not equal catalog totals.

`EWA_DATABASE_URL` remains a bootstrap environment input, excluded from the operational catalog. **Uncached/noncatalog EWA keys still fall back to process environment**. The repository does not implement a rule that every `EWA_*` except the DSN must always be absent from compose. Catalog media keys and non-EWA configuration also have their own consumers.

Migrations 014/017/019/022/025–032 add/reconcile or tune subsets; 033 adds agentic expert node kinds; 034 adds prompt-block tables; 035 changes condensation threshold to eight; the [migration inventory](../../../shared/api/ewa_platform/migrations/README.md) currently extends through **036**. A checked-in migration's profile is not a current production observation. Bootstrap metadata seed is also not equivalent to applying every SQL migration.

## Cache and setting resolution

[Service](../../../shared/api/ewa_platform/settings/service.py) bootstraps schema/seed, loads values, updates the process cache and synchronizes `os.environ` for compatible consumers. It clears the persona override cache and installs an `os.getenv` shim for cached EWA keys (except DSN). Empty cached values can fall back to a passed default through that shim.

[Accessors](../../../shared/api/ewa_platform/settings/access.py) prefer a loaded cache entry, then environment, then caller default. Their bool/int/float helpers handle empty/invalid numeric text using caller defaults. Direct `os.environ.get` bypasses the shim, although bootstrap/update synchronization can populate it. New runtime code should use the settings interface rather than assume all consumers are dynamically reconfigured.

Admin PUT reloads the cache **in the serving process**. There is no cross-process broadcast or periodic universal reload in this service. Other API/worker processes need their own bootstrap/reload lifecycle; the re-embed worker explicitly bootstraps before nonempty batches. Settings embedded in an already constructed client, frozen configuration or beat schedule can additionally require recreation/restart. Do not promise fleet-wide immediate application from one successful PUT.

## Admin HTTP API

[Router](../../../shared/api/ewa_platform/gateways/routers/companion_admin.py) mounts under `/api/v1/ewa/admin/companion`. These three settings operations require an authenticated user whose role is `admin` or `emperyworld_admin`; other authenticated roles receive 403. They intentionally bypass companion-admin feature/write switches so an administrator can bootstrap those switches. All require the EWA PG pool; absence → structured 503. [Schemas](../../../shared/api/ewa_platform/schemas/pydantic/companion_admin.py) define responses.

- `GET /settings`, optional `category` string: category is trimmed/lowercased when filtering. Returns `settings`, returned `settings_total`, all-row `db_total`, source `catalog_total`, and `schema_version: ewa_platform_settings_v3`. Each row contains key/value/type/category, RU/EN title/description/affects, source default/allowed-values metadata, secret/mask booleans, order/updater/time. Source metadata overlays catalogued DB rows.
- `GET /settings/audit`, optional `setting_key`, `limit` default 50 (adapter clamp 1–200): returns audit `entries` and schema version `ewa_platform_setting_audit_v1`. Entries contain id/key, old/new values, actor, time and mask marker. Unknown key can yield an empty list; it does not create a setting.
- `PUT /settings/{setting_key}`: body `{"value_text":"1"}` (string, defaults empty if omitted). Returns the updated row, 200. Unknown source key → 422 `unknown_setting_key`; invalid bool/int/float syntax → 422 `invalid_bool` / `invalid_int` / `invalid_float`; catalogued but absent DB row → 404 `ewa_setting_not_found`. Mutation locks/updates the DB row and writes audit, then reloads the local cache. Reload failure after DB commit is not an atomic rollback of that setting update.

Generic validation checks bool syntax (including empty), integer parsing and float parsing. It does not enforce every metadata enum/range or cross-key conflict described by `allowed_values`; consumers may clamp/interpret values later. A successful PUT is not proof of a safe/effective configuration combination. Persona floats use empty catalog defaults as inheritance at runtime, but PUT rejects clearing back to empty: [DOC-CODE-017](../../../docs/CODE_ISSUES.md#doc-code-017--admin-validation-rejects-the-persona-numeric-inheritance-value).

## Secrets and prose boundaries

Secret values (including `EWA_QDRANT_API_KEY`) are plaintext in the DB and setting audit. GET settings masks nonempty secret value text; GET audit masks values using the current catalog definition. **PUT returns the updated value unmasked** to the authorized caller. Do not reproduce it in logs, examples or audit documentation, or describe the mask flag as encryption at rest. The frontend's password control is presentation, not a storage cipher.

Long role/system/sidecar/workflow prose belongs to `ewa_companion_prompt_block`, separate from numeric/flag/URL/capacity settings. [Prompt-block reference](EWA-COMPANION-PROMPT-BLOCKS.md) defines its own resolve/authorization behavior. Persona numerics can inherit parent/canonical values; see [seed matrix](EWA-COMPANION-SEED-PERSONA-MATRIX.md).

## Migration, extension and operating verification

Before changing a catalog, compare source metadata, persisted value and actual consumer. A SQL-only seed key absent from CATALOG still fails admin PUT as unknown. Catalog generator/help sources and manually curated entries need review together; regeneration is a source change, outside this documentation-only audit. Startup/reload checks must inspect the affected process, not only a shell `printenv`.

[Migration verification helper](../../../docker/scripts/ewa-platform-migrations-verify.sh) checks selected postconditions; [migration guidance](../../../shared/api/ewa_platform/migrations/README.md) explains its limits. [Admin smoke helper](../../../docker/scripts/ewa-companion-admin-smoke.sh) can query infrastructure and, when bearer configuration is present, send a real plan message. It is not a harmless local-only unit test. No helper, restart, live plan or schema mutation was executed here.

Historical tuning notes in the previous version described a 2026-08-16 operator pass: session wall clock 1800 (catalog default 3600), doc-create target range 12000–36000, predict budget 24576, four passes and quiet debug; anchor score changed 85→72; anchor LLM/controller refresh and self-correction/atom flags were enabled in that observation. These are retained as **unverified historical notes**, not present recommendations or live values. They cannot establish that atom expiry works (see [atom decoder defect](EWA-ATOM-LAYER.md)) or that every long mission has adequate resources. Retrieve actual current values and measure the target workload before choosing bounds.

Production host/worker/inference placement belongs only to [PRODUCTION-TOPOLOGY-STATE.md](../../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current. The [LAN workers guide](../../platform/docker-re_doc/LAN-WORKERS-141.md) is a separate optional procedure. No host table or restart target in this document overrides the topology SoT.

Verification: imported the pure source catalog (282 keys), tested the empty persona validator boundary and ran existing settings/access/persona/trust tests with mocks. Synchronous TestClient settings tests were not claimed as passing. Live DB values, concurrent multi-process reload and effective beat/client refresh remain unverified. Related: [admin UI](EWA-COMPANION-ADMIN-UI.md), [prompt blocks](EWA-COMPANION-PROMPT-BLOCKS.md), [image generation](EWA-COMPANION-IMAGE-GENERATION.md), [EWA PG runbook](../../platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md).
