# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Record the cause and verified containment of a tracked Firebase service
# account key before the public-history cutover.
# ---

# Tracked FCM service-account key

| Field | Value |
|-------|--------|
| **product_id** | `mobile` |
| **status** | `fixed` |
| **date** | `2026-09-28` |
| **also_affects** | `stack0-deploy` |
| **canon** | `documentation/product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md` |
| **commit** | — |

## Symptom

A full-history secret scan found a valid Google/Firebase service-account private
key in a tracked stack0 env example. The Android Firebase client configuration
was also still tracked although both `.gitignore` and the mobile runbook
classified it as local-only.

## Failure layers

- Config Plane export: a live structured JSON value reached an `*.example` file.
- Git tracking: adding a path to `.gitignore` did not untrack the existing file.
- Verification: release preparation had no repository-level Gitleaks policy
  separating real credentials from known protocol and identifier false positives.
- Test signal: invalid private-key-shaped fixtures added avoidable scanner noise.

## Root cause

The env synchronization path treated `*.example` naming and `.gitignore` as
secret controls instead of transforming credential-bearing values and enforcing
a tracked-snapshot secret scan.

## What we did

- The operator revoked the exposed Google service-account key.
- Disabled FCM and cleared the revoked JSON in command-center plaintext staging;
  the tracked env example now has the same safe-disabled shape.
- Moved the tracked Android Firebase client configuration to local trash; the
  canonical path remains gitignored for a future local-only configuration.
- Replaced private-key-shaped test sentinels that were not testing key validity.
- Added a repository Gitleaks configuration with narrow allowlists for confirmed
  non-secret protocol data, image tags, host ports, and stable identifiers.
- Documented the safe default and rotation sequence in the mobile release canon.

## Recommendations

- Never copy a live env value into an `*.example` file, even when the source is
  described as redacted.
- Treat any committed private key as compromised, including in private Git hosts.
- Scan a clean tracked snapshot before creating a public root commit; scan the
  complete private history separately and keep that repository permanently private.
- Keep allowlists path-and-pattern scoped. Do not disable a standard detector
  globally to make a report green.

## Verification

```text
Gitleaks 8.30.1 dir <clean tracked working snapshot> → no leaks found
OpenSSL public-key derivation before cleanup → leaked service-account key was valid
post-cleanup config probe → FCM disabled and service-account JSON empty
pytest tests/test_mobile_private_tunnel_edge_sync.py -q → 15 passed
Gradle MobilePrivateTunnelConfigStoreTest → BUILD SUCCESSFUL
```

## Residual risk

The immutable private history still contains the now-revoked credential and must
never be made public. Historical Firebase Android client API keys are not service
account secrets, but their Google Cloud application/API restrictions must remain
configured.
