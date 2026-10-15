# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — Air enroll edge_ssh_missing after SKIP_BASE thin bake.
# ---

# Air enroll Admin create — OpenSSH missing after thin prod-baked API layer

| Field | Value |
|-------|--------|
| **status** | `contained` |
| **date** | `2026-09-17` |
| **product_id** | `desktop-client` |
| **also_affects** | `stack0-api` |
| **canon** | `documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md` |
| **commit** | — |

## Symptom

Admin create logged `air_edge_ssh_binary_missing` / `edge_ssh_missing` while Config Plane Air SSH key/host/known_hosts were already SET in `stack0-eliteew-api-prod-baked` env. Image tag `eliteew-api:prod-baked-20260915-1340`.

## Failure layers

API thin prod-baked image (`Dockerfile.prod-baked` `api-baked`); Line A `SKIP_BASE=1`; `air_enroll_edge._run` → `create_subprocess_exec("ssh")`.

## Root cause

`Dockerfile` target `api` already installed `openssh-clients`, but default stack0 release does not rebuild `eliteew-api:v3`. Thin bake only COPYed code onto the old base, so `/usr/bin/ssh` never reached the running API. The private key was never missing.

## What we did

- Live: copied OpenSSH client from celery-worker into the current API container (vanishes on recreate).
- Cause: install `openssh-clients` on `api-baked` with `test -x /usr/bin/ssh` (no `--skip-unavailable`); same fail-closed on `Dockerfile` target `api`.
- Lock: `stack0_backend_probe_api_openssh_client` on base + prod-baked API images.
- Canon: Air enroll live contour + STACK0 backend runtime surface.

## Recommendations

- Never treat a key file in the API container as the fix for `edge_ssh_missing`.
- Before Air enablement after any `SKIP_BASE=1` release: `command -v ssh` in the API container.
- Next `release stack0 --all` is required for the bake layer to replace the live inject.

## Verification

```text
podman exec stack0-eliteew-api-prod-baked command -v ssh
  → /usr/sbin/ssh (live inject)
python create_subprocess_exec("ssh","-V") in API → rc 0
After next release: stack0_backend_probe_api_openssh_client on new tag
```

## Residual risk

Live inject disappears on API recreate until the next stack0 release that includes `api-baked` openssh. Post-ssh creates can still fail `security_group_overlap` (baseline SG covering Air ports) — separate edge SG contract, not this image hole.
