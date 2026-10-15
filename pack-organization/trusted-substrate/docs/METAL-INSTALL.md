# Trusted Substrate — metal install

**Product path:** from-source Buildroot → `out/` → live USB (`flash-live-installer-usb.sh`).
Fedora W1 ISO pilot is retired under `trash/` — do not rebuild or flash it.

## Lab vs production (HARD)

| Mode | Meaning | Allowed |
|------|---------|---------|
| **Lab metal** | Prove disk + console + network + GUI on real hardware | Unsigned or lab-signed artifacts OK; operator residual for flash/boot |
| **Production Trusted** | Ship as Trusted Substrate | **Forbidden** without W5: `image-sign.sh` + `image-verify.sh` OK on the artifact flashed |

Lab success ≠ production Trusted. Do not claim Trusted branding on unsigned metal.

## Prerequisites (host)

- UEFI x86_64 target (NVMe/SATA)
- Working console path (serial or HDMI/eDP + DRM) — without framebuffer, many UEFI laptops freeze after GRUB
- Network for DHCP or operator-documented static (see Ethernet notes below)
- Operator residual for media write and first boot until W5 automation lands

## Forbidden on early metal

- Production Trusted claim without W5 verify OK
- Shipping unsigned artifacts as “ready”
- Fedora kickstart / Anaconda ISO as the product install path (retired)

## From-source (Buildroot)

Requires toolchain prefix, then `buildroot-build.sh`. Images land under `out/` with stamp `os_trust=from-source`.

**Secure-reset status:** source recipes are present, but the active
`empiieros-shell` image is `NOT_READY` until clean image, QEMU, and physical
metal acceptance complete.

**GUI disk installer:** for live USB, build the MIT installer from source and stamp the live flag:

```bash
bash scripts/buildroot-build.sh               # rebuilds installer; SoT = images/rootfs.tar.gz (+ ext2/bzImage)
bash scripts/pack-install-rootfs-metal.sh     # copy-only images/rootfs.tar.gz → out/
# Flash USB (BR images only; SHA must match; live stamp via stamp script inside flash):
#   bash scripts/flash-live-installer-usb.sh /dev/sdX
# HARD SoT: sha256(images/rootfs.tar.gz) == sha256(live …/opt/eliteew-ts-install/rootfs.tar.gz)
# Forbidden: fuse-repack, host overlay inject, baking ssh_host_* into the archive.
# Apply generates unique host keys on target: live ssh-keygen -A -f <mnt>
# (chroot fallback only after ensure /dev/null — fresh extract has no device nodes)
```

Live boot → branded installer (regional settings + observed Ethernet/Wi-Fi + disk; ink/lime; splash still; power-on chime via `aplay`). Disk selection shows identity, health, existing partitions, and the whole-disk GPT plan (EFI + root + 2 GiB LUKS2 state); the helper pins identity and verifies archive SHA-256 before wipe. Recovery ≠ PIN. **tty2–6** gettys masked (tty1-only console). Install log: `~/eliteew-ts-install.log` (session) + `~/eliteew-ts-installer-app.log`. Assets: `/usr/local/share/eliteew-ts-installer/{logo.png,chime.wav,boot-splash.png}`. Factory-flashed runtime images **omit** `live-installer` and keep kiosk. See [ROOTFS-FROM-SOURCE.md](ROOTFS-FROM-SOURCE.md) §Disk installer. Flash USB verify expects `getty@tty2.service` → `/dev/null` and no `getty@tty2` in `getty.target.wants`.

**Metal console/network:** kernel fragments enable framebuffer/DRM console, common wired NICs, USB Ethernet, and common Intel, Qualcomm Atheros 802.11ac, MediaTek, Realtek, and Broadcom Wi-Fi drivers. Matching firmware families and the signed regulatory database are final-image requirements. Overlay `20-wired.network` matches `en*` for DHCP (not only `eth0`). Without console support, UEFI laptops freeze on GRUB’s “Booting a command list”.

**Ethernet default:** installer and image `20-wired.network` use **DHCP IPv4**
on `en*`. Do **not** plant `10-eliteew-ts-install-*.network` with a lab static
address — that file wins and cable DHCP never runs.

