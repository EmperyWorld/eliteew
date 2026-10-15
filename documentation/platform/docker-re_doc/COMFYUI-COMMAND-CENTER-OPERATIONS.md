# ComfyUI on command-center (`.136`) — **historical**

> **Living home (2026-09-26):** ComfyUI for product UGS (image/music) runs on **gpu141** at **`http://192.168.1.141:31003/`**. Stack0 `COMFYUI_URL` + DB `generation_providers.comfyui` → `.141`. Ops/runbook: [LAN-WORKERS-141.md](LAN-WORKERS-141.md) §ComfyUI; scripts `docker/scripts/lan-workers/eliteew-gpu141-comfyui-*.sh`.
>
> This file documents the **former** command-center Comfy path (`.136:31003`, mutex with `llama-deep` on the same 3090). Keep for rollback/history only — do **not** point prod `COMFYUI_URL` here unless the operator explicitly reverses the cutover.

## Role (historical `.136`)

ComfyUI for image UGS pipelines **was** served from **command-center** at **`http://192.168.1.136:31003/`** (bind `0.0.0.0:31003`). Legacy tree: `/home/owned/podryad/stack2/comfyui-clean` (container name **`comfyui`**). Start only via **`bash docker/scripts/start-comfyui-clean.sh`**.

### Mutex with Phase 4 `llama-deep` (same 3090) — historical on `.136` only

On command-center, Comfy and deep LLM **must not** run concurrently on the 3090. Living product Comfy no longer shares that GPU (it is on `.141`).

| Mode | GPU owner | Port | Ops |
|------|-----------|------|-----|
| Comfy (default product) | `comfyui` | `:31003` | `start-comfyui-clean.sh` / `systemctl --user start eliteew-comfyui` |
| Deep LLM (Phase 4) | `eliteew-llama-deep` | `:8080` | `bash docker/scripts/eliteew-llama-deep.sh start` (stops Comfy first) |

- Deep start always runs **`stop-comfy`** first (and refuses start if Comfy is still running).
- **`start-comfyui-clean.sh`** refuses start while `eliteew-llama-deep` is running.
- After deep work: `eliteew-llama-deep.sh stop`, then start Comfy again.
- Stack0: `LLAMA_DEEP_URL=http://192.168.1.136:8080` when deep is up; product gate **`EWA_DEEP_LLM_ENABLED`** must be **`1` only while deep runs**, else **`0`** (Config Plane + env-push + stack0 recreate) so companion/agentic do not probe `:8080`. `COMFYUI_URL` remains `:31003` (honest fail while Comfy stopped).
- Firewall: allow prod-core `.111` → `:8080` (rich-rule), same pattern as `:31003`.

Canon: [LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md](../LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md) Phase 4 · [STACK2-LLM-CONTRACT.md](../STACK2-LLM-CONTRACT.md).

### Dual tree (2026-07-16) — clean is live on `:31003`

| | **clean (live)** | **legacy (stopped; keep on disk)** |
|---|------------------|-------------------------------------|
| Source | `/home/owned/podryad/stack2/comfyui-clean` | `/home/owned/podryad/stack2/comfyui` |
| Container | **`comfyui`** | was `comfyui` / do not start in parallel |
| Port | **`:31003`** (prod `COMFYUI_URL`) | — |
| Core | **v0.28.0** | v0.28.0 in-place (broken vendor history) |
| Torch | **2.10.0+cu130** (PyTorch CUDA **13.0** wheels; host UMD **13.3**) | skewed vendor / kitchen fail |
| kitchen / aimdo | **0.2.20 / 0.4.10** | was 0.2.10 → kitchen import fail |
| Persistent venv | `…/comfyui-clean/.container-venv` → `/home/comfy/venv` | image-local (wiped on replace) |
| Models / outputs | shared under `/home/owned/podryad/{models,outputs}/comfyui` (bind → `/opt/ComfyUI/models` and `/opt/ComfyUI/output`) | same |

**Root cause of legacy breakage:** `PYTHONPATH=vendor_packages` + `COMFY_SKIP_VENDOR_SYNC=1` left `comfy_kitchen==0.2.10` without `TensorCoreConvRotW4A4Layout` → fp8/fp4 dead. Host driver **610 / UMD 13.3** is fine; the kill was package skew, not nvidia-smi.

#### Start clean (prod port)

```bash
# once bootstrap if tree missing
podman unshare bash docker/scripts/comfyui-bootstrap-clean.sh
# runtime image (thin CUDA + py3.10 + git); required if localhost/comfyui:latest was pruned
podman build -t localhost/comfyui:latest \
  -f docker/builders/comfyui/Dockerfile docker/builders/comfyui
bash docker/scripts/start-comfyui-clean.sh
# restart later (no pip if pins OK):
podman restart comfyui
# boot autostart (user unit; Linger=yes):
systemctl --user enable --now eliteew-comfyui.service
```

