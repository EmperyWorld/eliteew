# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — Air entitlement omitted ota_artifact_pk because SOPS lag.
# ---

# Air FoFline OTA verify PK missing — staging plant never reached live API

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `contained` |
| **date** | `2026-09-21` |
| **also_affects** | `stack0-api` |
| **canon** | `documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md` · `documentation/platform/PROD-CORE-CONFIG-PLANE.md` |
| **commit** | — |

## Symptom

EmpiierOS artifact verify / MATCH failed after Air claim. Admin Air create/reveal/WS claim succeeded. Connected mints logged `desktop_client_entitlement_minted edition=connected` with no `ota_artifact_pk_missing`.

## Failure layers

Config Plane (staging plaintext vs SOPS bundle vs `.111` tmpfs); stack0 API process env; issuer `resolve_ota_artifact_pk()` omit-on-empty; FoFline-only 503 gate.

## Root cause

The live API reads `EMPIERO_OS_OTA_ARTIFACT_PK` from SOPS → runtime tmpfs. Staging `.env.stack0.backend` had the 64-hex verify PK (2026-09-21 14:54); `prod-core.env.tar.sops` was still 2026-09-18. After bake env-push the container stayed `UNSET`. Connected seats omit the payload field; FoFline 503 only fires when `allow_fofline` and the PK is invalid.

## What we did

- Rebuilt+encrypted the SOPS bundle from staging (PK only; no artifact SK; no `--plaintext-bundle`).
- `--validate-only` then `--yes` onto `.111` tmpfs (`storage_mode=runtime_tmpfs`, `env_push_ok`).
- Recreated `eliteew-api-prod` with `stack0_b.prod-baked.override.yml` `--no-deps` (restart without recreate is not enough).
- Live process after recreate: PK SET, length 64, prefix `813cfc81`, SK absent; `/api/health` 200.
- Did not publish an EmpiierOS capsule on a new artifact SK. MATCH stays open until the seat file exists.

## Recommendations

- After any staging plant of `EMPIERO_OS_OTA_ARTIFACT_PK`: bundle-build → sops-encrypt → validate-only → push → recreate baked API.
- Never put the artifact SK in env, git, UI, or logs.
- Measure is a **new FoFline** Air session (`allow_fofline`) then `{state}/ota/artifact.pk.hex` on the seat after bind. Old capsules and Connected remints do not backfill.
- Do not treat env-push or Connected reveal as MATCH.

## Verification

```text
staging PK SET len=64 prefix=813cfc81; artifact SK keys NONE
prod-core-env-bundle-build.sh → 10 files
prod-core-env-sops-encrypt.sh → bundle mtime 2026-09-21 15:43
decrypt + validate-only → PK ok; SK NONE; validate-only OK
eliteew-prod-core-env-push.sh --yes → env_push_ok runtime_tmpfs
.tmpfs SSOT+shared SET len=64 prefix=813cfc81; .env.stack0.api MISSING_PK (shared slice — expected)
recreate eliteew-api-prod baked --no-deps → health 200; LIVE_PK=SET len=64 prefix=813cfc81 LIVE_SK=ABSENT
seat {state}/ota/artifact.pk.hex → not verified (MATCH open)
```

## Residual risk

Seat plant after bind is not proven. New FoFline Air session was not created from this agent (Admin OAuth). MATCH remains open. Do not publish a new artifact-SK capsule until the seat hex matches.