**Metal lab link (MikroTik ether8 / `br-trusted8`):** optional point-to-point
**`192.168.8.8/30`** — MikroTik **`.9`**, operator **`.10`** (canon:
`documentation/platform/KEENETIC-MIKROTIK-RUNBOOK.md`). Type that static
only when the link has no DHCP. The GUI must not prefill it. Operator
snippet: [METAL-LAB-STATIC.network.example](METAL-LAB-STATIC.network.example)
— never ship it as a live `*.network` in the overlay. After a DHCP
install, SSH to whatever lease the seat got — not a baked `.10`.
Installed SSH has no password path: provision an operator public key when
building the EmpiierOS overlay. Without a provisioned key, sshd remains disabled.

**Live install toolchain (HARD):** image must ship `util-linux` binaries (`lsblk`/`sfdisk`/`findmnt`), `dosfstools` (`mkfs.vfat`), and `grub-install` tools — see defconfig `BR2_PACKAGE_UTIL_LINUX_BINARIES`, `BR2_PACKAGE_DOSFSTOOLS_MKFS_FAT`, `BR2_TARGET_GRUB2_INSTALL_TOOLS`. Disk *listing* in the GUI uses `/sys/block` and must not depend on `lsblk` spawn. **Rootfs extract:** do **not** use `tar -xzf` — live image `tar` is BusyBox and rejects `-z`; apply uses `gzip -dc | tar -x` and releases `/mnt/eliteew-ts-install` mounts on failure so retry is not blocked. **Bootloader:** `rootfs.tar.gz` has no `grub-install` — apply runs live `grub-install` into the mounted target ESP and writes `grub.cfg` with `root=PARTUUID=…` (never `chroot … grub-install`). **PARTUUID (HARD):** never use BusyBox `blkid -s/-o` (poisons `root=` with `/dev/nvme0n1p2: LABEL=…`); use util-linux `lsblk -no PARTUUID` / `by-partuuid` and reject non-UUID strings. Write `grub.cfg` to `/boot/grub` **and** ESP `EFI/BOOT`.

**Metal payload (active profile):** run
`EmpiierOS/scripts/package-shell-gui-rootfs.sh --operator-key <public-key>`
before `buildroot-build.sh`. It emits a content-addressed overlay containing
the production Rust Runtime, hardened native WebKitGTK bridge, React Shell,
and digest manifest. Buildroot merges it before the normal post-build policy
gate. The packager does not modify a finished archive or USB media. The legacy
Desktop Client binary and ambient `%wheel` sudo are forbidden in this profile.

**SSH on installed metal (HARD):** reference `rootfs.tar.gz` must **not** contain `ssh_host_*` private keys. `eliteew-ts-install-apply` runs `rm` then **primary** `mount --bind /dev+/proc` → `chroot … ssh-keygen -A` → immediate `umount -l` of those binds; live `ssh-keygen -A -f` only if target binary missing. sshd drop-in `eliteew-ts-hostkeys.conf` heals ownership and runs `ssh-keygen -A` before start. Never bake shared host keys into the SoT archive. **Repair** (`repair-installed-nvme-from-live.sh`) always regenerates host keys (never «if missing»). **Wipe:** `wipefs`/`dd` header must succeed or apply dies before GPT. **GUI:** removable disks are not selectable (install only to internal disks). **Metal extract (C4):** apply strips `eliteew-ts-installer`, `eliteew-ts-installer-session`, and `/usr/local/share/eliteew-ts-installer` from the target (live USB root keeps them). **Overlay SoT (C2):** edit `rootfs_overlay`, then `bash scripts/sync-payload-templates-from-overlay.sh` (labels intentionally not synced).

**GRUB on USB (HARD):** never run BusyBox `blkid -s UUID -o value` on the metal image to rewrite `grub.cfg` — BusyBox prints the whole `NAME: LABEL=… UUID=…` line and poisons `search --fs-uuid` / `root=PARTUUID=` (symptom: `error: no such device: /dev/sda3`). Generate IDs on command-center with util-linux `blkid -s … -o value`, put **`bzImage` on the ESP** (`ELITEEWTS:/boot/bzImage`), and use `search --file /boot/bzImage` + `root=PARTUUID=<36-char>`.

Keep kiosk masked + `disable-kiosk` only while debugging console/network.

Metal flash/boot procedure remains operator residual until W5 signing — see [ROOTFS-FROM-SOURCE.md](ROOTFS-FROM-SOURCE.md).

## Before flash (Trusted)

```bash
bash scripts/image-sign.sh --image out/<artifact>
bash scripts/image-verify.sh --image out/<artifact>   # must OK
```

See [KEYS-CEREMONY.md](KEYS-CEREMONY.md) and [IMAGE-INTEGRITY.md](IMAGE-INTEGRITY.md). Do not claim Trusted branding without verify OK.