Smoke:

```bash
curl -sf http://127.0.0.1:31003/system_stats
# expect: 0.28.0 / 2.10.0+cu130; kitchen/aimdo match required
podman logs --since 2m comfyui | rg 'IMPORT FAILED|comfy_kitchen|venv pins OK|Starting server'
```

**Why it may not come up after reboot:** user unit `eliteew-comfyui.service` must be **enabled**; `ExecStart` must call `start-comfyui-clean.sh` (legacy `start-punisher-comfyui.sh` is gone → status 203/EXEC). Image `localhost/comfyui:latest` is local-only — if pruned, rebuild via `docker/builders/comfyui/Dockerfile` before start. Entry script must prefer `/home/comfy/venv/bin` on `PATH` (otherwise pin check uses system python and falsely re-pips).

**Boot invariants (clean entry):** pip only on pin mismatch; torch **`2.10.0+cu130`** (kitchen CUDA backend); image includes **git** (ComfyUI-Manager / GitPython); `matplotlib` + `onnxruntime` for controlnet_aux; writable `web/extensions` for Custom-Scripts; root one-shot installs `libx11-6`/`libgl1` before `runuser -u comfy` starts the server.

**CUDA note:** host `nvidia-smi` shows **CUDA UMD 13.3** (driver 610). PyTorch publishes **`cu130`** wheels (toolkit 13.0) — there is no `cu133` wheel tag. After cu130: kitchen `backend cuda` is `available=True, disabled=False`.

**Known non-fatal:** optional `matrix-nio`, `OpenGL_accelerate`; DWPose wants `onnxruntime-gpu` CUDA provider (CPU ort falls back to OpenCV).

Do **not** start a second ComfyUI from the legacy `comfyui/` tree in parallel on `:31003`. Rollback to legacy requires an explicit operator decision and a different container/port plan — not covered as living ops.

## ComfyUI-Manager pip package (required since ComfyUI frontend ~1.44)

New ComfyUI builds use **`--enable-manager`** and require the **PyPI** package `comfyui_manager` **≥ 4.2.1**, not only the legacy git custom node `custom_nodes/comfyui-manager` (v3.x).

| Artifact | Path |
|----------|------|
| Pin file | `/home/owned/podryad/stack2/comfyui-clean/manager_requirements.txt` (`comfyui_manager>=4.2.1`; legacy tree may still have a copy under `comfyui/`) |
| Container start | `comfyui-container-start.sh` — installs `manager_requirements.txt` when missing/outdated |
| Host pre-stage | `start-comfyui-clean.sh` — `pip install --target vendor_packages` before `podman run` |

Manual upgrade (same as UI message):

```bash
python3 -m pip install --target /home/owned/podryad/stack2/comfyui-clean/vendor_packages \
  -r /home/owned/podryad/stack2/comfyui-clean/manager_requirements.txt
bash docker/scripts/start-comfyui-clean.sh
```

Verify on host:

```bash
PYTHONPATH=/home/owned/podryad/stack2/comfyui-clean/vendor_packages \
  python3 -c "import importlib.metadata as md; print(md.version('comfyui_manager'))"
```

Expected: `4.2.1` or newer (e.g. `4.2.2`).

## Models host layout

Live models are **only** under the shared host bind (the in-tree `comfyui-clean/models/*` stubs are shadowed by the mount):

| Host path | Container path | Notes |
|-----------|----------------|-------|
| `/home/owned/podryad/models/comfyui/` | `/opt/ComfyUI/models/` | Shared across clean/legacy trees |
| `…/geometry_estimation/` | `…/geometry_estimation/` | MoGe / geometry nodes — e.g. `moge_2_vitl_normal_fp16.safetensors` |
| `/home/owned/podryad/outputs/comfyui/` | `/opt/ComfyUI/output/` | Generated artifacts |

Parent `models/comfyui` is often owned by container UID `525287`. Creating a new folder from the host user may need:

```bash
podman exec -u root comfyui mkdir -p /opt/ComfyUI/models/geometry_estimation
podman exec -u root comfyui chmod 1777 /opt/ComfyUI/models/geometry_estimation
# then copy/move weights as the host user into that directory
```

After adding weights, refresh the model list in the ComfyUI UI (restart usually not required).

## Custom nodes (curated, not read-only)

**Why installs failed before:** `user/__manager/config.ini` had `network_mode = offline` and `comfyui-container-start.sh` exported `COMFYUI_MANAGER_NETWORK_MODE=offline`. Manager UI could list nodes but not install. Rootless bind also needs writable `custom_nodes/` (`chmod 1777` on host).

**Curator script** (idempotent):

