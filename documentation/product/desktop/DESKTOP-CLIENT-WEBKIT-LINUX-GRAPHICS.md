# Desktop-client · WebKitGTK Linux graphics (1-core lag)

**Status:** living canon (2026-08-09)
**Edition:** client (native Tauri on Linux)
**Related product:** [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) §WebKitGTK
**Code:** `pack-organization/connection-agent/src-tauri/src/webkit_linux.rs`, `linux_runtime_noise.rs`

## Terminal log noise (not product failures)

| Noise | Layer | Retail behavior (0.5.11+) |
|-------|-------|---------------------------|
| `libsoup-WARNING` · `soup_hsts_policies` · `readonly database` | WebKitGTK HSTS SQLite under `~/.local/share/<identifier>/WebKitCache` opened read-only or raced during init | Binary ensures app data + cache dirs are owner-writable at start; GLib filter suppresses known-harmless HSTS init warnings |
| `Failed to create hard link` · `WebKitCache/.../Blobs` → `Records` | WebKit cache dedup on FS without hard-link support (copy fallback) | Harmless — page load continues; not an EliteEW defect |
| `[STEP] fofline_native_http socks_proxy applied` every heartbeat | Native HTTP client rebuilt per request | Logged **once per process** when W-transport SOCKS is active |
| `[STEP] w_transport_wg_decap_skip err=DuplicateCounter` | boringtun ignores duplicate UDP counters | Expected on busy tunnel — no longer logged |

Poet/dev seats on **0.5.10** may still see the full spam until the next RPM OTA ships this wave.

## Symptom (what the seat sees)

| Observable | Typical meaning |
|------------|-----------------|
| Idle OK, UI interaction / open «Ассистент» → **~100% of one CPU core**, heavy lag | Software / SHM paint path, not “Rust busy” |
| Wayland debug: endless `wl_shm.create_pool` + full-window `damage` (~80–90 ms) | CPU shared-memory buffers for every frame |
| Network DEBUG (libsoup) alone | **Not** sufficient proof of 1-core cause — companion polls are normal |
| Tray **Выйти** → KDE/systemd coredump `WebKitWebProcess` SEGV in `__eglFini` / `eglDestroyContext` | Host exited while WebProcess still tearing down Mesa EGL (not a broken Quit menu) |

## Cause layers (ordered)

Do **not** jump to SPA animations first. Confirm graphics env from binary stderr.

### Layer A — `WEBKIT_DISABLE_COMPOSITING_MODE=1` (software compositing)

- **Log:** `DMABUF=1 + COMPOSITING_MODE=1 (escalate…)` or sticky `~/.local/share/world.empery.desktop.client/webkit_graphics_compositing_off`
- **Effect:** classic 1-core software compositor
- **How we got there historically:**
  1. **0.4.7** forced compositing-off for everyone
  2. **0.4.8–0.4.9** false escalate: `main()` + `run()` both called `apply_webkit_graphics_mitigation()`; first write of `webkit_session.marker`, second pass treated it as unclean exit → sticky every launch (**fixed 0.4.10**, process-once guard)
  3. **Real leftover marker** after Ctrl+C / kill / WAYLAND_DEBUG stop without tray **Выйти** → sticky (**mitigated 0.4.11**: sticky only after **≥2** unclean without clean Exit; SIGINT/SIGTERM/SIGHUP clear marker)

### Layer B — `WEBKIT_DISABLE_DMABUF_RENDERER=1` alone (SHM / readback)

- **Log:** `WEBKIT_DISABLE_DMABUF_RENDERER=1 (GPU compositing kept)` **without** `COMPOSITING_MODE=1`
- **Effect:** GPU compositing “kept” but buffers still go through **slow SHM/readback** → same ~1-core / `wl_shm` storm under UI
- **Seat proof (2026-08-08):** after sticky cleared, lag remained; `ELITEEW_WEBKIT_ALLOW_DMABUF=1` → smooth
- **How we got there:** retail binary **and** `.desktop` `Exec=… WEBKIT_DISABLE_DMABUF_RENDERER=1` forced DMABUF-off for Mesa blank-window class (**removed as default in 0.4.11**)

### Layer C — tray Quit / host exit SEGV in `WebKitWebProcess` (`__eglFini`)

