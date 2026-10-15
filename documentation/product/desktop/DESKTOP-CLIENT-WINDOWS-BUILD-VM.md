# Desktop Client — Windows build VM (`eliteew-win11-build`)

**Status:** living ops canon (command-center).
**Product contract:** [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md).
**Rule:** `.cursor/rules/desktop-client-windows-build.mdc`.
**Skill:** `eliteew-desktop-client-windows`.

## Purpose

Permanent **Windows 11 Pro** libvirt guest used as the EliteEW **NSIS build horse** for `pack-organization/connection-agent/`. Builds run **headless over SSH** from command-center (`.136`) — no guest UI for routine sync/build/pull/harden.

This is **not** cloud prod-core topology and **not** a second product tree. Edition context: **client** packaging (Windows installer) over the same desktop-client sources.

## Packaging policy (HARD — 2026-08-10)

| Artifact | When to build / publish |
|----------|-------------------------|
| **Linux RPM** | Default for every OTA / release wave (`desktop-client-ota-release.sh --rpm-only`, `bundle.sh --bundles rpm`) |
| **AppImage** | Only on **explicit** operator request in the current message (product paused otherwise) |
| **Windows NSIS / EXE** | Only for **major** version cuts, and only after **explicit operator approval** |
| **`eliteew-win11-build` VM** | Powered **off** when idle; do not leave running after an approved Windows wave |

Routine patch/minor OTA (example **0.4.63**): **RPM default**; Windows EXE only on explicit operator ask.

## Inventory

| Item | Value |
|------|--------|
| Libvirt URI | `qemu:///system` |
| Domain | `eliteew-win11-build` |
| Disk / ISO root | `/up_back/vms/eliteew-win11-build/` |
| Guest DHCP (typical) | `192.168.122.15` (`windev`) |
| Build user | `jobst` (Administrators; elevated SSH OK) |
| License | Windows 11 Pro, **retail**, activated |
| SSH key (host) | `~/.ssh/eliteew_win11_build_ed25519` |
| Guest work root | `C:\Users\jobst\eliteew\` (`desktop-client`, `packages`, `host/kernel-offline`, `out`, `logs`, `scripts`) |
| Guest resources (living) | **10 vCPU** / **20 GiB** RAM; CPU topology `sockets=1,cores=10,threads=1` (`host-passthrough`) — raised 2026-08-08 from 6/12 GiB so cargo can use host capacity |
| Handoff artifacts | `docker/data/portal-private-tunnel/handoff-pilot/nsis-<ver>/` |

## Distribute modes (Windows)

| Mode | First install | In-app OTA | When |
|------|---------------|------------|------|
| **handout** | NSIS `.exe` via out-of-band handoff (`handoff-pilot/nsis-<ver>/`) | Optional (same binary may also be on OTA) | First install / offline USB; SmartScreen may warn if no Authenticode |
| **ota-updater** (**live 0.4.17+**) | Same handout **or** prior install | `windows-x86_64` in `latest.json` with Tauri **updater** `.sig` | Post-sign NSIS with `tauri signer sign` + `desktop-client-publish-update.sh --nsis` (same updater key as RPM) |
| **authenticode** (optional) | NSIS + org `signtool` / Tauri windows cert fields | Independent of updater `.sig` | Customer/ops cert available — reduces SmartScreen friction |

**Living (2026-08-13):** public Connected + FoFline **0.4.63 RPM-only**. Last dual-OS `windows_x86_64` ship was **0.4.61**. Host release builds require capsule env forwarded into the guest (see `build` row).

**Do not:** publish NSIS to `/desktop-client-updates/` without updater `.sig` (client fail-closed / forged “signed”).
**Do not:** claim Authenticode in UI when shipping unsigned OS code-sign.

Publish (merge-safe):

```bash
# Linux RPM (AppImage paused — re-enable only when product asks)
bash scripts/eliteew/desktop-client-publish-update.sh \
  --version 0.4.19 --rpm …/rpm --sig …/rpm.sig

# Windows — same version merges platforms (keeps linux-x86_64-rpm)
bash scripts/eliteew/desktop-client-publish-update.sh \
  --version 0.4.19 --nsis …/setup.exe --sig …/setup.exe.sig

