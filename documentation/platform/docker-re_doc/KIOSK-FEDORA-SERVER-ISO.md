# Kiosk Fedora Server ISO

Unattended (pilot) install media for EliteEW **portal kiosk** devices: local SPA + nginx reverse-proxy to `wg-portal` edge, cage + Chromium.

## Decisions

| | |
|--|--|
| Base | Fedora Server DVD x86_64 44 (operator-owned file, e.g. `/home/owned/Fedora-Server-dvd-x86_64-44-1.7.iso`) |
| Method | `mkksiso` (package `lorax`) injects kickstart + payload into a **copy** of the DVD |
| Workspace | Monorepo path `pack-organization/kiosk-fedora-iso/` — **gitignored**, not in `.cursorignore` |
| Payload | nginx + `eliteew-kiosk` launcher + SPA from `shared/web/frontend/dist-build` |
| Secrets | **No** WireGuard peer / `.env` in the ISO |

Related runtime canon: [PORTAL-PRIVATE-TUNNEL-EDGE.md](PORTAL-PRIVATE-TUNNEL-EDGE.md) §Kiosk, examples under `docker/scripts/portal-private-tunnel/`.

**Not the same SKU:** sealed from-source bare-metal carrier is [ELITEEW-TRUSTED-SUBSTRATE.md](../../product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) (`pack-organization/trusted-substrate/`). Do not merge Fedora Chromium kiosk with Trusted Substrate factory.

## Wipe warning

Kickstart uses `zerombr` + `clearpart --all` + `autopart`. Booting this ISO on a machine **erases the install disk** with little or no confirmation (mkksiso adds `inst.ks=`). Pilot / dedicated kiosk hardware only.

## Build (command-center)

```bash
cd <repo>/pack-organization/kiosk-fedora-iso
cp -n config.env.example config.env
# optional: edit BASE_ISO / SPA_DIST
bash pack-organization/command-center-image/scripts/prepare-payload.sh
bash pack-organization/command-center-image/scripts/build-iso.sh
bash pack-organization/command-center-image/scripts/verify-iso.sh
```

Preferred tool: `mkksiso` from package `lorax` (`sudo dnf install -y lorax`). If `mkksiso` is not installed, `build-iso.sh` uses an **`xorriso` fallback** (patches EFI/`boot/grub2` `grub.cfg` with `inst.ks=…`, maps kickstart + payload). Prefer lorax when you can use sudo.

Output: EliteEW-Kiosk-F44-<build-stamp>.iso *[build artifact under kiosk-fedora-iso/out/]*

Install needs **network** at Anaconda time for packages not on the Server DVD (`cage`, `chromium`, etc.). Runtime needs `wg-portal` for API/auth.

## After first boot

1. Change password for `eliteew-001` (temporary password is documented in `/opt/eliteew-kiosk/README-FIRST.txt`).
2. Install portal peer: `/etc/wireguard/wg-portal.conf` → `systemctl enable --now wg-quick@wg-portal`.
3. `systemctl enable --now nginx eliteew-kiosk`.
4. Smoke: `curl -fsS http://127.0.0.1/api/health` and auth-proxy discovery issuer `https://auth.eliteew.ru/realms/empery`.

## Layout (local tree)

```text
pack-organization/kiosk-fedora-iso/
  kickstart/eliteew-kiosk.ks
  payload/          # templates; SPA filled by prepare-payload.sh
  pack-organization/command-center-image/scripts/prepare-payload.sh | build-iso.sh | verify-iso.sh
  out/              # generated ISOs
```

## Failure / edge

| Axis | Behavior |
|------|----------|
| Offline install | Extra RPM fetch fails without network — use online install or expand DVD content later |
| Missing SPA | `prepare-payload.sh` exits non-zero if `dist-build/index.html` absent |
| Permission | `mkksiso` typically needs root; build script re-execs via `sudo` |
| Dual config | `config.env` overrides `config.env.example` when present |