```bash
bash docker/scripts/comfyui-curate-custom-nodes.sh
bash docker/scripts/start-comfyui-clean.sh
```

Removes bloat (incl. **ComfyUI-Crystools**), keeps EliteEW image essentials + verified helpers:

| Directory | Publisher | Role |
|-----------|-----------|------|
| `comfyui_controlnet_aux` | Fannovel16 | ControlNet preprocessors |
| `rgthree-comfy` | rgthree | Context / routing utilities |

`ComfyUI-Impact-Pack` (ltdrdata) is **not** in the default set — it pulls SAM2 from git and slows container start on `.136`. Install via Manager UI when needed.

Manager config after curation: `network_mode = public`, `allow_git_url_install = True`, `allow_pip_install = True`, `security_level = normal`.

Image core nodes (e.g. `TextEncodeQwenImageEditPlus`, `ComfySwitchNode`, …) ship in ComfyUI core (`comfy_extras/`) — no custom node required.

## Garbage / glitch image outputs (HTTP success, VRAM stuck)

**Symptom (2026-07-22):** Image Studio / EWRP / Site Studio `01_top` (z-image-turbo) returns PNG with horizontal soup / grid noise while UGS still reports `completed`/`success`. Sampler logs show `100%|4/4`. Last coherent `site_studio_01_top_*` samples were ~2026-07-15; after `comfyui-clean` + long-lived process, GPU held ~20 GiB idle (`nvidia-smi` Comfy python).

**Cause layer:** Comfy process VRAM / dynamic `--lowvram` weight staging stuck — not broken Image Studio JSON. Fresh restart + smoke (`red apple…` via `/prompt` on `01_top.json`) restored a normal photo.

**Operator fix:**

```bash
ssh 192.168.1.136 'podman restart comfyui'
# wait until:
curl -sf http://127.0.0.1:31003/system_stats
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
# expect memory.used low hundreds of MiB before the next gen
```

If garbage returns after heavy ACE/music + image mix on the same 3090, restart again; consider dropping `--lowvram` on 24 GB for image-only windows (explicit ops change — not default yet).

## Site Studio stills — Flux.2 Klein (not `01_top`)

Command-center Comfy on this 3090 already holds **Flux.2 Klein 4B distilled** (`models/diffusion_models/flux-2-klein-4b-fp8.safetensors`, CLIP `qwen_3_4b.safetensors` type `flux2`, VAE `flux2-vae.safetensors`). Public-buyer illustrations used that stack successfully (4 steps / CFG 1 / euler / `ConditioningZeroOut`).

z-image-turbo (`01_top`) is native **1024×1024**. Site Studio heroes/portraits need 16:9 and 3:4 — turbo non-square latents become soup and fake letters.

| Artifact | Path |
|----------|------|
| Product API graph (UGS) | `host/comfyui/site_studio_photo.json` → `/app/comfyui` in stack0 |
| Live Comfy Load (API) | `/home/owned/podryad/stack2/comfyui-clean/user/default/workflows/site_studio_photo.json` |
| Live Comfy UI subgraph | `…/workflows/site_studio_photo_ui.json` (official Klein T2I template, unet patched to local fp8) |

Sampler contract (do not overwrite from Site Studio `steps=20`): **Flux2Scheduler 4**, **CFGGuider 1**, **euler**. Width/height go to **both** `EmptyFlux2LatentImage` and `Flux2Scheduler` (step 16). Seed is `RandomNoise.noise_seed`.

EWRP / Image Studio stay on `01_top`. Do not queue Klein and z-image plus ACE on the same 3090 without a Comfy restart if outputs turn to grid noise.

## Stuck `comfyui` container (`Stopping`, `operation not permitted`)

**Cause (2026-06-22):** `--security-opt no-new-privileges` on the ComfyUI container blocked `podman stop` / SIGKILL (`send signal to pidfd: Operation not permitted`). Removed from `start-comfyui-clean.sh`; recreate once if an old container still has the flag.

If `podman rm -f comfyui` fails while port `:31003` still answers, the pasta/conmon process is wedged. From an **interactive operator shell** on `.136`:

```bash
podman ps -a --filter name=comfyui
podman stop -t 0 comfyui || true
podman rm -f comfyui || true
# last resort: identify pasta pid — ss -ltnp | rg 31003 — then kill from the same user session
bash docker/scripts/start-comfyui-clean.sh
```

After recreate, reload ComfyUI in the browser (hard refresh). The Manager upgrade banner should disappear when `comfyui_manager` ≥ 4.2.1 loads at process start.

## Related

- `docker/scripts/start-comfyui-clean.sh`
- `documentation/platform/PRODUCTION-TOPOLOGY-STATE.md` §Current (living ComfyUI on `.141`)
- Prod API `COMFYUI_URL` must reach `.141:31003`; `.136:31003` is explicit rollback only