bash scripts/eliteew/desktop-client-publish-update-selftest.sh
```

## Toolchain (keep)

| Component | Notes |
|-----------|--------|
| OpenSSH Server | Auto-start; firewall allow `192.168.122.0/24:22` |
| Node.js LTS + pnpm | `packageManager` pin from `pack-organization/connection-agent/package.json` (**pnpm 11.20.0+**; guest: `corepack prepare pnpm@11.20.0 --activate`) |
| Rust stable-MSVC | `rustup default stable-msvc` |
| VS 2022 Build Tools | VC Tools workload; VsDevCmd imported by remote build |
| Edge WebView2 | Required by Tauri |
| WireGuard MSI (embed) | Host SoT `bash pack-organization/connection-agent/packaging/windows/fetch-wireguard-msi.sh` before sync (gitignore MSI; pin in `src-tauri/windows/wireguard/VERSION.json`). Optional thin alias: `pack-organization/connection-agent/scripts/fetch-wireguard-msi.sh` → same packaging script. NSIS `perMachine` + `windows/hooks.nsh` silent install if missing. |

Do **not** remove these in harden scripts.

## Host CLI (tracked)

```bash
# Prefer tracked wrapper (git):
bash scripts/eliteew/desktop-client-build-windows-remote.sh setup|harden|sync|build|pull|poweroff|test|ssh

# Implementer (outside git tree):
bash /up_back/vms/eliteew-win11-build/scripts/05-remote-windows-build.sh …
```

| Subcommand | Effect |
|------------|--------|
| `setup` | Push guest scripts; OpenSSH defaults; work dirs; pnpm `onlyBuiltDependencies` hint |
| `harden` | Debloat/telemetry/widgets; Defender exclusions; High performance power |
| `sync` | Tar `pack-organization/connection-agent` + `shared/packages` + `host/kernel-offline` → guest `eliteew\{…}`; **preserves** `desktop-client\src-tauri\target` across sync (incremental Rust — avoids cold rebuild every time) |
| `build` | `setup` scripts + sync + `REMOTE-BUILD.ps1` + pull NSIS; **live** compile lines stream to `remote-build.log`; `CARGO_BUILD_JOBS=min(cpus, ramGb-4)` (guest **10**/20 GiB → jobs **10**); optional `rust-lld` if `llvm-tools-preview` installs (guest DNS to static.rust-lang.org may fail → MSVC `link.exe` fallback). **Requires** host env `ELITEEW_DESKTOP_CAPSULE_SIGNING_PK` (Wave 4: shared `ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK` no longer required/forwarded; never log signing material). Failed builds **do not** pull stale NSIS renamed to the tree version. **Default:** after successful pull, ACPI **`virsh shutdown`** → wait for **`shut off`** (hard `destroy` if timeout). Opt-out: `ELITEEW_WIN_POWEROFF_AFTER_PULL=0`. |
| `build-fofline` | Same pipeline with `ELITEEW_WIN_PNPM_SCRIPT=build:windows:fofline` + artifact prefix `EliteEW-FoFline`; handoff default `handoff-pilot/nsis-fofline-<ver>/`. FoFline OTA channel is `/fofline-updates/` (not desktop-client). |
| `pull` | `scp` `eliteew\out\EliteEW-Desktop-Client-<ver>-x64-setup.exe` → handoff; **same default poweroff** after successful scp |
| `poweroff` | Host-side full poweroff only (`virsh shutdown` → wait → `destroy` fallback) — no build |
| `test` | Passwordless SSH smoke **+** toolchain probe (node/pnpm/rustc/cargo + `eliteew` work root) — **no** NSIS rebuild; starts VM if shut off |
| `ssh` | Interactive session |

**Poweroff contract (2026-08-08):** after a successful NSIS artifact pull (`build` or `pull`), the guest is powered **fully off** (libvirt state `shut off` / `выключен`), not left idle. Prefer ACPI `virsh shutdown`, then `destroy` only on timeout. Host `virsh` may print RU locale (`работает` / `выключен`) — scripts match both. Keep VM up only with `ELITEEW_WIN_POWEROFF_AFTER_PULL=0`.

**Tracked regression gate (command-center, no rebuild):**

```bash
bash scripts/eliteew/desktop-client-windows-smoke.sh
# expect: SSH_OK, TOOLCHAIN_OK, PASS
```

Full NSIS remains explicit: `…/desktop-client-build-windows-remote.sh build` (not part of this smoke).

SSH key bootstrap (one-time, if keys missing):

```bash
bash /up_back/vms/eliteew-win11-build/scripts/04-ssh-pubkey-iso.sh   # ISO ELITEEWSSH → sdb
# Guest once: RUN-INSTALL-SSH-KEY.bat (Admin)
bash /up_back/vms/eliteew-win11-build/scripts/04-ssh-pubkey-iso.sh test
```

## Guest scripts (`/up_back/vms/eliteew-win11-build/scripts/`)

| Script | Role |
|--------|------|
| `REMOTE-SETUP-ONCE.ps1` | sshd, DefaultShell=PowerShell, dirs |
| `REMOTE-HARDEN-BUILDVM.ps1` | Pro build-horse harden (idempotent) |
| `REMOTE-BUILD.ps1` | VsDevCmd + `pnpm install` + `pnpm run ${ELITEEW_WIN_PNPM_SCRIPT:-build:windows}` → `eliteew\out\<ELITEEW_WIN_ARTIFACT_PREFIX>-<ver>-x64-setup.exe`; **streams** cargo/NSIS lines into `remote-build.log` while running |
| `REMOTE-SYNC-EXTRACT.ps1` | Extract uploaded tar; **keeps** prior `src-tauri\target` (incremental) |
| `REMOTE-SMOKE.ps1` | SSH + toolchain probe for `test` / `desktop-client-windows-smoke.sh` |
| `ENABLE-SSH.ps1` / `INSTALL-SSH-KEY.ps1` | Legacy/CD path for first SSH |

## Harden contract

`harden` **must**:

- Set `AllowTelemetry=0`; disable `DiagTrack`, CEIP tasks, WER where possible
- Disable Widgets/Feeds/Copilot policies; strip consumer AppX (Xbox, Bing*, Clipchamp, Teams, YourPhone, Feedback, Solitaire, …)
- Disable `WSearch`, `SysMain` (IO noise on build VM)
- Add Defender exclusions under `eliteew`, `.cargo`, `.rustup`, node/pnpm caches
- Activate High performance power; no AC sleep

`harden` **must not**:

- Disable OpenSSH / break libvirt NAT firewall rule for `:22`
- Remove Node, Rust, VS Build Tools, WebView2
- Disable Windows Update entirely (optional Manual is OK)
- Require guest UI / interactive UAC for routine runs (SSH session is Admin)

Residual system packages (e.g. `XboxGameCallableUI`) may remain if Windows blocks removal — ignore if build path unaffected.

## Why a Windows build can look “idle”

| Symptom | Cause | Fix (living) |
|---------|--------|--------------|
| Host SSH shows no new lines for many minutes | Old `REMOTE-BUILD` buffered **all** cargo/NSIS output until the bat exited (and could hang on PowerShell `-RedirectStandard*`) | Live stream into `remote-build.log` while compiling |
| Guest CPU looks low after sync | Sync used to **wipe** `src-tauri\target` every time → full cold compile; long link/IO phases ≠ flat 100% CPU | Preserve `target` across sync |
| Only ~half host cores busy | Guest was **6 vCPU** / 12 GiB without topology → Windows under-counted CPUs | Living: **10 vCPU** / **20 GiB** + `topology cores=10`; `REMOTE-BUILD` sets `CARGO_BUILD_JOBS=min(cpus, ramGb-4)` and prefers `rust-lld` when `llvm-tools-preview` is installed |
| Live progress | `Get-Content …\eliteew\logs\remote-build.log -Wait` on guest, or re-`scp` the log from host | Prefer live log over guessing from Task Manager alone |

### More CPU for the EXE build (operator)

Cargo already parallels by default up to guest logical CPUs (`CARGO_BUILD_JOBS` / `build.jobs`). Bottlenecks on this horse:

1. **Give the guest more vCPU/RAM** (libvirt) — host has 12 cores; guest should stay ≤10 with topology set so Windows sees all cores.
2. **Keep `src-tauri\target`** across sync (already in `REMOTE-SYNC-EXTRACT.ps1`).
3. **`rust-lld`** via `rustup component add llvm-tools-preview` — faster link than MSVC `link.exe` (REMOTE-BUILD auto-enables when present).
4. Do **not** blindly set jobs ≫ RAM/2 on Windows — MSVC `link.exe` can OOM (Cargo book / community: cap parallelism when RAM is tight).

Resize example (guest **off**):

```bash
sg libvirt -c 'virsh -c qemu:///system setmaxmem eliteew-win11-build 20971520 --config'
sg libvirt -c 'virsh -c qemu:///system setmem eliteew-win11-build 20971520 --config'
sg libvirt -c 'virsh -c qemu:///system setvcpus eliteew-win11-build 10 --config --maximum'
sg libvirt -c 'virsh -c qemu:///system setvcpus eliteew-win11-build 10 --config'
sg libvirt -c 'virt-xml eliteew-win11-build --connect qemu:///system --edit --cpu host-passthrough,topology.sockets=1,topology.cores=10,topology.threads=1'
sg libvirt -c 'virsh -c qemu:///system start eliteew-win11-build'
# Guest must report NUMBER_OF_PROCESSORS=10
```

## Brand icons (desktop-client)

Native shell / NSIS / RPM icons come from `src-tauri/icons/` (Tauri bundle). **Do not** run bare `tauri icon` alone for Linux retail — that flattens the dual-asset rule.

```bash
cd pack-organization/connection-agent
# SoT: pack-organization/connection-agent/src-tauri/app-icon-src/logo.png → transparent tray + plated app-grid hicolor
bash packaging/linux/regenerate-icons.sh
# Optional thin alias (same behavior):
# bash pack-organization/connection-agent/scripts/regenerate-icons.sh
```

- Tray/window: transparent (`icon.png`, `32×32`, ico/icns).
- App-grid (Fedora GNOME/KDE): soft ink plate on `{48,64,96,128,256,512}`.
- Launcher chrome mark: `public/brand-mark.png` (same logo, 512²).

Rebuild installers after icon change.

## Source invariants (Windows `tsc` / cargo)

Keep these in `pack-organization/connection-agent/` so headless builds stay green:

- `tsconfig.json` **excludes** `*.test.ts` / `*.test.tsx` / `*.contract.test.ts` from app `tsc` (Vitest uses `node:fs`)
- `package.json` → `pnpm.onlyBuiltDependencies: ["esbuild"]` (non-interactive native postinstall)
- Linux-only WG consts in Rust: `#[cfg(unix)]` so MSVC does not warn unused

## Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Guest down / no SSH → host CLI fails closed; no silent “success”. UI not required for build. After Windows Update reboot, prefer `REMOTE-SMOKE.ps1` via DefaultShell + Process Bypass — nested `powershell.exe` may fail `.NET ServicePointManager` init. |
| **Dual-flag** | N/A for build CLI. Do not invent a second Windows build host without updating this doc. |
| **Permission** | SSH key only from libvirt NAT; guest firewall `192.168.122.0/24:22`. Default deny wider nets. |
| **Regression** | `bash scripts/eliteew/desktop-client-windows-smoke.sh` (SSH + toolchain). Full NSIS: `…/desktop-client-build-windows-remote.sh build` → `ARTIFACT=` + handoff sha256. |

## Agent rules of engagement

1. **Prefer SSH remote path** over virt-viewer / ISO/CD for routine NSIS rebuilds.
2. Do **not** treat guest UI polish as the delivery path.
3. Do **not** recreate soft-retired product trees for Windows packaging.
4. After behavior/ops changes to this VM workflow → update **this** doc same phase (`eliteew-doc-sync`); keep Tauri product doc as pointer + product waves.
5. Secrets: no license keys / passwords in git docs; point to host key path only.

## Related

- Product waves / OTA / WG: [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md)
- Editions / client pack: [`../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md`](../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md)
- Command-center role: [`../../platform/PRODUCTION-TOPOLOGY-STATE.md`](../../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current (build host `.136`; this VM is local libvirt on that host, not a public stack)
