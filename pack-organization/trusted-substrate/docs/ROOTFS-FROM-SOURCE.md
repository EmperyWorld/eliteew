# Trusted Substrate — rootfs from source (W4)

**Pack:** `pack-organization/trusted-substrate/`  
**SoT:** [ELITEEW-TRUSTED-SUBSTRATE.md](../../../documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md)  
**Plan:** `ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` (historical reference; absent from this checkout) §W4<br>
**Toolchain:** [TOOLCHAIN-FROM-SOURCE.md](TOOLCHAIN-FROM-SOURCE.md)

## What this is

Pinned **Buildroot 2025.02.1** factory that builds a minimal x86_64 rootfs **using EliteEW W3 toolchain as `HOSTCC`/`HOSTCXX` SoT**. Buildroot then builds its own cross toolchain and packages **from source**. Distro `/usr/bin/gcc` is **not** the source of truth for release builds.

| Label | Value |
|-------|--------|
| `os_trust` | `from-source` |
| `payload_trust` | `eliteew-runtime` for the active EmpiierOS profile |
| `payload_profile` | `empiieros-shell` |
| `toolchain_sot` | `eliteew-w3-hostcc` |
| Display | Wayland: **labwc** (BR2_EXTERNAL) + **cage** fallback; Mesa3D; Xwayland; `users.table` → `eliteew-ts` + video/render/input/seat |
| Runtime bake | `EmpiierOS/scripts/package-shell-gui-rootfs.sh` cross-builds the Rust Runtime and hardened WebKitGTK bridge, builds the locked React Shell, and emits an immutable content-addressed overlay with a digest manifest. Buildroot consumes that overlay before its normal post-build gate. |

Fedora W1 pilot ISO is retired under `trash/` (`os_trust=pilot` is not a living product path). Electron+Openbox fragment is also retired (trash). Product axis is this Buildroot factory + live USB flash.

Package license fields and the legal-info checklist: [engineering-bar/buildroot-packages.md](../../../documentation/platform/engineering-bar/buildroot-packages.md). `0006-dejavu-localedef-license.patch` fills the two `unknown` rows (dejavu, host localedef). The published SBOM is stale until the next `make legal-info`.

## Disk installer (first-party MIT GUI)

Live media boots a **first-party MIT** installer (`installer/` → `eliteew-ts-installer`), not Calamares/Anaconda GUI and not third-party binaries.

```bash
bash scripts/build-installer-from-source.sh   # optional local installer-only build
bash scripts/stamp-live-installer-media.sh /path/to/live-root
bash scripts/selftest-installer.sh
```

`buildroot-build.sh` always rebuilds the installer from current Rust source into
a generated overlay and verifies its provenance manifest. A manually retained
overlay binary is not accepted as image evidence.

| Concern | Behavior |
|---------|----------|
| Brand | Lime on ink + logo + splash still; smoothed progress; session `aplay` chime (`chime.wav`) |
| Regional | Russian/English generated UTF-8 locale plus allowlisted timezone; exact values are written to and verified in the installed target |
| Network | Observed Ethernet DHCP/static or real Wi-Fi scan/connect → exactly one persisted systemd-networkd profile; Wi-Fi credentials travel on stdin and persist root-only; Intel/Qualcomm/MediaTek/Realtek/Broadcom drivers and matching firmware are image-gated |
| Disk | Internal whole-disk GPT (EFI + root ext4 + 2 GiB LUKS2 state); serial/major:minor/size identity is rechecked before wipe, archive SHA-256 is checked before partitioning, and the extracted target contract is verified before completion |
| Console | tty2–6 masked; tty1 session-router — no interactive shell fallthrough |
| Log | `/var/log/eliteew-ts-install.log` (temporary) |
| Live vs runtime | `live-installer` stamp only on live media; runtime → kiosk |

Apply helper: `/usr/local/bin/eliteew-ts-install-apply` (root via sudoers). Requires live artifact `/opt/eliteew-ts-install/rootfs.tar.gz`.

## Work root (external)

Large caches must **not** live inside the monorepo:

```bash
cp -n config/work-root.example.env config/work-root.env
# default: ELITEEW_TS_WORK_ROOT=/data/repos/eliteew-ts-factory-work
```

Scripts source `scripts/work-root.sh` and place toolchain/Buildroot trees under that root.

## Layout

```text
config/buildroot/
  BUILDROOT.pin
  package-allowlist
  fragments/*.frag          # 30-display-tauri-wayland.frag
  external/                 # BR2_EXTERNAL
    package/labwc/          # labwc 0.8.3 ↔ wlroots 0.18
    configs/eliteew_ts_x86_64_defconfig
    board/eliteew-ts/
      rootfs_overlay/       # labels, kiosk, systemd
      post-build.sh
```

## Commands

```bash
cd pack-organization/trusted-substrate

# After W3 prefix exists under work-root:
bash scripts/toolchain-fetch.sh
bash scripts/toolchain-build.sh   # hours

bash scripts/buildroot-merge-config.sh
bash scripts/buildroot-fetch.sh
bash /data/repos/EmpiierOS/scripts/package-shell-gui-rootfs.sh \
  --operator-key /path/to/operator.pub
bash scripts/buildroot-build.sh --dry-run
bash scripts/buildroot-build.sh           # hours; needs disk (~8G rootfs target)

bash scripts/selftest-secure-reset.sh
ELITEEW_TS_SECURE_RESET_QEMU=1 bash scripts/selftest-secure-reset.sh
```

The QEMU variant performs both a direct graphical boot and a real helper
installation to a blank virtual disk followed by graphical boot of that
installed disk. Each boot must contain a successful authorized Shell
`system.snapshot` response; correlated denial traffic is explicitly rejected.

## Offline / dual / permission

| Axis | Behavior |
|------|----------|
| Offline | CA cache hit works; fetch fails closed |
| Dual payload | electron+tauri still refused (W0) |
| Permission | artifacts under external work-root + pack `out/` |
| Metal boot | operator residual — flash/run image from `out/` after full build; need kernel console fragment (`linux-console.fragment`) + i915 firmware on Intel laptops |

## Honesty

- The default secure-reset selftest proves source gates and adversarial cases;
  its opt-in QEMU mode requires a completed Buildroot image and proves virtual
  boot. Reference-hardware boot remains an **operator** step.
- The overlay packager prepares the target WebKitGTK SDK when absent, but never
  opens or repacks `rootfs.tar.gz`, mutates USB media, or creates a second image
  source of truth.
- Its content-addressed manifest hashes the packager and all Runtime/Shell
  inputs and records whether the Git source tree was dirty; dirty audit builds
  remain evidence artifacts, not release provenance.
- `payload_trust=eliteew-runtime` identifies the first-party Runtime profile. It
  does **not** claim that WebKit itself is an EliteEW engine-from-source build.
