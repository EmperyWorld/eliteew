# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — nonfree and unknown dependency metadata escaped the SPA license gate.
# ---

# License gate: custom and unknown dependencies escaped review

| Field | Value |
|-------|-------|
| **product_id** | `eliteew-spa` |
| **status** | `fixed` |
| **date** | `2026-09-28` |
| **also_affects** | shared API, trusted-substrate |
| **canon** | `documentation/platform/FRONTEND-LICENSE-CLEANUP.md`; `documentation/platform/THIRD-PARTY-LICENSE-MAP.md` |
| **commit** | — |

## Symptom

The direct-dependency gate reported success during the AGPL migration even
though the production SPA bundled GSAP under its custom Standard No-Charge
license. The full graph also reported `khroma@2.1.0` as `Unknown`; the API image
declared `clamd@1.0.2`, whose package metadata and source lacked an exact LGPL
version.

## Root cause

The gate checked only whether direct packages had an MIT branch or a manually
named exception. It skipped missing direct metadata, ignored all transitive
unknown/custom buckets, and treated “free of charge” as if it meant a
free-software license.

## What we did

- Replaced Chronicle GSAP animations with the already-shipped MIT
  `framer-motion` runtime and browser timers; removed GSAP from source,
  `package.json`, and `pnpm-lock.yaml`.
- Extended `licenses:check` to fail on missing direct metadata and
  unknown/nonfree transitive buckets.
- Bound the `khroma@2.1.0` metadata gap to its exact upstream MIT license;
  upgrades fail until reviewed.
- Removed ambiguous `clamd@1.0.2` from the API image and implemented the
  bounded PING/INSTREAM Unix-socket protocol in first-party AGPL code.
- Corrected stale Trusted Substrate notices from proprietary to the root AGPL
  default while preserving upstream and MIT exceptions.

## Recommendations

- Never equate zero price with an OSI/FSF free-software license.
- Do not add a custom-license exception to make the gate green; record an
  explicit compatibility decision or remove the dependency.
- Keep metadata resolutions exact-version and evidence-linked.

## Verification

```text
pnpm run licenses:check
→ direct policy and transitive unresolved/nonfree guard satisfied

pnpm exec vitest run src/features/empery-nexus-chronicle/__tests__
→ 19 passed

pytest tests/test_security_validator_small_uploads.py tests/test_clamav_client.py
→ 6 passed, 1 skipped (real clamd socket unavailable)

cargo metadata --locked --offline --filter-platform x86_64-unknown-linux-gnu
→ 540 packages; 0 missing; 0 custom/unknown
```

## Residual risk

Buildroot `legal-info` still requires the external factory output and download
cache. If that work-root is unavailable, the public binary release remains
blocked even though the source/dependency gate defect is fixed.
