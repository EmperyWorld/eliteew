# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — Air Admin create 500 because API image lacked OpenSSH client.
# ---

# Air enroll Admin create — missing OpenSSH client in API image

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **product_id** | `desktop-client` |
| **also_affects** | `stack0-api` |
| **symptom** | Admin `POST /api/v1/desktop/admin/platform-ops/air-enroll/sessions` → HTTP 500 `FileNotFoundError: [Errno 2] No such file or directory` while edge Config Plane and preflight from host/WG looked healthy. |
| **failure_layers** | API runtime image; edge SSH subprocess (`air_enroll_edge._run` → `create_subprocess_exec("ssh")`) |
| **root_cause** | Baked `stack0-eliteew-api-prod-baked` did not install `openssh-clients`. Celery/site-studio targets already had it; Air create/reveal runs in the API process. |
| **fix** | Install `openssh-clients` on Dockerfile target `api`; map missing binary to typed `AirEdgeError(edge_ssh_missing)`. |
| **verification** | Live inject of `ssh` from celery-worker → Admin create **201**, reveal **200**, WS accepted, `desktop_portal_edge_sync_ok` / fleet migration OK. Unit: `tests/test_desktop_client_air_enroll_edge_ssh.py`. Permanent: stack0 release after Dockerfile change. |
| **recommendation** | Never rely on host/`dnf` inside API for OpenSSH; bake only. Before Air enablement smoke, assert `podman exec … command -v ssh`. |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |
