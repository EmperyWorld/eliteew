# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# product_id: desktop-client
# status: fixed
# date: 2026-09-10
# ---

# EBrowser downloads landed in host folder, not account File Manager

| Field | Value |
|-------|--------|
| **symptom** | Downloads saved under `~/Downloads/EliteEW-EBrowser` on the seat OS |
| **expected** | Files appear in Desktop system folder «Загрузки» (account library) |
| **failure layer** | Product SoT — download terminated at host disk instead of unified_content |
| **root cause** | Downloads v0 used WebKit destination under user Downloads only; no ingest to `POST /api/v1/content?folder_item_id=downloads` |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Fix

- Private staging (`temp/eliteew-ebrowser-staging`) + Rust multipart upload with Bearer
- `folder_item_id=downloads`, `source_service=ebrowser`
- SPA phases: `ingesting` / `library` / `library_*_failed`; optional `content_id`
- No product `fs_bridge`

## Verification

```bash
cargo test --manifest-path pack-organization/connection-agent/src-tauri/Cargo.toml linux_ebrowser_downloads
pnpm --dir shared/web/frontend exec vitest run src/features/ebrowser/ebrowserDownloadLibraryCopy.test.ts
```

## Also affects

- `ebrowser` product UX / Content Manager «Загрузки»
