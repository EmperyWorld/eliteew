# API composition and domains

Explanation · source inspection dated 2026-10-11. [main.py](../../shared/api/main.py) creates FastAPI and finally exports a Socket.IO ASGI wrapper as `api.main:app`. Product APIs are primarily domains in the same process. [KBSEW](../../KBSEW/README.md) is a separate service with a stack0 gateway.

## Registration order

The bootstrap calls these registrars in this order. [domains/__init__.py](../../shared/api/domains/__init__.py) exports them, and heavy imports occur within registration functions.

| Order | Registrar source | Responsibilities |
|---|---|---|
| 1 | [site_studio_public.py](../../shared/api/domains/site_studio_public.py) | Host-based website gateway |
| 2 | [auth.py](../../shared/api/domains/auth.py) | SSO/logout/mobile identity/profile/themes |
| 3 | [creative.py](../../shared/api/domains/creative.py) | Editors, reports, image/video/music and media integration |
| 4 | [chat.py](../../shared/api/domains/chat.py) | Empty compatibility slot; no router mount |
| 5 | [social.py](../../shared/api/domains/social.py) | Friends, social hub, GAF chat and video calls |
| 6 | [content.py](../../shared/api/domains/content.py) | Unified content/search/processing/shares/versions |
| 7 | [voice.py](../../shared/api/domains/voice.py) | STT/TTS, Voice Center/Gateway and native realtime voice |
| 8 | [bi_ugs.py](../../shared/api/domains/bi_ugs.py) | Business intelligence, UGS/admin and EWA facade |
| 9 | [desktop.py](../../shared/api/domains/desktop.py) | Desktop, app/admin, Site Studio, KIRS, EBrowser and KBSEW gateway |
| 10 | [desktop_client.py](../../shared/api/domains/desktop_client.py) | Native-client enrollment/licensing/tunnel APIs |
| 11 | [professional_worlds.py](../../shared/api/domains/professional_worlds.py) | Professional Worlds public and admin APIs |
| 12 | [marketing.py](../../shared/api/domains/marketing.py) | Companies/projects and marketing cabinet/AMKA |
| 13 | [misc.py](../../shared/api/domains/misc.py) | Widgets, diagnostics, version, cache, business generator and telemetry |

After those calls, `main.py` directly includes the public/admin system-maintenance routers and then defines its own process/health/error endpoints. Therefore the bootstrap is not exclusively domain calls. The public Site Studio route is a Starlette `Host` composition rather than an ordinary `/api/v1` path router.

## Prefix composition

Selected registrars call [register_router_v1_and_legacy](../../shared/api/utils/router_registration.py), whose defaults add `/api/v1` and `/api`. Other registrars add explicit prefixes, and some routers already include a full API prefix. Desktop/content/product routers aggregate child routers; UGS/admin and surveys also populate router objects through registration functions. Trace both forms when reviewing a path.

[The EWA facade](../../shared/api/ewa_platform/gateways/companion_http.py) is the single EWA mount owner and defaults to `/api/v1/ewa`. EWA is separate from marketing AMKA. The chat slot mounts no legacy anonymous WebSocket echo API; Socket.IO is wrapped at the ASGI root and native WebSocket endpoints have their own dependencies.

## API discovery and authentication

Use [the registered catalog](REGISTERED-ROUTES.md) for source paths, [HTTP reference](SOURCE-HTTP-REFERENCE.md) for health/auth/errors/examples, and [the contracts hub](README.md) for OpenAPI and consumer workflow. Public-path exemptions in [OAuth2 middleware](../../shared/api/middleware/oauth2_protection.py) can still require tickets, operator tokens or native proofs in a handler. Do not equate a domain mount with anonymous availability.

## Verification limits

The catalog traces source composition; no running app, live identity provider, remote host or database was inspected. Two overlapping method/path declarations were found: `/api/profile/me` and `/api/version`. The first matching runtime route and any middleware determine effective behavior. The [version router](../../shared/api/routers/version.py) explicitly documents its precedence over the later bootstrap duplicate.

Source changes require renewed registration/schema/consumer review. Do not treat old FE↔BE or OpenAPI snapshots as automatically fresh. [Audit progress](../../docs/DOCUMENTATION_PROGRESS.md) records remaining semantic and runtime work.
