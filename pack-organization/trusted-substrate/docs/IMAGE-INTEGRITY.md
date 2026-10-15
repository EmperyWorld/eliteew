# Trusted Substrate — image integrity (W5)

SoT §9 targets: detached signature, Secure Boot where HW allows, dm-verity for read-only root, LUKS for mutable/payload slots.

| Control | W5 factory status |
|---------|-------------------|
| Detached image signature | **Shipped** — `image-sign.sh` / `image-verify.sh` |
| Tamper fail-closed | **Shipped** — selftest-w5 |
| dm-verity | **Recipe** — `integrity-verity.sh` (+ Buildroot/block-device residual) |
| LUKS | **Wave 1 in apply** — 2 GiB state slot; passphrase never in image. Official bake still pending `BR2_PACKAGE_CRYPTSETUP`. Not metal MATCH |
| Secure Boot | **Ceremony** — [KEYS-CEREMONY.md](KEYS-CEREMONY.md); enroll residual |

## Release gate (Trusted branding)

Before calling an artifact **Trusted** (not `pilot`):

1. Built via W3 HOSTCC + W4 Buildroot (`os_trust=from-source`).
2. `bash scripts/image-verify.sh --image <artifact>` → OK.
3. Prefer dm-verity root hash recorded next to artifact.
4. On SB-capable HW: bootloader/kernel enrolled/signed per ceremony.

Fedora W1 pilot ISO is retired under `trash/` — do not sign or flash it as Trusted.

## Commands

```bash
# After out/ image exists:
bash scripts/image-sign.sh --image out/<artifact>
bash scripts/image-verify.sh --image out/<artifact>

# Verity plan (dry-run default):
bash scripts/integrity-verity.sh --image out/rootfs.ext2
```

## LUKS sketch (mutable slot)

- System volume: read-only + verity (preferred).
- Payload / state slot: LUKS2; unlock via ops handoff or TPM-bound key — **never** bake passphrase into public image.
- Align with W6 payload A/B when that wave lands.

## Offline / dual / permission

| Axis | Behavior |
|------|----------|
| Offline | Verify local |
| Dual-flag | Signing orthogonal to electron/tauri profile |
| Permission | Private keys ops-only; end user never signs |
| Regression | `bash scripts/selftest-w5.sh` |
