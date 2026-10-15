# Trusted Substrate — signing key ceremony (W5)

**Ops-only.** End users never run this. Private keys **must not** enter git, ISO, or rootfs overlay.

SoT: [ELITEEW-TRUSTED-SUBSTRATE.md](../../../documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) §9  
Integrity runbook: [IMAGE-INTEGRITY.md](IMAGE-INTEGRITY.md)

## Algorithm (factory default)

| Item | Value |
|------|--------|
| Signature | Detached **OpenSSL Ed25519** (PureEdDSA via `pkeyutl -rawin`) over raw image bytes |
| Hash | N/A for Ed25519 PureEdDSA (signature covers message bytes directly) |
| Private key path | `work/signing-keys/image-signing.key.pem` (gitignored) |
| Public key path | `config/signing/image-signing.pub.pem` (operator may commit **public** only) |

## Ceremony checklist (command-center)

1. Create isolated directory outside the monorepo **or** under `work/signing-keys/` (gitignored).
2. Generate keypair:

```bash
cd pack-organization/trusted-substrate
mkdir -p work/signing-keys
chmod 700 work/signing-keys
openssl genpkey -algorithm Ed25519 -out work/signing-keys/image-signing.key.pem
chmod 600 work/signing-keys/image-signing.key.pem
openssl pkey -in work/signing-keys/image-signing.key.pem -pubout \
  -out config/signing/image-signing.pub.pem
```

3. Back up private key to offline / HSM per org policy — **not** Slack/email/git.
4. Record key fingerprint / creation date in operator vault (not in product canon).
5. Sign release image:

```bash
bash scripts/image-sign.sh --image out/rootfs.ext2
bash scripts/image-verify.sh --image out/rootfs.ext2
```

6. Ship image **and** `.sig` together; verify on install host before flash.

## Secure Boot (hardware-dependent)

Required to drop casual `pilot` branding and claim **hardened Trusted** on supporting HW:

1. Create PK/KEK/db keys (separate from image Ed25519; UEFI format) — store offline.
2. Enroll on reference machine (Setup Mode → enroll → User Mode).
3. Sign bootloader/kernel with SB keys (Buildroot/sbsign path — operator residual after W4 image exists).
4. Document enrolled fingerprints in vault.

Selftest does **not** enroll Secure Boot; it proves detached image verify + tamper fail-closed.

## Forbidden

- Committing private signing key files under the monorepo
- Baking signing private keys into `rootfs_overlay/`
- Claiming verify success without running `image-verify.sh`