- **Evidence:** coredump stack `exit` → `__eglFini` → `malloc` corruption; parallel thread `eglDestroyContext` → `WebCore::GLContext::~GLContext` / Skia
- **Cause:** tray called `app.exit(0)` while WebKitWebProcess still owned live EGL; Mesa fini races destructor
- **Not fixed by:** forcing DMABUF-off / compositing-off for all seats (Layer A/B anti-patterns; regresses FPS)
- **Retail fix (tree):** `tray::request_quit` — RFC 7009 revoke (while W-transport still up) → set quitting flag → `WebviewWindow::destroy()` (non-main first, then `main`) → short drain → `app.exit(0)`; Hub/product `CloseRequested` calls `request_quit` (not hide-to-tray); `RunEvent::ExitRequested { code: None }` → `prevent_exit` so last-window destroy does not skip the drain (Tauri 2.11 has no `exitOnLastWindowClose` conf key)
- **Code:** `pack-organization/connection-agent/src-tauri/src/tray.rs`, `lib.rs` window + run events

## How it is solved (retail, 0.4.11+)

| Path | Behavior |
|------|----------|
| **Default** | Clear `WEBKIT_DISABLE_DMABUF_RENDERER` and `WEBKIT_DISABLE_COMPOSITING_MODE` — **DMA-BUF on** |
| **Escalate** | Only after **≥2** unclean exits without tray Quit / `RunEvent::Exit` → sticky + DMABUF-off **and** COMPOSITING_MODE=1 |
| **Tray Quit** | Orderly webview destroy + drain before `app.exit` (Layer C) — do **not** bare-exit over live WebProcess |
| **Signals** | SIGINT/SIGTERM/SIGHUP unlink session marker (async-signal-safe) so debug Ctrl+C ≠ crash escalate |
| **`.desktop`** | W-transport default only — **no** forced `WEBKIT_*`, **no** updater pubkey in Exec (Root of Trust is baked) |
| **Migrations** | One-shot clear of poisoned sticky: `webkit_false_escalate_cleared_0_4_10`, `webkit_escalate_policy_0_4_11` |

Ops-only env (not for end users):

| Env | Meaning |
|-----|---------|
| `ELITEEW_WEBKIT_ALLOW_DMABUF=1` | Force DMA-BUF path (clear poison); A/B on older RPM |
| `ELITEEW_WEBKIT_FORCE_DMABUF_OFF=1` | DMABUF-off only (blank-window class), compositing kept |

## How **not** to do it

| Anti-pattern | Why |
|--------------|-----|
| Force `WEBKIT_DISABLE_COMPOSITING_MODE=1` for all seats | Guarantees 1-core software path |
| Force `WEBKIT_DISABLE_DMABUF_RENDERER=1` for all seats “just in case” | Causes Layer B lag on modern WebKitGTK/Wayland |
| Call `apply_webkit_graphics_mitigation()` twice without process-once guard | False unclean escalate (0.4.8–0.4.9) |
| Escalate sticky on **every** leftover `webkit_session.marker` | Ctrl+C / debug poisons the seat forever |
| Put `WEBKIT_*` in `.desktop` Exec for retail | Overrides binary policy; hard to A/B; survives “GPU kept” narratives |
| “Fix” 1-core by rewriting companion CSS first | Symptom lock without graphics evidence |
| Ask end users to set WebKit env by hand | Violates user-product obligations — binary must apply policy |

## What **not** to change lightly

| Keep | Reason |
|------|--------|
| Process-once `APPLY_DONE_THIS_PROCESS` | Prevents double-apply false escalate |
| Escalate only after repeated unclean (**≥2**) | Distinguishes debug kills from crash loops |
| Default **DMA-BUF on** | Proven seat relief for Layer B |
| Sticky + full escalate as **last resort** | Blank/crash seats still need a survival path |
| In-binary mitigation (no retail shell) | Product obligation |
| Tray Quit / `end_webkit_session` clearing strikes | Clean exit forgives unclean count |
| Orderly webview destroy before `app.exit` on Quit | Prevents Mesa `__eglFini` SEGV noise on Fedora/KDE |
| `ExitRequested { code: None }` → `prevent_exit` | Tray drain after last window destroy (Tauri 2.11) |
| In-app «Вернуть плавность» (`webkit_graphics_reset`) | Clears sticky + strikes without shell `rm`; restart applies GPU path |
| Transparent brand icons (no dark plate on **tray**) | Opaque tray plate made KDE/GNOME tray a black square; regenerate via `packaging/linux/regenerate-icons.sh` (plated app-grid OK) |
| Binary-owned `WEBKIT_*` policy (not `.desktop`) | Desktop Exec overrides are sticky ops debt |

## User recovery (no shell)

When sticky escalate is active (or this process already set `WEBKIT_DISABLE_COMPOSITING_MODE=1`), the shell updater strip shows **«Вернуть плавность»**:

1. `webkit_graphics_status` → `recovery_available`
2. `webkit_graphics_reset` clears `webkit_graphics_compositing_off` + `webkit_unclean_strikes`
3. `app_restart` so the next launch keeps DMA-BUF / GPU compositing

