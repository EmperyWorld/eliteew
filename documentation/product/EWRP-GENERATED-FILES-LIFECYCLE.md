# Presentation Generator: generated_files lifecycle

**Status:** living ops/lifecycle note for classic Reveal.js presentations + pointer to EWRP artifacts. Not a partner pitch deck.

> **Scope:** этот документ описывает **классический** контур Reveal.js (`/api/v1/presentations`, `generated_files/presentations/`).
> **EWRP** (EliteEW Revolutionary Presentations) — отдельный продукт: `/api/v1/ewrp`, артефакты в `generated_files/ewrp/{job_id}/`. Канон EWRP: **`product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`** (§ «Артефакты на диске»).

## Presentation Generator overview

- **Creation**: User creates a presentation via `POST /api/v1/presentations` (topic, title, num_slides, theme, etc.). Backend creates a row and can start background generation.
- **Generation**: Pipeline (text → images → assemble) runs in the background; status and progress are pushed over WebSocket. HTML and slide images are written under `generated_files/presentations/` (see below).
- **Export**: User exports via `GET /api/v1/presentations/{id}/export/{html|pdf|pptx}`. PDF/PPTX are generated on demand; response is a blob. On temporary failure the API returns 503 with a `detail` message.
- **Endpoints**: Main CRUD and export under `/api/v1/presentations/`; unified list under `/api/v1/presentations-unified` (and legacy `/api/presentations-unified`). View and images use optional auth/token (see View URL and token-based access).
- **Collaboration and permissions**: `PresentationCollaborationService.check_permission` grants the owner (`presentation.user_id == user_id`) full access. Explicit permissions (view/comment/edit/admin) are stored in `presentation_permissions`. Delete and stats endpoints require auth (401 without token).

## Base path

Generated files for presentations live under a writable base path configured by **GENERATED_FILES_BASE** (env). The API uses `get_generated_files_base()` from `api.services.presentation_generation_service` to resolve it. No fallback: the variable must be set (e.g. `GENERATED_FILES_BASE=/app`).

Paths below are relative to that base:

- **Root**: `{base}/generated_files/presentations/`

## Directory layout

| Subdir   | Path pattern                                      | Contents |
|----------|----------------------------------------------------|----------|
| html     | `generated_files/presentations/html/{presentation_id}/` | Rendered HTML (`{presentation_id}.html`) |
| images   | `generated_files/presentations/images/{presentation_id}/` | Slide images (e.g. `slide_1.png`) |
| context  | `generated_files/presentations/context/{presentation_id}/` | Uploaded context files (PDF/DOCX) |
| pptx     | `generated_files/presentations/pptx/{presentation_id}/`   | Exported PPTX (`{presentation_id}.pptx`) |

## When files are created

- **html**: When the generation pipeline persists the final HTML (after assembling slides).
- **images**: During the image-generation step; one or more files per presentation.
- **context**: When the user uploads a PDF/DOCX via set-context or unified context endpoint; stored under `context/{presentation_id}/`.
- **pptx**: When the user exports the presentation to PPTX.

## When files are deleted

- **On presentation delete**: The `DELETE /api/v1/presentations/{presentation_id}` handler (and equivalent) removes the four directories above for that `presentation_id` from disk before deleting the database row. Missing directories are ignored. Cleanup failures are logged but do not block the delete.

## View URL and token-based access

- **View endpoint**: `GET /api/v1/presentations/{presentation_id}/view` (and legacy `/api/presentations/...`) returns the Reveal.js HTML for inline/iframe preview.
- **Query parameter**: `?token=<jwt>` is supported so that iframes (which often cannot send `Authorization` headers) can load the view. When `token` is present and valid (validated via Keycloak), the backend does **not** enforce ownership: it uses `get_presentation_by_id_any` so any authenticated user with a valid JWT can view that presentation. This is an intentional trade-off for iframe/preview UX.
- **Image URLs**: Slide images are served at `GET /api/v1/presentations/images/{presentation_id}/{filename}`. The endpoint uses optional auth (`get_optional_oauth2_user`); if the user is not authenticated, the image can still be served as long as the path is valid (no ownership check). So anyone who knows `presentation_id` and `filename` can access the image. Risk: predictable or leaked IDs allow access to images without authentication. Mitigation options: bind token to `presentation_id`, or require auth for image serving; not currently implemented.
- **Token lifetime**: The JWT lifetime is defined by Keycloak (access token expiry). The view and image endpoints do not issue tokens; they only validate the provided token.

## Unified list contract (GET .../unified/list)

The archive/unified list endpoint returns items with a stable set of fields. Frontend should treat optional fields as possibly missing:

- **Always present**: `id`, `name`, `slide_count`, `theme`.
- **Optional**: `view_url`, `download_url`, `public_url`. If `public_url` is missing, the "Copy link" action is disabled. If `download_url` is missing, download is not offered.
- **View URL**: Frontend builds view URL from base URL + `view_url` (or uses `presentationsApi.getViewUrl(id, token)`). Query parameter `?token=<jwt>` is optional; when provided, the view endpoint accepts any valid JWT (no ownership check). Token lifetime is the Keycloak access token expiry.

## Export 503

When export (PDF/PPTX) is temporarily unavailable, the backend returns **503** with a `detail` message. The frontend shows that message to the user (e.g. "Экспорт временно недоступен" or the backend `detail`). Ensure backend `detail` is user-facing and concise.

## Manual checklist (after P0–P2)

After deploying changes, verify:

- [ ] Create presentation, run generation to completed, view slides.
- [ ] Export HTML / PDF / PPTX; delete presentation; open from archive.
- [ ] Presentation mode; copy public link when `public_url` is present.
- [ ] Without token: `DELETE /api/v1/presentations/{id}` and `GET .../stats` return 401.

## EWRP (отдельный контур)

| Path | Contents |
|------|----------|
| `generated_files/ewrp/{job_id}/index.html` | Landing HTML for screenshots |
| `generated_files/ewrp/{job_id}/presentation.pdf` | Final PDF |
| `generated_files/ewrp/{job_id}/slide_*.png` | Per-slide images |

Delete: `DELETE /api/v1/ewrp/{job_id}` removes DB row and the job directory. Full canon: **`product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`** §3.2. Automated smoke: **`docker/scripts/ewrp-stack0-smoke.sh`**.

## References

- Router: `api/routers/presentations.py` (`delete_presentation`, file cleanup block; `view_presentation`, `serve_presentation_image`).
- Service: `api/services/presentation_generation_service.py` (`get_generated_files_base`, HTML/image/pptx write paths).
- Tests: `api/services/test_presentation_collaboration_service.py` (owner permission).
