# EliteEW Trusted Substrate — first-party disk installer (MIT)

**License:** MIT (`LICENSE`) — first-party EliteEW code.  
**Third-party UI crates:** `egui` / `eframe` / `egui_extras` / `image` under **MIT** (dual MIT/Apache-2.0 — we use MIT).  
**Fonts:** no embedded egui `default_fonts`; load system **DejaVu** via `BR2_PACKAGE_DEJAVU` + `DEJAVU_SANS` (`/usr/share/fonts/dejavu/DejaVuSans.ttf`). Missing fonts → installer exit 2 (no silent fallback).
**No** Calamares/Anaconda GUI, **no** prebuilt third-party installer binaries.

## Build (from source)

```bash
cd pack-organization/trusted-substrate
bash scripts/build-installer-from-source.sh
bash scripts/selftest-installer.sh
```

Installs into the Buildroot overlay:

- `/usr/local/bin/eliteew-ts-installer`
- `/usr/local/share/eliteew-ts-installer/{logo.png,chime.wav,boot-splash.png,LICENSE}`
- `/usr/local/share/eliteew-ts-installer/empiieros-time-sync` and `.service` — masked wall-clock pair apply plants onto the seat. Wipe is refused if this copy still contains `set-ntp`.
- OTA artifact keys are **not** on installer media. `stamp-live-installer-media.sh` strips leftover `artifact.pk.hex` / `artifact.sk.hex` and plants the overlay `eliteew-ts-install-apply` (no `plant_seat_ota_pk`). Verify PK travels inside the Air license capsule (`payload.ota_artifact_pk` on admin-code activate). Never an SK.

## Live media vs runtime image

| Image | Flag | Boot |
|-------|------|------|
| Live USB/ISO | stamp `live-installer` via `scripts/stamp-live-installer-media.sh <root>` | GUI installer (labwc + egui) |
| Factory-flashed runtime | **no** `live-installer` | Product kiosk |

After successful disk apply, target rootfs gets `INSTALL-COMPLETE` and loses `live-installer`.

## UX

- Brand: Empery lime `#24FC24` on ink `#060A10`, logo + Comfy `boot-splash.png` welcome backdrop
- Steps: welcome → network (DHCP/static/skip) → disk → state key (auto hex or operator secret) → type `ERASE` → progress (smoothed bar) → Done (PIN + disk recovery) → reboot
- Apply refuses wipe unless the allowlisted FoFline ticket `install-proof.json` matches the canonical product-family JSON (`/opt/eliteew-ts-install/` on live media). Living Capsule v3 is consume after first-boot unlock — not install media, not `product.open`.
- Disk: GPT EFI 512 MiB + root ext4 + 2 GiB LUKS2 state (`/var/lib/empiieros-runtime`). Recovery ≠ PIN. Apply dies if `cryptsetup` is missing.
- Log: `~/eliteew-ts-install.log` (session) / app log under HOME
- Sound: power-on `aplay` chime from session (`chime.wav`), then step chimes in GUI
- Design mock (not product UI): `assets/design-preview.html` — runtime is **egui**, not HTML
- Console: tty2–6 gettys masked (including tty2); tty1 → session-router only (no shell fallthrough)
- Boot splash / Plymouth: Comfy `boot-splash.png` is **GUI backdrop only** this wave; Plymouth BR package not enabled

## Rootfs archive

Apply expects `/opt/eliteew-ts-install/rootfs.tar.gz` on live media (from-source rootfs artifact). Without it, install fails closed (no fake success).

## Canon

- SoT: `documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md`
- Readiness: `documentation/reference/solution-readiness/2026-09-08-trusted-substrate-mit-disk-installer.md`
