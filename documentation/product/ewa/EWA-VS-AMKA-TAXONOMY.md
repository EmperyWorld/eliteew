# EWA and marketing AMKA: domain taxonomy

Source review: 2026-10-11. **EWA** is the companion/orchestration platform under `/api/v1/ewa/*`. **Marketing AMKA** is the marketing-cabinet execution domain under `/api/v1/marketing-cabinet/amka/*`. Their branding, profile state and API boundaries are separate.

## EWA

The platform package is [shared/api/ewa_platform](../../../shared/api/ewa_platform/README.md). [bi_ugs domain registration](../../../shared/api/domains/bi_ugs.py) calls [include_ewa_routers](../../../shared/api/ewa_platform/gateways/companion_http.py). That facade mounts companion profile/chat, desktop orchestration, driver and related routers with the EWA prefix.

Companion and orchestration persistence use the EWA PG adapters and `EWA_DATABASE_URL`. Some desktop runtime modes instead use shared or ephemeral in-memory stores, so the DSN is not an unconditional requirement for every desktop turn. The desktop `EwaApp` surface, its companion panel and background jobs expose different workflows; a generic observation→intent turn is only one part of the platform.

EWA driver hints can include read-only UGS alignment. Companion task/tool execution can also invoke allowed domain actions. Do not infer that the entire EWA platform is read-only from that hint layer.

## Marketing AMKA

[Marketing AMKA router](../../../shared/api/routers/marketing_cabinet/amka.py) mounts `/amka` inside the marketing-cabinet API. Its implementation uses [amka_core](../../../shared/api/services/amka_core/) and marketing-domain storage such as `marketing_amka_*`. It manages project-related staged runs and their audit/planning/execution/reporting/pulse paths. Its auth/project checks and run lifecycle must be read in the marketing reference; they are not inherited from EWA desktop contracts.

## Naming and product intent

Use EWA names and `/api/v1/ewa/*` in new platform links/clients. Some checked-in schemas or compatibility symbols retain historical AMKA naming; those identifiers do not redirect a request into marketing. A marketing-cabinet AMKA request stays in that domain; a desktop-orchestration request stays in EWA.

Companion name/seed selection starts a per-user profile. Persona/character development is described by [persona vision](EWA-COMPANION-PERSONA-VISION.md), [profile ADR](EWA-COMPANION-PROFILE-ADR.md) and [evolution canon](EWA-COMPANION-EVOLUTION-CANON.md). The product aspiration to help a user manage their desktop remains subject to implemented allowlists/policy; it is not unlimited authority over that desktop.

Related: [AMKA contours](../amka-seed-album/AMKA-CONTOURS.md), [entry points](../amka-seed-album/AMKA-ENTRYPOINTS.md), [platform foundation](../amka-seed-album/EWA-PLATFORM-GREENFIELD.md). This taxonomy verifies the domain boundary, not all marketing or EWA endpoint semantics.
