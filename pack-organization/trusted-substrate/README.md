# trusted-substrate — EliteEW Trusted Substrate

**Pack:** `pack-organization`  
**Audit boundary:** source checks, image/QEMU observations and artifact hashes below are historical claims from the module owner. They were not rerun or rehashed in the 2026-10-11 documentation audit; physical acceptance remains required.

**Wave status:** **NOT_READY (secure reset)**. Historical W0–W7 labels describe
implemented recipes, not accepted image or metal behavior. The active
`empiieros-shell` profile has a Buildroot image, passing direct graphical QEMU,
and passing real-helper install-to-blank-disk→installed-boot QEMU acceptance;
physical wipe→reboot acceptance remains.
On 2026-09-22 `buildroot-output/images/rootfs.tar.gz` and `out/rootfs.tar.gz`
are the same bytes, sha256 `cf0b46e1…`. Ledger id `5979e9cf…` is the
2026-09-20 bake, not this file. Metal acceptance remains.
**Living SoT:** [ELITEEW-TRUSTED-SUBSTRATE.md](../../documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md)  
**Process plans:** operator-local under `documentation/plans/`; not living product canon.<br>
**Docs:** [METAL-INSTALL](docs/METAL-INSTALL.md) · [POST-INSTALL-SMOKE](docs/POST-INSTALL-SMOKE.md) · [NETWORK-HANDOFF](docs/NETWORK-HANDOFF.md) · [TOOLCHAIN](docs/TOOLCHAIN-FROM-SOURCE.md) · [ROOTFS](docs/ROOTFS-FROM-SOURCE.md) · [KEYS-CEREMONY](docs/KEYS-CEREMONY.md) · [IMAGE-INTEGRITY](docs/IMAGE-INTEGRITY.md) · [PAYLOAD-UPDATE](docs/PAYLOAD-UPDATE.md) · [PAYLOAD-TAURI](docs/PAYLOAD-TAURI.md)

**Product path:** Buildroot from-source → `out/` → `flash-live-installer-usb.sh`. Fedora W1 ISO pilot is retired under `trash/`.

## Component checks

```bash
bash pack-organization/trusted-substrate/scripts/selftest-secure-reset.sh
# After scripts/buildroot-build.sh has produced out/bzImage + out/rootfs.ext2:
ELITEEW_TS_SECURE_RESET_QEMU=1 \
  bash pack-organization/trusted-substrate/scripts/selftest-secure-reset.sh
```

The default command verifies current source contracts and adversarial cases,
including rejection of a Runtime peer-denial fixture. The QEMU variant also
proves direct image boot, repeated authorized `system.snapshot` responses,
Runtime startup, network policy, a stable virtual Wayland seat, and a second
boot from a disk created by the real installer helper. Historical
`selftest-w2.sh`–`selftest-w6.sh` are recipe checks only — not acceptance
authority for the active `empiieros-shell` profile. Fedora W1/W7 ISO
selftests are retired under `trash/`. Physical-metal acceptance remains
mandatory.

## Session scope

| Open | Do not touch without ask |
|------|--------------------------|
| This tree + Trusted Substrate SoT/plan | `connection-agent/` (until W7b scope), `kiosk-fedora-iso/`, `pack-cloud/mobile/` |

**Next:** install the current `empiieros-shell` image on representative
hardware and run physical network, display, hardware-state, and recovery
acceptance.