Ops forensic clear under `~/.local/share/world.empery.desktop.client/` remains for labs only — **not** the retail path.

## Icons (tray + KDE/GNOME app chrome)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tray icon = solid black square on dark panel | Opaque dark plate under brand mark (0.4.10 Fedora grid experiment) | Transparent tray SoT (`icon.png` / `32×32`); regenerate via `packaging/linux/regenerate-icons.sh` |
| App launcher still shows old/generic/blank icon on Fedora | Broken near-empty `brand-mark.png` SoT + fully transparent hicolor looked invisible; stale icon cache | SoT `pack-organization/connection-agent/src-tauri/app-icon-src/logo.png`; **plated** hicolor 48+; `%post` cache refresh + touch; log out/relogin if DE still caches |
| Hand-edit one size in `icons/` | Drift vs SoT | Always run `packaging/linux/regenerate-icons.sh` |

**Dual asset rule:** tray/window stay transparent; app-grid sizes use a soft ink rounded plate (not pure `#000` square). Do not plate the tray icon.

## Operator / agent A/B (debug only)

1. Prefer retail: shell **«Вернуть плавность»** (clears sticky + restart) — not seat `rm`.
2. Tray **Выйти** (not Ctrl+C) when forcing a clean session end.
3. Lab-only clear of escalate artifacts:
   `webkit_graphics_compositing_off`, `webkit_session.marker`, `webkit_unclean_strikes` under `~/.local/share/world.empery.desktop.client/`.
4. Launch from terminal and read `[STEP] webkit_linux:` lines.
5. If log shows DMABUF-off with compositing kept and lag remains → Layer B; confirm with `ELITEEW_WEBKIT_ALLOW_DMABUF=1` on **pre-0.4.11** builds.
6. Prefer Wayland `wl_shm` storm evidence over libsoup poll spam when proving paint path.

## Failure / edge matrix

| Axis | Behavior |
|------|----------|
| Offline-mode | Graphics policy is local; OTA not required for env A/B; recovery CTA works offline |
| Dual-flag | OTA install/restart CTAs win over graphics recovery in updater strip; `ELITEEW_WEBKIT_ALLOW_DMABUF` wins over `FORCE_DMABUF_OFF` |
| Permission | No elevated rights; flags under user data dir |
| Regression | `cargo test --lib webkit_linux linux_runtime_noise`; contracts `linuxGraphicsAutoApply.contract.test.ts`, `trayQuitOrderly.contract.test.ts` |

## Version trail

| Version | Change |
|---------|--------|
| 0.4.7 | Forced compositing-off (bad default) |
| 0.4.8 | Intended DMABUF-only; still double-apply bug |
| 0.4.10 | Process-once + unpoison false sticky; still default DMABUF-off |
| **0.4.11** | Default DMA-BUF on; strike≥2 escalate; signal marker clear; no WEBKIT in `.desktop`; transparent icons; **OTA live** `linux-x86_64-rpm` |
| **0.4.12** | Modular launcher chrome (split CSS + LauncherHero/StepRail + CTA card); WebKit defaults unchanged from 0.4.11; **OTA live** `linux-x86_64-rpm` |
| **0.4.13** | Fluid launcher width (≥720px `--dc-shell-max: 100%` + 2-col journeys); WebKit unchanged from 0.4.11; **OTA live** `linux-x86_64-rpm` |
| **0.4.14** | Professional full-top launcher chrome (accent hairline, framed step-rail, elevated panels/CTA); **OTA live** `linux-x86_64-rpm` |
| **0.4.15** | Stage motion + status banners + rail track; WebKit unchanged; **OTA live** `linux-x86_64-rpm` |
| **0.4.16** | Ultrawide ≥3-col launcher stage; dual icons (transparent tray + plated app-grid from `pack-organization/connection-agent/src-tauri/app-icon-src/logo.png`); **OTA live** `linux-x86_64-rpm` |
| **0.4.17** | Shell dashboard (status rail + quiet updater states + catalog/profile); ultrawide landmark-safe nested asides; **OTA live** `linux-x86_64-rpm` + `windows-x86_64` |
| **0.4.18** | NSIS embeds WireGuard for Windows MSI (`perMachine` + silent msiexec); **OTA live** `linux-x86_64-rpm` + `windows-x86_64` |
| **0.4.19 (tree)** | In-app WebKit sticky recovery CTA (`webkit_graphics_*` + «Вернуть плавность»); ships with next OTA (parallel native-audio WIP) |
| **0.4.45+ (live)** | Layer C: tray Quit orderly webview destroy + drain + `ExitRequested` prevent when `code: None` — public RPM OTA includes Fedora Quit coredump relief |
