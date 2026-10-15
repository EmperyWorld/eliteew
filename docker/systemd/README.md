# Host systemd units (EliteEW)

Units installed on **command-center** / **prod-core** / **gpu141** as needed.
Not container units — host `systemd --user` or system.

| Unit | Host (typical) | Role |
|------|----------------|------|
| `eliteew-podman-autostart.service` | prod-core `.111` | Oneshot bring-up via `docker/scripts/podman-autostart-prod-core.sh` |
| `eliteew-podman-autostart.service.d/override.conf` | prod-core | Drop-in overrides |
| `eliteew-comfyui.service` | command-center `.136` (historical rollback) | Legacy user-unit launcher; not the living product path |
| `eliteew-llama-remote-embed-rerank.service` | gpu141 `.141` | Embed `:8081` / rerank `:8082` / tool-router `:8083` |
| `eliteew-gpu141-comfyui` | gpu141 `.141` | Living ComfyUI `:31003`, rootful host-net, persistent `/var/lib/eliteew/comfyui` |

**Related:** `docker/host_conf/internal-sites-cert-renew.{service,timer}` (optional ACME) → `docker/scripts/internal-sites/renew-wildcard-cert.sh`.  
DNS stub guard units live under `docker/scripts/internal-sites/empery-tunnel-dns-guard.*`.

```bash
# Example (paths assume repo at ~/powered_by_emperyworld)
systemctl --user link ~/powered_by_emperyworld/docker/systemd/eliteew-podman-autostart.service
systemctl --user enable --now eliteew-podman-autostart.service
```

Canon: `documentation/platform/PRODUCTION-TOPOLOGY-STATE.md` §Current — living Comfy `.141:31003`. Comfy ops: `documentation/platform/docker-re_doc/LAN-WORKERS-141.md`; `.136` history: `COMFYUI-COMMAND-CENTER-OPERATIONS.md`.
