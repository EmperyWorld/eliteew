# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Site Studio provision compose_up failed: Podman stat HOME/.config.
# ---

# Site Studio worker Podman XDG vs Carrier SSH HOME

| Field | Value |
|-------|--------|
| **product_id** | `site-studio` |
| **status** | `open` |
| **date** | `2026-09-15` |
| **also_affects** | `stack0-deploy` |
| **canon** | `documentation/product/SITE-STUDIO.md` |
| **commit** | `80f539306` (wave 1); wave 2 thin-bake dir — pending |

## Symptom

Desktop Site Studio **raise** accepted `POST .../instance/provision` (HTTP 200) then failed. Worker: `stage=compose_up; stat /home/owned/.config: no such file or directory`. Slug `eliteew-f1b654a6`. No `/instance/start`. Apply/ImperorG launch could still return 200.

## Failure layers

- Deploy/compose: baked worker `HOME=/home/owned` for Carrier SSH, only `.ssh` bind-mounted
- Filesystem: `/home/owned` inside container is root `1755`; uid 1000 cannot create `.config`
- Podman client: stats `$HOME/.config` when `XDG_CONFIG_HOME` is unset/missing
- Thin bake (`SKIP_BASE=1`): base `RUN mkdir /var/lib/eliteew/xdg-config` never ships; uid 1000 gets `EACCES` on `/var/lib/eliteew`
- Not a missing Comfy tunnel (LAN `.136:31003` was a separate earlier image-wave failure)

## Root cause

Podman CLI and Carrier SSH shared `HOME=/home/owned`; SSH needs `~/.ssh`, Podman needs a writable XDG config home that was never provided.

## What we did

- Image `site-studio-worker`: `ENV XDG_CONFIG_HOME=/var/lib/eliteew/xdg-config` + mkdir/chown 1000
- Compose: same env on `stack0_b.yml`, prod-baked and dev-bind overrides; keep `HOME=/home/owned` + `.ssh`
- `ensure_podman_xdg_config_home()` on Podman CLI resolve (compose/image `XDG_CONFIG_HOME` then canonical `/var/lib/eliteew/xdg-config` only; fail closed, no `/tmp`)
- Tests: `shared/api/tests/test_site_studio_podman_xdg.py`
- Wave 2: mkdir+chown in `docker/builders/stack0-api/Dockerfile.prod-baked` `site-studio-worker-baked` (Line A skip-base)

## Recommendations

- Do not bind host `~/.config` into the worker (sops/CDI).
- Do not `chmod 777 /home/owned` or mkdir `.config` only in a live container.
- Do not fall back to `/tmp` for Podman XDG.
- After image bake: `ls -ld /var/lib/eliteew/xdg-config` must be a uid-1000 directory. `podman info` is not sufficient.

## Verification

```text
cd shared/api && UV_PROJECT_ENVIRONMENT=../../.venv uv run pytest tests/test_site_studio_podman_xdg.py -q --tb=short
# after stack0 release:
podman exec stack0-eliteew-site-studio-worker-prod-baked ls -ld /var/lib/eliteew/xdg-config
```

## Residual risk

Wave 2 (2026-09-15 after `prod-baked-20260915-1122`): Line A skip-base copied Python `ensure()` but not the v3 `mkdir`. Provision `site-3b22cefa` failed `Permission denied: '/var/lib/eliteew'`. `podman info` still exited 0 (remote socket). Fix: mkdir+chown in `Dockerfile.prod-baked` `site-studio-worker-baked`. Smoke must be `ls -ld /var/lib/eliteew/xdg-config`, not `podman info` alone.
