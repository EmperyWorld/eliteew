# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors entry — stack0 boot fail after reboot (short-name + bake-tag drift + baked-only autostart).
# ---

# stack0 autostart short-name / bake-tag / active_line

| Field | Value |
|-------|--------|
| **product_id** | `stack0-deploy` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/platform/PROD-CORE-DEV-BIND-LINE.md` |
| **commit** | — |

## Symptom

After prod-core reboot: stack1/4/6 up, stack0 missing. Autostart exit 0 with `API_fail`. Manual `up-dev-bind` failed: `short-name resolution enforced but cannot prompt without a TTY` for `eliteew-*:prod-baked-20260905-0027` (images absent; localhost tags were `1914`).

## Failure layers

- Config Plane: SOPS/runtime bake tag drifted from staging/images (`0027` vs `1914`)
- Deploy lib: `recreate_stack0_dev_bind` skipped dual-tag short-names (baked path had them)
- Autostart / port-guard: always forced **baked** compose, ignored `active_line=dev-bind`
- Observability: best-effort phases → exit 0 masked stack0 failure

## Root cause

Boot stack0 compose used unqualified image names without dual-tags and a stale bake tag from SOPS, while recovery always recreated the baked line instead of the recorded active_line.

## What we did

- `prod_core_deploy_ensure_baked_image_short_tags` in `recreate_stack0_dev_bind`
- `prod_core_deploy_recreate_stack0_for_active_line` + boot/`start-prod-core-stacks` + port-guard honor `active_line`
- Autostart: short-tags after ensure-baked-env
- Rebuilt/encrypted SOPS from staging `prod-baked-20260905-1914` + `eliteew-prod-core-env-push.sh --yes`
- Synced deploy tree to prod-core

## Recommendations

- After every successful bake: sync bake keys to staging **and** rebuild SOPS before next env-pull/reboot
- Never assume autostart “succeeded” without `:29000` smoke
- Do not skip short-tags on any stack0 compose path

## Verification

```text
sops decrypt bake keys → prod-baked-20260905-1914
ssh .111 'rg recreate_stack0_for_active_line docker/scripts/prod-core-deploy-lib.sh'
bash -n docker/scripts/prod-core-deploy-lib.sh start-prod-core-stacks.sh prod-core-stack0-host-port-guard.sh podman-autostart-prod-core.sh
ssh .111 'curl -sf http://127.0.0.1:29000/api/health' → {"ok":true}
```

## Residual risk

Edge SPA SSH from agent host timed out (public deploy_id verify fail) — publish when edge reachable. Full reboot retest not run in this session.
