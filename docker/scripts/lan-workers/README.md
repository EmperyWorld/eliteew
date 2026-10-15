# docker/scripts/lan-workers/ — gpu141 (`.141`)

Remote inference and media host: embed `:8081` / rerank `:8082` / companion tool-router `:8083` / ComfyUI `:31003`.

**Living ComfyUI is on `.141`.** The persistent tree is `/var/lib/eliteew/comfyui`; rootful host-net start and remount helpers are in this directory. The `.136:31003` path is historical rollback only. See `PRODUCTION-TOPOLOGY-STATE.md` §Current and `LAN-WORKERS-141.md`.

**Canon:** `documentation/platform/docker-re_doc/LAN-WORKERS-141.md`  
**Compose:** `docker/stack/stack2-llama-remote-embed-rerank.yml` (+ `.host-net.yml`)  
**Env:** `docker/env_file/.env.llama-remote` · example overlay `gpu141.env.llama-remote.example`  
**Host unit:** `docker/systemd/eliteew-llama-remote-embed-rerank.service` / `gpu141-llama-remote.service`

## Prefer

| Intent | Command |
|--------|---------|
| Deploy llama-remote stack on `.141` | `bash docker/scripts/lan-workers/deploy-141.sh` |
| Recovery gate | `bash docker/scripts/lan-workers/gpu141-recovery-gate.sh` |
| Start embed/rerank from CC | `bash docker/scripts/start-gpu141-embed-rerank.sh` |

## Script map

| Script | Role |
|--------|------|
| `deploy-141.sh` | Sync/start llama-remote compose on gpu141 |
| `gpu141-recovery-gate.sh` | Preflight before relying on `.141` inference |
| `eliteew-gpu141-comfyui-owned-phase.sh` | Run the shared Comfy launcher against the gpu141 persistent tree |
| `eliteew-gpu141-comfyui-persist-sudo.sh` / `eliteew-gpu141-comfyui-remount-rw-sudo.sh` | Persist/remount the overlayroot-backed Comfy tree |
| `eliteew-gpu141-comfyui-rootful-start-sudo.sh` | Rootful host-net start for living ComfyUI |
| `setup-gpu141-*.sh` / `*-nftables-*.sh` | Firewall / NFS / internet / harden |
| `setup-gpu141-prod-core-embed-rerank-firewall.sh` | Allow prod-core → embed/rerank ports |
| `install-ssh-key-to-gpu141.sh` / `ssh-config-gpu141.snippet` | SSH bootstrap |
| `mikrotik-gpu141-isolate.rsc` | Router isolation snippet |
| `set-lan-dns-yandex.sh` | LAN DNS helper |

### Legacy (not living Comfy path)

| Script | Note |
|--------|------|
| `start-gpu141-comfy-ssh-tunnel.sh` / `eliteew-comfy-tunnel.service` | Historical ACE/LoRA SSH tunnel — **do not use**; living `.141:31003` is direct LAN allowlist |
| `fix-gpu141-comfy-firewall-order.sh` | Same legacy firewall story |

Do not run prod stack0 bake on `.141` — builds stay on command-center `.136`.
